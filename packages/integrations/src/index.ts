export { getPaymentAdapter } from './payments/payment-provider.factory.js'
export type {
  PaymentAdapter,
  ConnectionCredentials,
  PaymentInitiateInput,
  PaymentInitiateResult,
  PaymentWebhookInput,
  PaymentWebhookResult,
  PaymentRefundInput,
  PaymentRefundResult,
} from './payments/payment-adapter.interface.js'

// M-Pesa C2B (Paybill/Till manual payment) — a separate collection flow from
// the STK Push covered by the generic PaymentAdapter interface, so these are
// exported directly rather than folded into getPaymentAdapter.
export {
  registerMpesaC2BUrls,
  validateC2BPayload,
} from './payments/adapters/mpesa.adapter.js'
export type {
  MpesaCredentials,
  RegisterC2BUrlResult,
  C2BValidationPayload,
  C2BValidationResult,
} from './payments/adapters/mpesa.adapter.js'

export { getTaxAdapter } from './tax/tax-provider.factory.js'
export type {
  TaxAdapter,
  TaxSubmitInput,
  TaxSubmitResult,
} from './tax/tax-adapter.interface.js'

export { getMessagingAdapter } from './messaging/messaging-provider.factory.js'
export type {
  MessagingAdapter,
  SendMessageInput,
  SendMessageResult,
  ReceiptRenderInput,
} from './messaging/messaging-adapter.interface.js'
