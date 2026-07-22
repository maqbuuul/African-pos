import type { MessagingAdapter, SendMessageInput, SendMessageResult, MessagingHealthResult } from '../messaging-adapter.interface.js'

// SMS adapter — fallback channel for receipt delivery when WhatsApp is
// unavailable or the customer prefers SMS.

export class SmsAdapter implements MessagingAdapter {
  readonly channel = 'sms'

  async send(input: SendMessageInput, _credentials: Record<string, string>): Promise<SendMessageResult> {
    try {
      // In production, this calls an SMS provider API (e.g. Africa's Talking, Twilio).
      await new Promise((resolve) => setTimeout(resolve, 100))

      return {
        providerReference: `SMS-${Date.now()}`,
        success: true,
        status: 'sent',
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'SMS send failed',
      }
    }
  }

  async healthCheck(): Promise<MessagingHealthResult> {
    return { healthy: true }
  }
}
