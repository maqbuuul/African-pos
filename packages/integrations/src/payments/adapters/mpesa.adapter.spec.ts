import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MpesaAdapter,
  registerMpesaC2BUrls,
  validateC2BPayload,
  type MpesaCredentials,
} from './mpesa.adapter.js'

const CREDENTIALS = {
  consumerKey: 'key',
  consumerSecret: 'secret',
  passkey: 'passkey',
  shortcode: '174379',
  callbackUrl: 'https://api.example.com/webhooks/mpesa_daraja/org-1',
  environment: 'sandbox',
} satisfies MpesaCredentials

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
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

describe('MpesaAdapter', () => {
  const adapter = new MpesaAdapter()
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
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it.each([
      ['0712345678', '254712345678'],
      ['712345678', '254712345678'],
      ['254712345678', '254712345678'],
      ['+254712345678', '254712345678'],
    ])('normalizes phone %s to %s in the STK push request', async (raw, expected) => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          jsonResponse({
            ResponseCode: '0',
            ResponseDescription: 'Success',
            CustomerMessage: 'Check your phone',
            CheckoutRequestID: 'ws_CO_1',
            MerchantRequestID: 'mr_1',
          }),
        )

      await adapter.initiatePayment({ ...INPUT, customerPhone: raw }, CREDENTIALS)

      const stkCall = fetchMock.mock.calls[1]!
      const body = JSON.parse(stkCall[1]!.body as string)
      expect(body.PartyA).toBe(expected)
      expect(body.PhoneNumber).toBe(expected)
    })

    it('rejects an unrecognized phone number format', async () => {
      await expect(
        adapter.initiatePayment({ ...INPUT, customerPhone: 'not-a-phone' }, CREDENTIALS),
      ).rejects.toThrow(/Invalid phone number format/)
    })

    it('returns providerReference + requiresWebhook on success', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          jsonResponse({
            ResponseCode: '0',
            ResponseDescription: 'Success',
            CustomerMessage: 'Check your phone',
            CheckoutRequestID: 'ws_CO_1',
            MerchantRequestID: 'mr_1',
          }),
        )

      const result = await adapter.initiatePayment(INPUT, CREDENTIALS)
      expect(result).toEqual({
        providerReference: 'ws_CO_1',
        requiresWebhook: true,
        message: 'Check your phone',
      })
    })

    it('throws when the OAuth token request fails', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad creds' }, false, 401))
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/OAuth token request failed/)
    })

    it('throws when Daraja rejects the STK push', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          jsonResponse({ ResponseCode: '1', ResponseDescription: 'Insufficient funds', CustomerMessage: '' }),
        )
      await expect(adapter.initiatePayment(INPUT, CREDENTIALS)).rejects.toThrow(/STK Push rejected/)
    })
  })

  describe('verifyWebhook', () => {
    it('parses a successful callback into a confirmed result', async () => {
      const payload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'mr_1',
            CheckoutRequestID: 'ws_CO_1',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1000 },
                { Name: 'MpesaReceiptNumber', Value: 'PGR12345' },
                { Name: 'TransactionDate', Value: 20260725143000 },
                { Name: 'PhoneNumber', Value: 254712345678 },
              ],
            },
          },
        },
      }
      const result = await adapter.verifyWebhook(
        { rawPayload: JSON.stringify(payload), signature: '', headers: {} },
        CREDENTIALS,
      )
      expect(result.status).toBe('confirmed')
      expect(result.providerReference).toBe('PGR12345')
      expect(result.amount).toBe(1000)
    })

    it('marks a non-zero ResultCode as failed', async () => {
      const payload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'mr_1',
            CheckoutRequestID: 'ws_CO_1',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user',
          },
        },
      }
      const result = await adapter.verifyWebhook(
        { rawPayload: JSON.stringify(payload), signature: '', headers: {} },
        CREDENTIALS,
      )
      expect(result.status).toBe('failed')
      expect(result.providerReference).toBe('ws_CO_1')
    })

    it('throws on invalid JSON', async () => {
      await expect(
        adapter.verifyWebhook({ rawPayload: 'not json', signature: '', headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/not valid JSON/)
    })

    it('throws when the payload is missing the stkCallback structure', async () => {
      await expect(
        adapter.verifyWebhook({ rawPayload: JSON.stringify({}), signature: '', headers: {} }, CREDENTIALS),
      ).rejects.toThrow(/missing expected Body.stkCallback/)
    })
  })

  describe('initiateRefund', () => {
    it('falls back to manual settlement when reversal credentials are absent', async () => {
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'PGR12345', amount: 1000, currency: 'KES', reason: 'refund' },
        CREDENTIALS,
      )
      expect(result.requiresManualSettlement).toBe(true)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reverses successfully when reversal credentials are present', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(jsonResponse({ ResponseCode: '0', ResponseDescription: 'Accepted' }))

      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'PGR12345', amount: 1000, currency: 'KES', reason: 'refund' },
        { ...CREDENTIALS, initiator: 'testapi', securityCredential: 'enc-cred' },
      )
      expect(result.requiresManualSettlement).toBe(false)
    })

    it('falls back to manual settlement when the reversal is rejected', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(jsonResponse({ ResponseCode: '1', ResponseDescription: 'Reversal window expired' }))

      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'PGR12345', amount: 1000, currency: 'KES', reason: 'refund' },
        { ...CREDENTIALS, initiator: 'testapi', securityCredential: 'enc-cred' },
      )
      expect(result.requiresManualSettlement).toBe(true)
    })

    it('falls back to manual settlement on network error instead of throwing', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))
      const result = await adapter.initiateRefund(
        { paymentId: 'p1', providerReference: 'PGR12345', amount: 1000, currency: 'KES', reason: 'refund' },
        { ...CREDENTIALS, initiator: 'testapi', securityCredential: 'enc-cred' },
      )
      expect(result.requiresManualSettlement).toBe(true)
    })
  })
})

describe('registerMpesaC2BUrls', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers validation + confirmation URLs successfully', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ ResponseCode: '0', ResponseDescription: 'success' }))

    const result = await registerMpesaC2BUrls(
      CREDENTIALS,
      'https://api.example.com/webhooks/mpesa/c2b/validation/org-1',
      'https://api.example.com/webhooks/mpesa/c2b/confirmation/org-1',
    )
    expect(result.responseCode).toBe('0')
  })

  it('throws when Daraja rejects the URL registration', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ ResponseCode: '1', ResponseDescription: 'invalid shortcode' }))

    await expect(
      registerMpesaC2BUrls(CREDENTIALS, 'https://api.example.com/v', 'https://api.example.com/c'),
    ).rejects.toThrow(/Register URL rejected/)
  })
})

describe('validateC2BPayload', () => {
  it('accepts a well-formed C2B payload', () => {
    const result = validateC2BPayload({
      TransID: 'OEI2AK4Q16',
      TransAmount: '500.00',
      MSISDN: '254712345678',
    })
    expect(result.resultCode).toBe('0')
  })

  it('rejects a payload missing TransID', () => {
    const result = validateC2BPayload({ TransAmount: '500.00', MSISDN: '254712345678' })
    expect(result.resultCode).toBe('C2B00011')
  })

  it('rejects a payload with a non-positive amount', () => {
    const result = validateC2BPayload({ TransID: 'x', TransAmount: '0', MSISDN: '254712345678' })
    expect(result.resultCode).toBe('C2B00011')
  })

  it('rejects a payload missing MSISDN', () => {
    const result = validateC2BPayload({ TransID: 'x', TransAmount: '500.00' })
    expect(result.resultCode).toBe('C2B00011')
  })
})
