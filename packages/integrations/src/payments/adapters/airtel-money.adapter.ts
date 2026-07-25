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

interface AirtelMoneyCredentials {
  clientId: string
  clientSecret: string
  country: string // ISO 3166-1 alpha-2, e.g. "KE", "UG", "TZ" — required in X-Country header
  currency: string // ISO 4217, e.g. "KES" — required in X-Currency header
  environment: 'sandbox' | 'production'
  callbackSecret?: string // optional defense-in-depth shared secret for the callback URL
}

const BASE_URLS: Record<'sandbox' | 'production', string> = {
  sandbox: 'https://openapistaging.airtel.africa',
  production: 'https://openapi.airtel.africa',
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }
  return diff === 0
}

// Normalise to the local-format MSISDN Airtel's Collections API expects
// (subscriber.msisdn, no country code) — accepts 07XXXXXXXX, 2547XXXXXXXX,
// +2547XXXXXXXX.
function formatMsisdn(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (/^0\d{9}$/.test(cleaned)) {
    return cleaned.slice(1) // 07XXXXXXXX -> 7XXXXXXXX
  }
  if (/^\d{3}\d{9}$/.test(cleaned)) {
    return cleaned.slice(3) // 2547XXXXXXXX -> 7XXXXXXXX
  }
  throw new Error(
    `Invalid phone number format: "${phone}". Expected 07XXXXXXXX or 2547XXXXXXXX.`,
  )
}

async function getAccessToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Airtel Money OAuth token request failed (HTTP ${response.status}): ${text}`)
  }
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

export class AirtelMoneyAdapter implements PaymentAdapter {
  readonly provider = 'airtel_money_api'

  async initiatePayment(
    input: PaymentInitiateInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    const creds = credentials as unknown as AirtelMoneyCredentials

    if (!input.customerPhone) {
      throw new Error('customerPhone is required for Airtel Money collections')
    }

    const baseUrl = BASE_URLS[creds.environment]
    const msisdn = formatMsisdn(input.customerPhone)
    const accessToken = await getAccessToken(baseUrl, creds.clientId, creds.clientSecret)

    const response = await fetch(`${baseUrl}/merchant/v1/payments/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: '*/*',
        'X-Country': creds.country,
        'X-Currency': creds.currency,
      },
      body: JSON.stringify({
        reference: input.description ?? 'Payment',
        subscriber: {
          country: creds.country,
          currency: creds.currency,
          msisdn,
        },
        transaction: {
          amount: input.amount,
          country: creds.country,
          currency: creds.currency,
          // Airtel requires this id to be unique per attempt — safe to reuse
          // our idempotency key since the caller already guarantees uniqueness.
          id: input.idempotencyKey,
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Airtel Money payment request failed (HTTP ${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      status: { success: boolean; message: string; response_code: string }
      data?: { transaction?: { id: string; status: string } }
    }

    if (!data.status.success) {
      throw new Error(`Airtel Money request rejected: ${data.status.message}`)
    }

    return {
      providerReference: data.data?.transaction?.id ?? input.idempotencyKey,
      requiresWebhook: true,
      message: data.status.message,
    }
  }

  async verifyWebhook(
    input: PaymentWebhookInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    const creds = credentials as unknown as AirtelMoneyCredentials

    // Airtel's callback API doesn't HMAC-sign payloads (like Daraja) — it
    // relies on IP allowlisting / mutual TLS at the network layer, configured
    // per-merchant in the Airtel developer portal. If a merchant has
    // configured a shared callback secret as a query/header value, verify it
    // here as defense in depth; otherwise fall through to structural checks.
    if (creds.callbackSecret) {
      const provided = input.headers['x-callback-secret']
      const suppliedSecret = Array.isArray(provided) ? provided[0] : provided
      const encoder = new TextEncoder()
      if (
        !suppliedSecret ||
        !timingSafeEqual(encoder.encode(suppliedSecret), encoder.encode(creds.callbackSecret))
      ) {
        throw new Error('Airtel Money callback secret mismatch')
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(input.rawPayload)
    } catch {
      throw new Error('Airtel Money webhook payload is not valid JSON')
    }

    const body = parsed as {
      transaction?: {
        id?: string
        message?: string
        status_code?: string
        airtel_money_id?: string
      }
    }

    const transaction = body.transaction
    if (!transaction?.id) {
      throw new Error('Airtel Money webhook payload missing expected transaction structure')
    }

    // status_code "TS" = Transaction Success in Airtel's Collections callback.
    const status: 'confirmed' | 'failed' = transaction.status_code === 'TS' ? 'confirmed' : 'failed'

    return {
      paymentIntentId: transaction.id,
      providerReference: transaction.airtel_money_id ?? transaction.id,
      status,
      // Airtel's callback doesn't echo the amount back — the service layer
      // resolves the authoritative amount from the payment_intent row keyed
      // by providerReference/paymentIntentId, same convention as M-Pesa.
      amount: 0,
      currency: creds.currency,
      paidAt: new Date(),
      metadata: {
        airtelTransactionId: transaction.id,
        airtelMoneyId: transaction.airtel_money_id,
        statusCode: transaction.status_code,
        message: transaction.message,
      },
    }
  }

  async initiateRefund(
    input: PaymentRefundInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    const creds = credentials as unknown as AirtelMoneyCredentials

    try {
      const baseUrl = BASE_URLS[creds.environment]
      const accessToken = await getAccessToken(baseUrl, creds.clientId, creds.clientSecret)

      const response = await fetch(`${baseUrl}/standard/v1/payments/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Country': creds.country,
          'X-Currency': creds.currency,
        },
        body: JSON.stringify({
          transaction: { airtel_money_id: input.providerReference },
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        return {
          requiresManualSettlement: true,
          message: `Airtel Money refund request failed (HTTP ${response.status}): ${text}. Process refund manually via the Airtel Money merchant portal.`,
        }
      }

      const data = (await response.json()) as { status: { success: boolean; message: string } }
      if (!data.status.success) {
        return {
          requiresManualSettlement: true,
          message: `Airtel Money refund rejected: ${data.status.message}. Process refund manually via the Airtel Money merchant portal.`,
        }
      }

      return { requiresManualSettlement: false, message: data.status.message }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        requiresManualSettlement: true,
        message: `Airtel Money refund encountered an error: ${message}. Process refund manually via the Airtel Money merchant portal.`,
      }
    }
  }
}
