import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createBillFixture, deleteBillFixture, testActorContext, type BillFixture } from '../../test/fixtures.js'
import { ReceiptsService } from './receipts.service.js'

let capturedBody = ''
vi.mock('@hospitality-os/integrations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hospitality-os/integrations')>()
  return {
    ...actual,
    getMessagingAdapter: (channel: string) => ({
      channel,
      send: async (input: { to: string; body: string }) => {
        capturedBody = input.body
        return { providerReference: 'TEST-REF', success: true, status: 'sent' as const }
      },
      healthCheck: async () => ({ healthy: true }),
    }),
  }
})

describe('ReceiptsService (integration)', () => {
  let moduleRef: TestingModule
  let receiptsService: ReceiptsService
  let fixture: BillFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    receiptsService = moduleRef.get(ReceiptsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    fixture = await createBillFixture({ totalAmount: 12_300 }) // KES 12,300 — whole-unit convention
    capturedBody = ''
  })

  afterEach(async () => {
    await deleteBillFixture(fixture)
  })

  describe('generate', () => {
    it('stores a receipt with a sequential RCP-#### number and the bill total in whole currency units', async () => {
      const authContext = testActorContext(fixture)
      const receipt = await receiptsService.generate(authContext, fixture.billId)
      expect(receipt.receiptNumber).toMatch(/^RCP-\d{4}$/)
      expect((receipt.content as { totalAmount: number }).totalAmount).toBe(12_300)
    })
  })

  describe('send', () => {
    it('renders the receipt text in whole currency units, not divided by 100', async () => {
      const authContext = testActorContext(fixture)
      const receipt = await receiptsService.generate(authContext, fixture.billId)

      const result = await receiptsService.send(authContext, receipt.id, { channels: ['print'] })
      expect(result.isDelivered).toBe(true)

      // bills.totalAmount is already whole KES (same convention verified
      // against M-Pesa's own Daraja Amount field elsewhere in this
      // codebase) — the printed receipt must show 12300.00, not 123.00 (a
      // stray /100 cents-style conversion bug would produce the latter).
      expect(capturedBody).toContain('12300.00')
      expect(capturedBody).not.toContain('123.00')
    })

    it('a channel with no delivery target (e.g. email with no address given) is marked failed, not thrown', async () => {
      const authContext = testActorContext(fixture)
      const receipt = await receiptsService.generate(authContext, fixture.billId)

      const result = await receiptsService.send(authContext, receipt.id, { channels: ['email'] })
      expect(result.deliveryResults.email).toBe('failed')
      expect(result.isDelivered).toBe(false)
    })

    it('marks isDelivered true once at least one channel succeeds', async () => {
      const authContext = testActorContext(fixture)
      const receipt = await receiptsService.generate(authContext, fixture.billId)

      const result = await receiptsService.send(authContext, receipt.id, { channels: ['print'] })
      expect(result.isDelivered).toBe(true)

      const status = await receiptsService.getStatus(authContext, receipt.id)
      expect(status.isDelivered).toBe(true)
      expect(status.deliveredAt).not.toBeNull()
    })
  })

  describe('notification preferences', () => {
    it('creates preferences on first update, then updates them in place on a second call', async () => {
      const authContext = testActorContext(fixture)
      const subjectId = randomUUID()

      const created = await receiptsService.updatePreferences(authContext, { optedOut: false }, 'customer', subjectId)
      expect(created?.optedOut).toBe(false)

      const updated = await receiptsService.updatePreferences(authContext, { optedOut: true }, 'customer', subjectId)
      expect(updated?.optedOut).toBe(true)
      expect(updated?.id).toBe(created?.id)

      const fetched = await receiptsService.getPreferences(authContext, 'customer', subjectId)
      expect(fetched?.optedOut).toBe(true)
    })

    it('getPreferences returns null when none have been set', async () => {
      const authContext = testActorContext(fixture)
      const result = await receiptsService.getPreferences(authContext, 'staff', randomUUID())
      expect(result).toBeNull()
    })
  })

  describe('submitToTaxAuthority', () => {
    it('submits to KRA eTIMS for a Kenyan location and records the submission', async () => {
      const authContext = testActorContext(fixture)
      const receipt = await receiptsService.generate(authContext, fixture.billId)

      const submission = await receiptsService.submitToTaxAuthority(authContext, receipt.id)
      expect(submission?.provider).toBe('kra_etims')
      expect(submission?.country).toBe('KE')
    })
  })

  describe('getStatus', () => {
    it('rejects a receipt id that does not exist', async () => {
      const authContext = testActorContext(fixture)
      await expect(receiptsService.getStatus(authContext, randomUUID())).rejects.toMatchObject({
        response: { code: 'receipt_not_found' },
      })
    })
  })
})
