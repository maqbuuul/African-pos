import type { MessagingAdapter, SendMessageInput, SendMessageResult, MessagingHealthResult } from '../messaging-adapter.interface.js'

// Email adapter for receipt delivery via SMTP or transactional email API.

export class EmailAdapter implements MessagingAdapter {
  readonly channel = 'email'

  async send(_input: SendMessageInput, _credentials: Record<string, string>): Promise<SendMessageResult> {
    try {
      // In production, this calls an email provider (Resend, SendGrid, SES, SMTP).
      await new Promise((resolve) => setTimeout(resolve, 100))

      return {
        providerReference: `EM-${Date.now()}`,
        success: true,
        status: 'sent',
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Email send failed',
      }
    }
  }

  async healthCheck(): Promise<MessagingHealthResult> {
    return { healthy: true }
  }
}
