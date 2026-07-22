import type { MessagingAdapter, SendMessageInput, SendMessageResult, MessagingHealthResult } from '../messaging-adapter.interface.js'

// WhatsApp Business API adapter.
// Uses WhatsApp Business API to send receipt messages.
// Per PRD 09: WhatsApp is the default/preferred channel for the target market
// because of its ~98% open rate advantage.

export class WhatsAppAdapter implements MessagingAdapter {
  readonly channel = 'whatsapp'

  async send(_input: SendMessageInput, _credentials: Record<string, string>): Promise<SendMessageResult> {
    try {
      // In production, this calls the WhatsApp Business API:
      // POST /v1/messages with template or text message.
      // For MVP, we simulate a successful send.
      await new Promise((resolve) => setTimeout(resolve, 100))

      return {
        providerReference: `WA-${Date.now()}`,
        success: true,
        status: 'sent',
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'WhatsApp send failed',
      }
    }
  }

  async healthCheck(): Promise<MessagingHealthResult> {
    return { healthy: true }
  }
}
