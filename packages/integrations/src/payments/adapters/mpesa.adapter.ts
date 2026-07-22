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

interface MpesaCredentials {
  consumerKey: string
  consumerSecret: string
  passkey: string
  shortcode: string
  callbackUrl: string
  environment: 'sandbox' | 'production'
}

// Reversal requires extra Daraja B2B/API operator credentials beyond the
// basic STK push set. Provisioned separately by the merchant.
interface MpesaReversalCredentials extends MpesaCredentials {
  initiator: string
  securityCredential: string
}

const BASE_URLS: Record<'sandbox' | 'production', string> = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
}

// Daraja timestamp format: YYYYMMDDHHmmss (local time on the API host).
function getTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  )
}

// Daraja STK push password = base64(shortcode + passkey + timestamp).
// btoa is available globally in Node 16+ and is typed via the DOM lib.
function buildPassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(shortcode + passkey + timestamp)
}

// Normalise Kenyan phone numbers to Safaricom's required 2547XXXXXXXX format.
// Accepts: 07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX (Safaricom/07
// prefix) and Airtel/0110... numbers (254110...).
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '').replace(/^\+/, '')
  // 07XXXXXXXX → 2547XXXXXXXX
  if (/^0\d{9}$/.test(cleaned)) {
    return '254' + cleaned.slice(1)
  }
  // Already international without the leading +
  if (/^254\d{9}$/.test(cleaned)) {
    return cleaned
  }
  throw new Error(
    `Invalid phone number format: "${phone}". ` +
      `Expected Kenyan number as 07XXXXXXXX or 2547XXXXXXXX.`,
  )
}

