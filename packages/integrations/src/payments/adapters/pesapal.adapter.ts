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

interface PesapalCredentials {
  consumerKey: string
  consumerSecret: string
  // PesaPal requires the IPN (webhook) URL to be pre-registered once via
  // POST /URLSetup/RegisterIPN — a one-time setup step outside this adapter's
  // scope (done when the merchant connects the integration). The resulting
  // ipn_id is stored here and referenced on every order submission.
  ipnId: string
  callbackUrl: string // where PesaPal redirects the customer after checkout
  environment: 'sandbox' | 'production'
}

const BASE_URLS: Record<'sandbox' | 'production', string> = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  production: 'https://pay.pesapal.com/v3',
}

async function getAccessToken(baseUrl: string, consumerKey: string, consumerSecret: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`PesaPal auth token request failed (HTTP ${response.status}): ${text}`)
  }
  const data = (await response.json()) as { token?: string; error?: { message?: string } }
  if (!data.token) {
    throw new Error(`PesaPal auth token request rejected: ${data.error?.message ?? 'unknown error'}`)
  }
  return data.token
}

interface TransactionStatus {
  payment_method?: string
  amount?: number
  currency?: string
  confirmation_code?: string
  payment_status_description?: string // 'COMPLETED' | 'FAILED' | 'INVALID' | 'REVERSED' | 'PENDING'
  merchant_reference?: string
  order_tracking_id?: string
  status_code?: number
  message?: string
  error?: { message?: string }
}

async function getTransactionStatus(
  baseUrl: string,
  accessToken: string,
  orderTrackingId: string,
): Promise<TransactionStatus> {
  const response = await fetch(
    `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`PesaPal transaction status request failed (HTTP ${response.status}): ${text}`)
  }
  return (await response.json()) as TransactionStatus
}

export class PesapalAdapter implements PaymentAdapter {
  readonly provider = 'pesapal'

  async initiatePayment(
    input: PaymentInitiateInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    const creds = credentials as unknown as PesapalCredentials
    const baseUrl = BASE_URLS[creds.environment]
    const accessToken = await getAccessToken(baseUrl, creds.consumerKey, creds.consumerSecret)

    // billing_address.email_address is mandatory even when the customer only
    // gave a phone number (mobile-money-via-PesaPal checkout) — same
    // placeholder-email convention used by the Paystack adapter.
    const email = input.customerEmail ?? `noemail+${input.paymentIntentId}@pos.local`

    const response = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        id: input.idempotencyKey, // merchant_reference — must be unique per order
        currency: input.currency,
        // PesaPal's amount field is the face value (e.g. 1200 for KES 1,200) —
        // same whole-currency-unit convention `input.amount` already uses
        // throughout this codebase. No conversion needed here.
        amount: input.amount,
        description: input.description ?? 'Payment',
        callback_url: creds.callbackUrl,
        notification_id: creds.ipnId,
        billing_address: {
          email_address: email,
          ...(input.customerPhone ? { phone_number: input.customerPhone } : {}),
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`PesaPal order submission failed (HTTP ${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      order_tracking_id?: string
      redirect_url?: string
      error?: { message?: string } | null
      status?: string
    }

    if (!data.order_tracking_id || !data.redirect_url) {
      throw new Error(`PesaPal order submission rejected: ${data.error?.message ?? data.status ?? 'unknown error'}`)
    }

    return {
      providerReference: data.order_tracking_id,
      requiresWebhook: true,
      checkoutUrl: data.redirect_url,
      message: 'Redirecting to PesaPal Checkout',
    }
  }

  async verifyWebhook(
    input: PaymentWebhookInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    const creds = credentials as unknown as PesapalCredentials

    // PesaPal's IPN callback carries no HMAC signature — it's a bare
    // notification (OrderTrackingId/OrderMerchantReference/OrderNotificationType)
    // telling the merchant to go look up the real status. The HTTP layer
    // passes that notification through as JSON in rawPayload; the actual
    // trust boundary is the authenticated GetTransactionStatus call below,
    // same pattern as the Flutterwave adapter's server-side re-verification.
    let notification: unknown
    try {
      notification = JSON.parse(input.rawPayload)
    } catch {
      throw new Error('PesaPal webhook payload is not valid JSON')
    }

    const n = notification as { OrderTrackingId?: string; OrderMerchantReference?: string }
    if (!n.OrderTrackingId) {
      throw new Error('PesaPal webhook payload missing OrderTrackingId')
    }

    const baseUrl = BASE_URLS[creds.environment]
    const accessToken = await getAccessToken(baseUrl, creds.consumerKey, creds.consumerSecret)
    const txn = await getTransactionStatus(baseUrl, accessToken, n.OrderTrackingId)

    if (txn.amount === undefined || !txn.currency) {
      throw new Error('PesaPal transaction status response missing amount/currency')
    }

    const status: 'confirmed' | 'failed' = txn.payment_status_description === 'COMPLETED' ? 'confirmed' : 'failed'

    return {
      // The service resolves the real paymentIntentId by looking up
      // payment_intents WHERE provider_reference = order_tracking_id.
      paymentIntentId: n.OrderTrackingId,
      providerReference: txn.confirmation_code || n.OrderTrackingId,
      status,
      amount: Math.round(txn.amount), // already whole currency units, no conversion
      currency: txn.currency,
      paidAt: new Date(),
      metadata: {
        pesapalOrderTrackingId: n.OrderTrackingId,
        pesapalMerchantReference: txn.merchant_reference ?? n.OrderMerchantReference,
        paymentMethod: txn.payment_method,
        statusDescription: txn.payment_status_description,
      },
    }
  }

  async initiateRefund(
    input: PaymentRefundInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    const creds = credentials as unknown as PesapalCredentials

    try {
      const baseUrl = BASE_URLS[creds.environment]
      const accessToken = await getAccessToken(baseUrl, creds.consumerKey, creds.consumerSecret)

      const response = await fetch(`${baseUrl}/api/Transactions/RefundRequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          confirmation_code: input.providerReference,
          amount: input.amount,
          username: 'system',
          remarks: input.reason,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        return {
          requiresManualSettlement: true,
          message: `PesaPal refund request failed (HTTP ${response.status}): ${text}. Process refund manually via the PesaPal merchant dashboard.`,
        }
      }

      const data = (await response.json()) as { status?: string; message?: string }
      if (data.status !== '200') {
        return {
          requiresManualSettlement: true,
          message: `PesaPal refund rejected: ${data.message ?? 'unknown error'}. Process refund manually via the PesaPal merchant dashboard.`,
        }
      }

      return { requiresManualSettlement: false, message: data.message ?? 'Refund request accepted' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        requiresManualSettlement: true,
        message: `PesaPal refund encountered an error: ${message}. Process refund manually via the PesaPal merchant dashboard.`,
      }
    }
  }
}
