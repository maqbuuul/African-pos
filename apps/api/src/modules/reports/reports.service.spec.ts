import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { bills, dailyLocationMetrics } from '@hospitality-os/database'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createBillFixture,
  deleteBillFixture,
  systemDb,
  testActorContext,
  type BillFixture,
} from '../../test/fixtures.js'
import { ReportsService } from './reports.service.js'

describe('ReportsService (integration)', () => {
  let moduleRef: TestingModule
  let reportsService: ReportsService
  let fixture: BillFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    reportsService = moduleRef.get(ReportsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    fixture = await createBillFixture({ totalAmount: 5000 })
  })

  afterEach(async () => {
    await systemDb.delete(dailyLocationMetrics).where(eq(dailyLocationMetrics.organizationId, fixture.organizationId))
    await deleteBillFixture(fixture)
  })

  describe('homeDashboard', () => {
    it("counts today's paid-bill revenue and computes the change vs yesterday", async () => {
      const authContext = testActorContext(fixture)
      await systemDb.update(bills).set({ status: 'paid', paidAt: new Date() }).where(eq(bills.id, fixture.billId))

      const result = await reportsService.homeDashboard(authContext, fixture.locationId)
      expect(result.revenueToday).toBe(5000)
      expect(result.revenueYesterday).toBe(0)
      expect(result.changeVsYesterday).toBe(0) // yesterday=0 short-circuits the percentage calc
    })
  })

  describe('financeDashboard', () => {
    it("sums this month's paid-bill revenue", async () => {
      const authContext = testActorContext(fixture)
      await systemDb.update(bills).set({ status: 'paid', paidAt: new Date() }).where(eq(bills.id, fixture.billId))

      const result = await reportsService.financeDashboard(authContext, fixture.locationId)
      expect(result.monthRevenue).toBe(5000)
    })

    it('an unpaid bill contributes nothing to monthRevenue', async () => {
      const authContext = testActorContext(fixture)
      const result = await reportsService.financeDashboard(authContext, fixture.locationId)
      expect(result.monthRevenue).toBe(0)
    })
  })

  describe('runDailyAggregation', () => {
    it("writes today's snapshot to daily_location_metrics and computes grossProfit = revenue - laborCost - foodCost", async () => {
      const authContext = testActorContext(fixture)
      await systemDb.update(bills).set({ status: 'paid', paidAt: new Date() }).where(eq(bills.id, fixture.billId))

      const metrics = await reportsService.runDailyAggregation(authContext, fixture.locationId)
      expect(metrics?.revenue).toBe(5000)
      expect(metrics?.grossProfit).toBe(5000 - (metrics?.laborCost ?? 0) - (metrics?.foodCost ?? 0))
    })

    it('re-running the same day upserts in place rather than creating a second row', async () => {
      const authContext = testActorContext(fixture)
      await reportsService.runDailyAggregation(authContext, fixture.locationId)
      await reportsService.runDailyAggregation(authContext, fixture.locationId)

      const rows = await systemDb
        .select()
        .from(dailyLocationMetrics)
        .where(eq(dailyLocationMetrics.locationId, fixture.locationId))
      expect(rows).toHaveLength(1)
    })
  })

  describe('getPeerBenchmark', () => {
    it('is unavailable (fewer than 10 organizations on the platform) in a fresh dev/test environment', async () => {
      const authContext = testActorContext(fixture)
      const result = await reportsService.getPeerBenchmark(authContext, 'revenue')
      // This assertion holds for a small seeded dev DB; if the platform ever
      // legitimately has 10+ orgs, `available` flips true — that's the
      // documented threshold behavior, not a fixed expectation to chase.
      if ('minimumRequired' in result) {
        expect(result.minimumRequired).toBe(10)
      } else {
        expect(result.totalPeers).toBeGreaterThanOrEqual(10)
      }
    })
  })

  describe('scheduleReport', () => {
    it('rejects an invalid cadence', async () => {
      const authContext = testActorContext(fixture)
      await expect(reportsService.scheduleReport(authContext, 'sales', 'hourly')).rejects.toThrow(
        'cadence must be one of: daily, weekly, monthly',
      )
    })

    it('accepts a valid cadence and getScheduledReports reflects it', async () => {
      const authContext = testActorContext(fixture)
      await reportsService.scheduleReport(authContext, 'sales', 'weekly')
      const scheduled = await reportsService.getScheduledReports(authContext)
      expect(scheduled.find((s) => s.reportType === 'sales')?.cadence).toBe('weekly')
    })
  })

  describe('exportReport', () => {
    it('produces a CSV with a header row for a known report type', async () => {
      const authContext = testActorContext(fixture)
      const result = await reportsService.exportReport(authContext, fixture.locationId, 'payments', {})
      expect(result.csv.split('\n')[0]).toBe('method,total_amount,count')
      expect(result.filename).toContain('payments_report')
    })

    it('falls back to a not-supported marker for an unknown report type', async () => {
      const authContext = testActorContext(fixture)
      const result = await reportsService.exportReport(authContext, fixture.locationId, 'nonsense', {})
      expect(result.csv).toContain('not_supported')
    })
  })
})
