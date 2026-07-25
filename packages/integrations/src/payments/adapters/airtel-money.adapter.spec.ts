import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AirtelMoneyAdapter } from './airtel-money.adapter.js'

const CREDENTIALS = {
  clientId: 'client-1',
  clientSecret: 'secret-1',
  country: 'KE',
  currency: 'KES',
  environment: 'sandbox' as const,
}

const INPUT = {
  organizationId: 'org-1',
  locationId: 'loc-1',
  billId: 'bill-1',
  paymentIntentId: 'intent-1',
  amount: 1000,
  currency: 'KES',
  idempotencyKey: 'idem-1',
  customerPhone: '0712345678',
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response
}

describe('AirtelMoneyAdapter', () => {
  const adapter = new AirtelMoneyAdapter()
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initiatePayment', () => {
    it('throws when customerPhone is missing', async () => {
      const { customerPhone: _customerPhone, ...inputWithoutPhone } = INPUT
      await expect(adapter.initiatePayment(inputWithoutPhone, CREDENTIALS)).rejects.toThrow(
        /customerPhone is required/,
      )
    })

    it('normalizes a local-format phone number to the msisdn Airtel expects', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          jsonResponse({
            status: { success: true, message: 'ok', response_code: 'SUCCESS' },
            data: { transaction: { id: 'txn-1', status: 'pending' } },
          }),
        )

      await adapter.initiatePayment(INPUT, CREDENTIALS)
      const body = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
      expect(body.subscriber.msisdn).toBe('712345678')
    })

    it('throws when Airtel rejects the request', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(jsonResponse({ status: { success: false, message: 'Insufficient balance' } }))

      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/request rejected/)
    })
  })

  describe('verifyWebhook', () => {
    it('marks status_code TS as confirmed', async () => {
      const payload = JSON.stringify({ transaction: { id: 'txn-1', status_code: 'TS', airtel_money_id: 'am-1' } })
      const result = await adapter.verifyWebhook({ rawPayload: payload, signature: '', headers: {} }, CREDENTIALS)
      expect(result.status).toBe('confirmed')
      expect(result.providerReference).toBe('am-1')
    })

    it('marks any other status_code as failed', async () => {
      const payload = JSON.stringify({ transaction: { id: 'txn-1', status_code: 'TF' } })
      const result = await adapter.verifyWebhook({ rawPayload: payload, signature: '', headers: {} }, CREDENTIALS)
      expect(result.status).toBe('failed')
    })

    it('rejects when a configured callback secret does not match', async () => {
      const payload = JSON.stringify({ transaction: { id: 'txn-1', status_code: 'TS' } })
      await expect(
        adapter.verifyWebhook(
          { rawPayload: payload, signature: '', headers: { 'x-callback-secret': 'wrong' } },
          { ...CREDENTIALS, callbackSecret: 'correct-secret' },
        ),
      ).rejects.toThrow(/callback secret mismatch/)
    })

    it('accepts when the configured callback secret matches', async () => {
      const payload = JSON.stringify({ transaction: { id: 'txn-1', status_code: 'TS' } })
      const result = await adapter.verifyWebhook(
        { rawPayload: payload, signature: '', headers: { 'x-callback-secret': 'correct-secret' } },
        { ...CREDENTIALS, callbackSecret: 'correct-secret' },
      )
      expect(result.status).toBe('confirmed')
    })

    it('throws on a payload missing the transaction structure', async () => {
      await expect(
        adapter.verifyWebhook({ rawPayload: JSON.stringify({}), signature: '', headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/missing expected transaction structure/)
    })
  })

  describe('initiateRefund', () => {
    it('falls back to manual settlement on HTTP failure', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'tok' })).mockResolvedValueOnce(jsonResponse({}, false, 500))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'am-1', amount: 1000, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(true)
    })

    it('succeeds when Airtel confirms the refund', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(jsonResponse({ status: { success: true, message: 'refunded' } }))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'am-1', amount: 1000, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(false)
    })
  })
})
