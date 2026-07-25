import { describe, expect, it } from 'vitest'
import { ManualAdapter } from './manual.adapter.js'

const INPUT = {
  organizationId: 'org-1',
  locationId: 'loc-1',
  billId: 'bill-1',
  paymentIntentId: 'intent-1',
  amount: 1000,
  currency: 'KES',
  idempotencyKey: 'idem-1',
}

describe('ManualAdapter', () => {
  const adapter = new ManualAdapter()

  it('confirms immediately without requiring a webhook', async () => {
    const result = await adapter.initiatePayment(INPUT, {})
    expect(result.requiresWebhook).toBe(false)
  })

  it('rejects verifyWebhook since manual payments never receive one', async () => {
    await expect(
      adapter.verifyWebhook({ rawPayload: '{}', signature: '', headers: {} }, {}),
    ).rejects.toThrow(/do not use webhooks/)
  })

  it('flags refunds for manual out-of-band settlement', async () => {
    const result = await adapter.initiateRefund(
      { paymentId: 'p1', providerReference: '', amount: 500, currency: 'KES', reason: 'customer request' },
      {},
    )
    expect(result.requiresManualSettlement).toBe(true)
  })
})
