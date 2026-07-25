import { describe, expect, it } from 'vitest'
import { getPaymentAdapter } from './payment-provider.factory.js'

describe('getPaymentAdapter', () => {
  it.each(['none', 'mpesa_daraja', 'paystack', 'manual', 'airtel_money_api', 'flutterwave', 'pesapal'])(
    'returns an adapter for provider "%s"',
    (provider) => {
      const adapter = getPaymentAdapter(provider)
      expect(adapter.provider).toBe(provider === 'none' ? 'none' : provider)
    },
  )

  it('throws for an unregistered provider', () => {
    expect(() => getPaymentAdapter('stripe')).toThrow(/No payment adapter registered for provider: stripe/)
  })

  it('lists the registered providers in the error message', () => {
    expect(() => getPaymentAdapter('unknown')).toThrow(
      /none, mpesa_daraja, paystack, manual, airtel_money_api, flutterwave, pesapal/,
    )
  })
})