async function getAccessToken(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<string> {
  // Daraja OAuth uses HTTP Basic auth: base64("key:secret").
  const basicAuth = btoa(`${consumerKey}:${consumerSecret}`)
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${basicAuth}` },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`M-Pesa OAuth token request failed (HTTP ${response.status}): ${text}`)
  }
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

export class MpesaAdapter implements PaymentAdapter {
  readonly provider = 'mpesa_daraja'

  async initiatePayment(
    input: PaymentInitiateInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    const creds = credentials as unknown as MpesaCredentials

    if (!input.customerPhone) {
      throw new Error('customerPhone is required for M-Pesa STK Push')
    }

    const phone = formatPhone(input.customerPhone)
    const baseUrl = BASE_URLS[creds.environment]
    const timestamp = getTimestamp()
    const password = buildPassword(creds.shortcode, creds.passkey, timestamp)
    const accessToken = await getAccessToken(baseUrl, creds.consumerKey, creds.consumerSecret)

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: creds.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: input.amount,
        PartyA: phone,
        PartyB: creds.shortcode,
        PhoneNumber: phone,
        CallBackURL: creds.callbackUrl,
        AccountReference: input.paymentIntentId,
        TransactionDesc: input.description ?? 'Payment',
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`M-Pesa STK Push request failed (HTTP ${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      ResponseCode: string
      ResponseDescription: string
      CustomerMessage: string
      CheckoutRequestID: string
      MerchantRequestID: string
    }

    if (data.ResponseCode !== '0') {
      throw new Error(`M-Pesa STK Push rejected: ${data.ResponseDescription}`)
    }

    return {
      providerReference: data.CheckoutRequestID,
      requiresWebhook: true,
      message: data.CustomerMessage,
    }
  }

  async verifyWebhook(
    input: PaymentWebhookInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    // Daraja does NOT sign callbacks with HMAC — authentication in production
    // relies on IP allowlisting configured in the Daraja portal. We validate
    // payload structure only.
    let parsed: unknown
    try {
      parsed = JSON.parse(input.rawPayload)
    } catch {
      throw new Error('M-Pesa webhook payload is not valid JSON')
    }

    const stkCallback = (
      parsed as { Body?: { stkCallback?: unknown } } | undefined
    )?.Body?.stkCallback as
      | {
          MerchantRequestID: string
          CheckoutRequestID: string
          ResultCode: number
          ResultDesc: string
          CallbackMetadata?: {
            Item: Array<{ Name: string; Value: string | number }>
          }
        }
      | undefined

    if (!stkCallback?.CheckoutRequestID) {
      throw new Error('M-Pesa webhook payload missing expected Body.stkCallback structure')
    }

    const status: 'confirmed' | 'failed' = stkCallback.ResultCode === 0 ? 'confirmed' : 'failed'

    // CallbackMetadata is only present when ResultCode === 0 (success).
    const items = stkCallback.CallbackMetadata?.Item ?? []
    const getMeta = (name: string) => items.find((item) => item.Name === name)?.Value

    const rawAmount = getMeta('Amount')
    const receiptNumber = getMeta('MpesaReceiptNumber')
    const transactionDate = getMeta('TransactionDate')
    const phoneNumber = getMeta('PhoneNumber')

    // TransactionDate format from Safaricom: YYYYMMDDHHmmss as a number.
    let paidAt = new Date()
    if (typeof transactionDate === 'number') {
      const s = String(transactionDate)
      paidAt = new Date(
        parseInt(s.slice(0, 4), 10),
        parseInt(s.slice(4, 6), 10) - 1, // month is 0-indexed
        parseInt(s.slice(6, 8), 10),
        parseInt(s.slice(8, 10), 10),
        parseInt(s.slice(10, 12), 10),
        parseInt(s.slice(12, 14), 10),
      )
    }

    return {
      // The service resolves the real paymentIntentId by querying
      // payment_intents WHERE provider_reference = CheckoutRequestID. The
      // adapter returns CheckoutRequestID here as the lookup key.
      paymentIntentId: stkCallback.CheckoutRequestID,
      // After a successful STK push the M-Pesa receipt number (e.g. "PGR1234")
      // is the canonical payment reference; fall back to CheckoutRequestID on
      // failure where no receipt is issued.
      providerReference: receiptNumber ? String(receiptNumber) : stkCallback.CheckoutRequestID,
      status,
      amount: typeof rawAmount === 'number' ? rawAmount : 0,
      currency: 'KES',
      paidAt,
      metadata: {
        checkoutRequestId: stkCallback.CheckoutRequestID,
        merchantRequestId: stkCallback.MerchantRequestID,
        resultCode: stkCallback.ResultCode,
        resultDesc: stkCallback.ResultDesc,
        mpesaReceiptNumber: receiptNumber,
        phoneNumber,
      },
    }
  }

  async initiateRefund(
    input: PaymentRefundInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    const creds = credentials as unknown as Partial<MpesaReversalCredentials> & MpesaCredentials

    // Daraja reversal requires an API operator Initiator + SecurityCredential
    // that are provisioned separately from the STK push credentials. If absent,
    // fall back to manual settlement immediately — do not expose this as an
    // error because the merchant may legitimately not have reversal enabled.
    if (!creds.initiator || !creds.securityCredential) {
      return {
        requiresManualSettlement: true,
        message:
          'M-Pesa reversal requires initiator credentials not present in the connection config. ' +
          'Process the refund manually via the Safaricom Business Portal or contact Safaricom support.',
      }
    }

    const baseUrl = BASE_URLS[creds.environment]

    try {
      const accessToken = await getAccessToken(baseUrl, creds.consumerKey, creds.consumerSecret)

      const response = await fetch(`${baseUrl}/mpesa/reversal/v1/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Initiator: creds.initiator,
          SecurityCredential: creds.securityCredential,
          CommandID: 'TransactionReversal',
          TransactionID: input.providerReference, // M-Pesa receipt number
          Amount: input.amount,
          ReceiverParty: creds.shortcode,
          RecieverIdentifierType: '4', // shortcode type (Daraja docs typo preserved)
          ResultURL: creds.callbackUrl,
          QueueTimeOutURL: creds.callbackUrl,
          Remarks: input.reason,
          Occasion: '',
        }),
      })

      if (!response.ok) {
        return {
          requiresManualSettlement: true,
          message: `M-Pesa reversal request failed (HTTP ${response.status}). Process refund manually via Safaricom Business Portal.`,
        }
      }

      const data = (await response.json()) as {
        ResponseCode?: string
        ResponseDescription?: string
      }

      if (data.ResponseCode !== '0') {
        return {
          requiresManualSettlement: true,
          message: `M-Pesa reversal rejected: ${data.ResponseDescription ?? 'unknown error'}. Process refund manually.`,
        }
      }

      return {
        requiresManualSettlement: false,
        // Omit message entirely if Daraja returns undefined to satisfy
        // exactOptionalPropertyTypes — the property must be absent, not undefined.
        ...(data.ResponseDescription !== undefined && { message: data.ResponseDescription }),
      }
    } catch (err) {
      // Network or parse failure — M-Pesa reversal window is short; don't
      // surface a hard error, instead flag for manual settlement.
      const message = err instanceof Error ? err.message : String(err)
      return {
        requiresManualSettlement: true,
        message: `M-Pesa reversal encountered an error: ${message}. Process refund manually via Safaricom Business Portal.`,
      }
    }
  }
}
