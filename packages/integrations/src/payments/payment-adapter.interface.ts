// Credentials passed per-call — the adapter is stateless. The caller
// (PaymentsService) decrypts credentials from integration_connections and
// passes them here. Shape varies per provider — adapters cast to their own
// internal type.
export interface ConnectionCredentials {
  [key: string]: string | number | boolean | undefined
}

export interface PaymentInitiateInput {
  organizationId: string
  locationId: string
  billId: string
  paymentIntentId: string
  amount: number // integer, smallest currency unit (e.g. KES cents/fils)
  currency: string // ISO 4217, 3 chars
  idempotencyKey: string // prevents double-charge on retry
  customerPhone?: string // required for M-Pesa STK push
  customerEmail?: string // optional, used by Paystack email receipts
  description?: string
}

export interface PaymentInitiateResult {
  providerReference?: string // M-Pesa checkout request ID / Paystack reference
  requiresWebhook: boolean // false = immediately confirmed (cash/manual)
  checkoutUrl?: string // Paystack authorization_url for card checkout
  message?: string // Human-readable status for cashier UI
}

export interface PaymentWebhookInput {
  rawPayload: string // raw request body as string (for signature verification)
  signature: string // header value
  headers: Record<string, string | string[] | undefined>
}

export interface PaymentWebhookResult {
  paymentIntentId: string // resolved from provider callback metadata
  providerReference: string
  status: 'confirmed' | 'failed'
  amount: number
  currency: string
  paidAt: Date
  metadata?: Record<string, unknown>
}

export interface PaymentRefundInput {
  paymentId: string
  providerReference: string
  amount: number
  currency: string
  reason: string
}

export interface PaymentRefundResult {
  providerReference?: string
  requiresManualSettlement: boolean
  message?: string
}

export interface PaymentAdapter {
  readonly provider: string // must match PaymentProviderSchema value

  // Initiates payment: STK push for M-Pesa, transaction initialize for
  // Paystack, immediate confirm for cash/manual. Returns whether a webhook
  // is needed before the bill can be marked paid.
  initiatePayment(
    input: PaymentInitiateInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult>

  // Verifies the webhook signature and parses the provider callback payload.
  // Only called for providers where requiresWebhook=true.
  verifyWebhook(
    input: PaymentWebhookInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult>

  // Initiates a refund. Cash refunds return requiresManualSettlement=true
  // immediately (cash out at shift close, PRD 08). M-Pesa reversal window
  // is short; failed reversals must also set requiresManualSettlement=true.
  initiateRefund(
    input: PaymentRefundInput,
    credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult>
}
