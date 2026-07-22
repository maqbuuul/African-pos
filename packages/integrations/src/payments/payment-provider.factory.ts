import type { PaymentAdapter } from './payment-adapter.interface.js'
import { CashAdapter } from './adapters/cash.adapter.js'
import { ManualAdapter } from './adapters/manual.adapter.js'
import { MpesaAdapter } from './adapters/mpesa.adapter.js'
import { PaystackAdapter } from './adapters/paystack.adapter.js'

// Singleton instances — adapters are stateless so one instance per provider is fine.
const adapters: Record<string, PaymentAdapter> = {
  none: new CashAdapter(),
  mpesa_daraja: new MpesaAdapter(),
  paystack: new PaystackAdapter(),
  manual: new ManualAdapter(),
}

// Returns the adapter for a given provider string. Throws if the provider is
// not registered — a missing adapter is a programming error, not a user error.
export const getPaymentAdapter = (provider: string): PaymentAdapter => {
  const adapter = adapters[provider]
  if (!adapter) {
    throw new Error(
      `No payment adapter registered for provider: ${provider}. ` +
        `Registered providers: ${Object.keys(adapters).join(', ')}`,
    )
  }
  return adapter
}
