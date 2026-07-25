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

interface FlutterwaveCredentials {
  secretKey: string // FLWSECK_TEST-... or FLWSECK-...
  webhookSecretHash: string // static string configured in the Flutterwave dashboard, echoed back in verif-hash
  redirectUrl: string // where Flutterwave sends the customer after checkout
}

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3'

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return diff === 0
}

export class FlutterwaveAdapter implements PaymentAdapter {
  readonly provider = 'flutterwave'

  async initiatePayment(
    input: PaymentInitiateInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    const creds = credentials as unknown as FlutterwaveCredentials

    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.idempotencyKey,
        // Flutterwave's amount field is the decimal face value (e.g. "1200.00"
        // for KES 1,200) — same whole-currency-unit convention `input.amount`
        // already uses throughout this codebase, so no conversion needed here
        // (unlike Stripe, which genuinely wants cents).
        amount: input.amount.toFixed(2),
        currency: input.currency,
        redirect_url: creds.redirectUrl,
        customer: {
          email: input.customerEmail ?? `noemail+${input.paymentIntentId}@pos.local`,
          ...(input.customerPhone ? { phonenumber: input.customerPhone } : {}),
        },
        customizations: {
          title: input.description ?? 'Payment',
        },
        meta: {
          payment_intent_id: input.paymentIntentId,
          bill_id: input.billId,
          organization_id: input.organizationId,
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Flutterwave payment initiation failed (HTTP ${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      status: string
      message: string
      data: { link: string }
    }

    if (data.status !== 'success') {
      throw new Error(`Flutterwave initiation rejected: ${data.message}`)
    }

    return {
      providerReference: input.idempotencyKey, // tx_ref — Flutterwave's own id (flw_ref) only exists after payment
      requiresWebhook: true,
      checkoutUrl: data.data.link,
      message: data.message,
    }
  }

  async verifyWebhook(
    input: PaymentWebhookInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    const creds = credentials as unknown as FlutterwaveCredentials

    // Flutterwave doesn't HMAC-sign webhooks — it echoes back a static hash
    // configured in the dashboard via the verif-hash header. Compare directly.
    const encoder = new TextEncoder()
    if (!timingSafeEqual(encoder.encode(input.signature), encoder.encode(creds.webhookSecretHash))) {
      throw new Error('Flutterwave webhook verif-hash mismatch')
    }

    let event: unknown
    try {
      event = JSON.parse(input.rawPayload)
    } catch {
      throw new Error('Flutterwave webhook payload is not valid JSON')
    }

    const e = event as {
      event?: string
      data?: {
        id?: number
        tx_ref?: string
        flw_ref?: string
        status?: string
        amount?: number
        currency?: string
        created_at?: string
        meta?: {
          payment_intent_id?: string
          bill_id?: string
          organization_id?: string
        }
      }
    }

    if (e.event !== 'charge.completed') {
      throw new Error(`Unhandled Flutterwave event type: "${e.event ?? 'unknown'}"`)
    }

    const data = e.data
    if (!data?.tx_ref || data.amount === undefined || !data.currency) {
      throw new Error('Flutterwave charge.completed payload missing required fields')
    }

    // Server-side re-verification of the transaction with Flutterwave is
    // strongly recommended by their docs (webhook payloads are not proof of
    // payment on their own) — done here via GET /transactions/{id}/verify.
    if (data.id !== undefined) {
      const verifyResponse = await fetch(
        `${FLUTTERWAVE_BASE_URL}/transactions/${data.id}/verify`,
        { headers: { Authorization: `Bearer ${creds.secretKey}` } },
      )
      if (verifyResponse.ok) {
        const verified = (await verifyResponse.json()) as {
          data?: { status?: string; amount?: number; currency?: string }
        }
        if (
          verified.data?.status !== 'successful' ||
          verified.data.amount !== data.amount ||
          verified.data.currency !== data.currency
        ) {
          throw new Error('Flutterwave server-side transaction verification did not match webhook payload')
        }
      }
    }

    const paymentIntentId = data.meta?.payment_intent_id
    if (!paymentIntentId) {
      throw new Error('Flutterwave webhook payload missing payment_intent_id in meta')
    }

    return {
      paymentIntentId,
      providerReference: data.flw_ref ?? data.tx_ref,
      status: data.status === 'successful' ? 'confirmed' : 'failed',
      amount: Math.round(data.amount), // already whole currency units, no conversion
      currency: data.currency,
      paidAt: data.created_at ? new Date(data.created_at) : new Date(),
      metadata: {
        flutterwaveTxRef: data.tx_ref,
        flutterwaveFlwRef: data.flw_ref,
        billId: data.meta?.bill_id,
        organizationId: data.meta?.organization_id,
      },
    }
  }

  async initiateRefund(
    input: PaymentRefundInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    const creds = credentials as unknown as FlutterwaveCredentials

    try {
      // Flutterwave refunds are addressed by their numeric transaction id
      // (flw_ref), which providerReference holds after a confirmed webhook.
      const response = await fetch(
        `${FLUTTERWAVE_BASE_URL}/transactions/${input.providerReference}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: input.amount.toFixed(2) }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        return {
          requiresManualSettlement: true,
          message: `Flutterwave refund request failed (HTTP ${response.status}): ${text}. Process refund manually via the Flutterwave Dashboard.`,
        }
      }

      const data = (await response.json()) as { status: string; message: string }
      if (data.status !== 'success') {
        return {
          requiresManualSettlement: true,
          message: `Flutterwave refund rejected: ${data.message}. Process refund manually via the Flutterwave Dashboard.`,
        }
      }

      return { requiresManualSettlement: false, message: data.message }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        requiresManualSettlement: true,
        message: `Flutterwave refund encountered an error: ${message}. Process refund manually via the Flutterwave Dashboard.`,
      }
    }
  }
}
