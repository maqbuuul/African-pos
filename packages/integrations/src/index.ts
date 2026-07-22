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
