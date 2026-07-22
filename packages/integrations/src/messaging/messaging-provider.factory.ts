import type { MessagingAdapter } from './messaging-adapter.interface.js'
import { WhatsAppAdapter } from './adapters/whatsapp.adapter.js'
import { SmsAdapter } from './adapters/sms.adapter.js'
import { EmailAdapter } from './adapters/email.adapter.js'
import { PrintAdapter } from './adapters/print.adapter.js'

const adapters = new Map<string, MessagingAdapter>()

export const getMessagingAdapter = (channel: string): MessagingAdapter => {
  let adapter = adapters.get(channel)
  if (adapter) return adapter

  switch (channel) {
    case 'whatsapp':
      adapter = new WhatsAppAdapter()
      break
    case 'sms':
      adapter = new SmsAdapter()
      break
    case 'email':
      adapter = new EmailAdapter()
      break
    case 'print':
      adapter = new PrintAdapter()
      break
    default:
      throw new Error(`Unknown messaging channel: ${channel}`)
  }

  adapters.set(channel, adapter)
  return adapter
}
