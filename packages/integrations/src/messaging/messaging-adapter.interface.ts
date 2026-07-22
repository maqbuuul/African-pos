// Messaging adapter interface — pluggable per channel (WhatsApp, SMS, Email, Print).
// Same adapter pattern as payments and tax — stateless, credentials passed per call.

export interface SendMessageInput {
  to: string        // phone number, email address, or printer identifier
  subject?: string  // email subject
  body: string      // message body (plain text for SMS/print, HTML for email)
  attachments?: Array<{
    filename: string
    content: string // base64-encoded content
    contentType: string
  }>
}

export interface SendMessageResult {
  providerReference?: string
  success: boolean
  status: 'sent' | 'delivered' | 'failed'
  errorMessage?: string
}

export interface MessagingHealthResult {
  healthy: boolean
  message?: string
}

export interface ReceiptRenderInput {
  businessName: string
  businessAddress?: string | undefined
  kraPin?: string | undefined
  etrSerial?: string | undefined
  receiptNumber: string
  orderNumber?: string | undefined
  staffName?: string | undefined
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  subtotalAmount: number
  discountAmount: number
  taxAmount: number
  serviceChargeAmount: number
  tipAmount: number
  totalAmount: number
  currency: string
  payments: Array<{
    method: string
    amount: number
    reference: string | undefined
  }>
  paidAt: string | Date
  qrCodeData?: string | undefined
}

export interface MessagingAdapter {
  readonly channel: 'whatsapp' | 'sms' | 'email' | 'print'

  send(input: SendMessageInput, credentials: Record<string, string>): Promise<SendMessageResult>

  healthCheck(): Promise<MessagingHealthResult>
}
