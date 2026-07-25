import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PesapalAdapter } from './pesapal.adapter.js'

const CREDENTIALS = {
  consumerKey: 'consumer-key',
  consumerSecret: 'consumer-secret',
  ipnId: 'ipn-1',
  callbackUrl: 'https://app.example.com/payments/return',
  environment: 'sandbox' as const,
}

const INPUT = {
  organizationId: 'org-1',
  locationId: 'loc-1',
  billId: 'bill-1',
  paymentIntentId: 'intent-1',
  amount: 1200,
  currency: 'KES',
  idempotencyKey: 'idem-1',
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response
}

describe('PesapalAdapter', () => {
  const adapter = new PesapalAdapter()
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initiatePayment', () => {
    it('submits the order and returns the checkout redirect URL', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'auth-tok' }))
        .mockResolvedValueOnce(
          jsonResponse({ order_tracking_id: 'ot-1', redirect_url: 'https://pay.pesapal.com/checkout/ot-1' }),
        )
      const result = await adapter.initiatePayment(INPUT, CREDENTIALS)
      expect(result.providerReference).toBe('ot-1')
      expect(result.checkoutUrl).toBe('https://pay.pesapal.com/checkout/ot-1')

      const orderBody = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
      expect(orderBody.id).toBe('idem-1')
      expect(orderBody.amount).toBe(1200) // whole currency units, no conversion
      expect(orderBody.notification_id).toBe('ipn-1')
    })

    it('throws when the auth token request fails', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 401))
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/auth token request failed/)
    })

    it('throws when PesaPal rejects the order submission', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'auth-tok' }))
        .mockResolvedValueOnce(jsonResponse({ error: { message: 'invalid ipn_id' }, status: '500' }))
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/order submission rejected/)
    })
  })

  describe('verifyWebhook', () => {
    it('re-fetches transaction status and confirms on COMPLETED', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'auth-tok' }))
        .mockResolvedValueOnce(
          jsonResponse({
            amount: 1200,
            currency: 'KES',
            confirmation_code: 'conf-1',
            payment_status_description: 'COMPLETED',
          }),
        )
      const payload = JSON.stringify({ OrderTrackingId: 'ot-1', OrderMerchantReference: 'idem-1' })
      const result = await adapter.verifyWebhook({ rawPayload: payload, signature: '', headers: {} }, CREDENTIALS)
      expect(result.status).toBe('confirmed')
      expect(result.providerReference).toBe('conf-1')
    })

    it('marks anything other than COMPLETED as failed', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'auth-tok' }))
        .mockResolvedValueOnce(
          jsonResponse({ amount: 1200, currency: 'KES', payment_status_description: 'FAILED' }),
        )
      const payload = JSON.stringify({ OrderTrackingId: 'ot-1' })
      const result = await adapter.verifyWebhook({ rawPayload: payload, signature: '', headers: {} }, CREDENTIALS)
      expect(result.status).toBe('failed')
    })

    it('throws when the notification is missing OrderTrackingId', async () => {
      await expect(
        adapter.verifyWebhook({ rawPayload: JSON.stringify({}), signature: '', headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/missing OrderTrackingId/)
    })
  })

  describe('initiateRefund', () => {
    it('succeeds when PesaPal accepts the refund', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'auth-tok' }))
        .mockResolvedValueOnce(jsonResponse({ status: '200', message: 'Refund accepted' }))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'conf-1', amount: 1200, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(false)
    })

    it('falls back to manual settlement when PesaPal rejects the refund', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: 'auth-tok' }))
        .mockResolvedValueOnce(jsonResponse({ status: '500', message: 'Already refunded' }))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'conf-1', amount: 1200, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(true)
    })
  })
})
