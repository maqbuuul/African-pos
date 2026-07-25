import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaystackAdapter } from './paystack.adapter.js'

const SECRET_KEY = 'sk_test_abc123'
const CREDENTIALS = { secretKey: SECRET_KEY }

const INPUT = {
  organizationId: 'org-1',
  locationId: 'loc-1',
  billId: 'bill-1',
  paymentIntentId: 'intent-1',
  amount: 1000,
  currency: 'KES',
  idempotencyKey: 'idem-1',
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response
}

function sign(payload: string, secret = SECRET_KEY): string {
  return createHmac('sha512', secret).update(payload).digest('hex')
}

describe('PaystackAdapter', () => {
  const adapter = new PaystackAdapter()
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initiatePayment', () => {
    it('uses the idempotency key as the Paystack reference and generates a placeholder email if none given', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          status: true,
          message: 'Authorization URL created',
          data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'abc', reference: 'idem-1' },
        }),
      )

      const result = await adapter.initiatePayment(INPUT, CREDENTIALS)
      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
      expect(body.reference).toBe('idem-1')
      expect(body.email).toMatch(/^noemail\+intent-1@pos\.local$/)
      expect(result.checkoutUrl).toBe('https://checkout.paystack.com/abc')
      expect(result.requiresWebhook).toBe(true)
    })

    it('throws when Paystack rejects initialization', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: false, message: 'Invalid key' }))
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/initialization rejected/)
    })

    it('throws on an HTTP failure', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500))
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/initialize failed/)
    })
  })

  describe('verifyWebhook', () => {
    const successPayload = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'idem-1',
        status: 'success',
        amount: 1000,
        currency: 'KES',
        paid_at: '2026-07-25T10:00:00.000Z',
        metadata: { payment_intent_id: 'intent-1', bill_id: 'bill-1', organization_id: 'org-1' },
      },
    })

    it('accepts a correctly signed charge.success event', async () => {
      const result = await adapter.verifyWebhook(
        { rawPayload: successPayload, signature: sign(successPayload), headers: {} },
        CREDENTIALS,
      )
      expect(result.status).toBe('confirmed')
      expect(result.paymentIntentId).toBe('intent-1')
    })

    it('rejects a payload with an invalid signature', async () => {
      await expect(
        adapter.verifyWebhook({ rawPayload: successPayload, signature: 'deadbeef', headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/signature verification failed/)
    })

    it('rejects a payload signed with the wrong secret', async () => {
      const wrongSignature = sign(successPayload, 'sk_test_wrongkey')
      await expect(
        adapter.verifyWebhook({ rawPayload: successPayload, signature: wrongSignature, headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/signature verification failed/)
    })

    it('rejects an event type other than charge.success', async () => {
      const payload = JSON.stringify({ event: 'charge.failed', data: {} })
      await expect(
        adapter.verifyWebhook({ rawPayload: payload, signature: sign(payload), headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/Unhandled Paystack event type/)
    })

    it('throws when metadata is missing payment_intent_id', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        data: { reference: 'idem-1', status: 'success', amount: 1000, currency: 'KES', paid_at: '2026-07-25T10:00:00.000Z', metadata: {} },
      })
      await expect(
        adapter.verifyWebhook({ rawPayload: payload, signature: sign(payload), headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/missing payment_intent_id/)
    })
  })

  describe('initiateRefund', () => {
    it('succeeds and returns the refund id as providerReference', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: true, message: 'Refund queued', data: { id: 999, status: 'processing' } }),
      )
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'idem-1', amount: 1000, currency: 'KES', reason: 'customer request' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(false)
      expect(result.providerReference).toBe('999')
    })

    it('falls back to manual settlement on HTTP failure', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'idem-1', amount: 1000, currency: 'KES', reason: 'customer request' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(true)
    })

    it('falls back to manual settlement when Paystack rejects the refund', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: false, message: 'Refunds not enabled' }))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'idem-1', amount: 1000, currency: 'KES', reason: 'customer request' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(true)
    })
  })
})
