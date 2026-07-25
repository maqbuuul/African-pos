import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { bills } from '@hospitality-os/database'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createBillFixture, deleteBillFixture, systemDb, testActorContext, type BillFixture } from '../../test/fixtures.js'
import { WhatsAppReportsService } from './whatsapp-reports.service.js'

describe('WhatsAppReportsService (integration)', () => {
  let moduleRef: TestingModule
  let service: WhatsAppReportsService
  let fixture: BillFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    service = moduleRef.get(WhatsAppReportsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    fixture = await createBillFixture({ totalAmount: 5000 }) // KES 5,000 — whole-unit convention throughout this codebase
  })

  afterEach(async () => {
    await deleteBillFixture(fixture)
  })

  describe('handleCommand', () => {
    it('HELP lists the available commands', async () => {
      const authContext = testActorContext(fixture)
      const result = await service.handleCommand(authContext, fixture.locationId, 'HELP')
      expect(result.text).toContain('SALES')
      expect(result.text).toContain('STOCK')
    })

    it('an unknown command returns a helpful fallback, not an error', async () => {
      const authContext = testActorContext(fixture)
      const result = await service.handleCommand(authContext, fixture.locationId, 'BANANA')
      expect(result.text).toContain('Unknown command')
    })

    it('is case-insensitive on the command word', async () => {
      const authContext = testActorContext(fixture)
      const result = await service.handleCommand(authContext, fixture.locationId, 'help')
      expect(result.text).toContain('Commands:')
    })

    it("SALES reports today's paid revenue in whole KES, matching this codebase's whole-currency-unit convention", async () => {
      const authContext = testActorContext(fixture)
      await systemDb.update(bills).set({ status: 'paid', paidAt: new Date() }).where(eq(bills.id, fixture.billId))

      const result = await service.handleCommand(authContext, fixture.locationId, 'SALES')
      // bills.totalAmount is 5000 whole KES (same convention verified against
      // M-Pesa's own Daraja Amount field elsewhere in this codebase) — the
      // report text must show KSh 5,000, not KSh 50 (a /100 cents-style
      // conversion bug would produce the latter).
      expect(result.text).toContain('KSh 5,000')
      expect(result.text).not.toContain('KSh 50\n')
    })

    it('STOCK reports "all healthy" when nothing is below its reorder point', async () => {
      const authContext = testActorContext(fixture)
      const result = await service.handleCommand(authContext, fixture.locationId, 'STOCK')
      expect(result.text).toContain('healthy')
    })
  })
})
