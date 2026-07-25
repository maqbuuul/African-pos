import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FlutterwaveAdapter } from './flutterwave.adapter.js'

const CREDENTIALS = {
  secretKey: 'FLWSECK_TEST-abc123',
  webhookSecretHash: 'my-static-hash',
  redirectUrl: 'https://app.example.com/payments/return',
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

describe('FlutterwaveAdapter', () => {
  const adapter = new FlutterwaveAdapter()
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initiatePayment', () => {
    it('sends the whole-currency-unit amount as a decimal string (no cents conversion)', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: 'success', message: 'ok', data: { link: 'https://checkout.flutterwave.com/x' } }),
      )
      await adapter.initiatePayment(INPUT, CREDENTIALS)
      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
      expect(body.amount).toBe('1200.00')
      expect(body.tx_ref).toBe('idem-1')
    })

    it('throws when Flutterwave rejects the initiation', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'error', message: 'Invalid key' }))
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/initiation rejected/)
    })
  })

  describe('verifyWebhook', () => {
    const eventPayload = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        event: 'charge.completed',
        data: {
          id: 555,
          tx_ref: 'idem-1',
          flw_ref: 'FLW-REF-1',
          status: 'successful',
          amount: 1200,
          currency: 'KES',
          created_at: '2026-07-25T10:00:00.000Z',
          meta: { payment_intent_id: 'intent-1', bill_id: 'bill-1', organization_id: 'org-1' },
          ...overrides,
        },
      })

    it('rejects when the verif-hash header does not match the configured secret', async () => {
      await expect(
        adapter.verifyWebhook({ rawPayload: eventPayload(), signature: 'wrong-hash', headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/verif-hash mismatch/)
    })

    it('accepts a matching verif-hash and cross-checks the transaction server-side', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { status: 'successful', amount: 1200, currency: 'KES' } }),
      )
      const result = await adapter.verifyWebhook(
        { rawPayload: eventPayload(), signature: CREDENTIALS.webhookSecretHash, headers: {} },
        CREDENTIALS,
      )
      expect(result.status).toBe('confirmed')
      expect(result.providerReference).toBe('FLW-REF-1')
    })

    it('throws when server-side verification amount does not match the webhook payload', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { status: 'successful', amount: 999, currency: 'KES' } }),
      )
      await expect(
        adapter.verifyWebhook(
          { rawPayload: eventPayload(), signature: CREDENTIALS.webhookSecretHash, headers: {} },
          CREDENTIALS,
        ),
      ).rejects.toThrow(/did not match/)
    })

    it('rejects an event type other than charge.completed', async () => {
      const payload = JSON.stringify({ event: 'transfer.completed', data: {} })
      await expect(
        adapter.verifyWebhook(
          { rawPayload: payload, signature: CREDENTIALS.webhookSecretHash, headers: {} },
          CREDENTIALS,
        ),
      ).rejects.toThrow(/Unhandled Flutterwave event type/)
    })
  })

  describe('initiateRefund', () => {
    it('sends the refund amount as a decimal string', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'success', message: 'Refunded' }))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: '555', amount: 1200, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
      expect(body.amount).toBe('1200.00')
      expect(result.requiresManualSettlement).toBe(false)
    })

    it('falls back to manual settlement when Flutterwave rejects the refund', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'error', message: 'Already refunded' }))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: '555', amount: 1200, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(true)
    })
  })
})
