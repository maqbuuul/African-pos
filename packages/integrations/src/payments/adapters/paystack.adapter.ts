import type {
  ConnectionCredentials,
  PaymentAdapter,
  PaymentInitiateInput,
  PaymentInitiateResult,
  PaymentRefundInput,
  PaymentRefundResult,
  PaymentWebhookInput,
  PaymentWebhookResult,
} from '../payment-adapter.interface.js'

interface PaystackCredentials {
  secretKey: string // sk_test_... or sk_live_...
}

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

// Constant-time byte comparison to prevent timing side-channel attacks on
// HMAC verification. Mirrors Node's crypto.timingSafeEqual using typed arrays.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return diff === 0
}

// HMAC-SHA512 verification using the Web Crypto API (globalThis.crypto.subtle),
// available globally in Node 18+ and typed via the DOM lib — no node:crypto
// import needed.
async function verifyPaystackSignature(
  rawPayload: string,
  secretKey: string,
  signature: string,
): Promise<void> {
  const encoder = new TextEncoder()

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )

  const signatureBuffer = await globalThis.crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(rawPayload),
  )

  // Convert computed signature to lowercase hex for comparison with Paystack's
  // x-paystack-signature header value.
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const expectedBytes = encoder.encode(computedHex)
  const signatureBytes = encoder.encode(signature.toLowerCase())

  if (!timingSafeEqual(expectedBytes, signatureBytes)) {
    throw new Error('Paystack webhook signature verification failed')
  }
}

export class PaystackAdapter implements PaymentAdapter {
  readonly provider = 'paystack'

  async initiatePayment(
    input: PaymentInitiateInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    const creds = credentials as unknown as PaystackCredentials

    // Paystack requires a valid email address for every transaction. Generate
    // a deterministic placeholder when the customer has no email on record.
    const email = input.customerEmail ?? `noemail+${input.paymentIntentId}@pos.local`

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: input.amount,
        currency: input.currency,
        reference: input.idempotencyKey, // Paystack reference = our idempotency key
        metadata: {
          payment_intent_id: input.paymentIntentId,
          bill_id: input.billId,
          organization_id: input.organizationId,
          cancel_action: '',
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Paystack transaction initialize failed (HTTP ${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      status: boolean
      message: string
      data: {
        authorization_url: string
        access_code: string
        reference: string
      }
    }

    if (!data.status) {
      throw new Error(`Paystack initialization rejected: ${data.message}`)
    }

    return {
      providerReference: data.data.reference,
      requiresWebhook: true,
      checkoutUrl: data.data.authorization_url,
      message: data.message,
    }
  }

  async verifyWebhook(
    input: PaymentWebhookInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    const creds = credentials as unknown as PaystackCredentials

    // Signature is the value of the x-paystack-signature request header,
    // extracted by the HTTP layer before calling this adapter.
    await verifyPaystackSignature(input.rawPayload, creds.secretKey, input.signature)

    let event: unknown
    try {
      event = JSON.parse(input.rawPayload)
    } catch {
      throw new Error('Paystack webhook payload is not valid JSON')
    }

    const e = event as {
      event?: string
      data?: {
        reference?: string
        status?: string
        amount?: number
        currency?: string
        paid_at?: string
        metadata?: {
          payment_intent_id?: string
          bill_id?: string
          organization_id?: string
        }
      }
    }

    if (e.event !== 'charge.success') {
      throw new Error(`Unhandled Paystack event type: "${e.event ?? 'unknown'}"`)
    }

    const data = e.data
    if (!data?.reference || data.amount === undefined || !data.currency || !data.paid_at) {
      throw new Error('Paystack charge.success payload missing required fields')
    }

    const paymentIntentId = data.metadata?.payment_intent_id
    if (!paymentIntentId) {
      throw new Error('Paystack webhook payload missing payment_intent_id in metadata')
    }

    return {
      paymentIntentId,
      providerReference: data.reference,
      status: data.status === 'success' ? 'confirmed' : 'failed',
      amount: data.amount,
      currency: data.currency,
      paidAt: new Date(data.paid_at),
      metadata: {
        paystackReference: data.reference,
        billId: data.metadata?.bill_id,
        organizationId: data.metadata?.organization_id,
      },
    }
  }

  async initiateRefund(
    input: PaymentRefundInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    // Paystack refund API availability varies by account type and market.
    // Upgrade path: when Paystack confirms refund API access, implement
    // POST /refund with { transaction: providerReference, amount }.
    return {
      requiresManualSettlement: true,
      message:
        `Paystack refunds require manual processing for this account. ` +
        `Contact Paystack support with transaction reference: ${input.providerReference}`,
    }
  }
}
