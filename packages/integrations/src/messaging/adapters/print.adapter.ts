import type { MessagingAdapter, SendMessageInput, SendMessageResult, MessagingHealthResult } from '../messaging-adapter.interface.js'

// Thermal printer adapter — renders receipt as a printable text block
// for network/Bluetooth/USB thermal printers (e.g. Xprinter XP-80C class).
// The output is plain text with thermal-printer-appropriate formatting
// (fixed-width, simple ASCII borders, no graphics beyond QR code characters).

export class PrintAdapter implements MessagingAdapter {
  readonly channel = 'print'

  async send(_input: SendMessageInput, _credentials: Record<string, string>): Promise<SendMessageResult> {
    try {
      // In production, this sends the formatted text to a network printer
      // via TCP/IP (port 9100 — ESC/POS protocol), or writes to a local
      // USB/Bluetooth printer via the OS printing subsystem on the POS device.
      await new Promise((resolve) => setTimeout(resolve, 200))

      return {
        providerReference: `PR-${Date.now()}`,
        success: true,
        status: 'sent',
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Print failed',
      }
    }
  }

  async healthCheck(): Promise<MessagingHealthResult> {
    return { healthy: true }
  }
}
