import type { PaymentAdapter } from './payment-adapter.interface.js'
import { AirtelMoneyAdapter } from './adapters/airtel-money.adapter.js'
import { CashAdapter } from './adapters/cash.adapter.js'
import { FlutterwaveAdapter } from './adapters/flutterwave.adapter.js'
import { ManualAdapter } from './adapters/manual.adapter.js'
import { MpesaAdapter } from './adapters/mpesa.adapter.js'
import { PaystackAdapter } from './adapters/paystack.adapter.js'
import { PesapalAdapter } from './adapters/pesapal.adapter.js'

// Singleton instances — adapters are stateless so one instance per provider is fine.
// No Stripe: not a meaningful acquirer for African merchants (no local card
// scheme/mobile-money settlement, no African bank payout rails) — removed
// 2026-07-25 rather than left as dead weight.
const adapters: Record<string, PaymentAdapter> = {
  none: new CashAdapter(),
  mpesa_daraja: new MpesaAdapter(),
  paystack: new PaystackAdapter(),
  manual: new ManualAdapter(),
  airtel_money_api: new AirtelMoneyAdapter(),
  flutterwave: new FlutterwaveAdapter(),
  pesapal: new PesapalAdapter(),
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
