import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { bills as billsTable, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import {
  closeFixturePool,
  createBillFixture,
  createLocationFixture,
  deleteBillFixture,
  deleteLocationFixture,
  deleteOrgCrmData,
  systemDb,
  testActorContext,
  type BillFixture,
  type LocationFixture,
} from '../../test/fixtures.js'
import { CrmService } from './crm.service.js'

describe('CrmService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let crmService: CrmService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    crmService = moduleRef.get(CrmService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteOrgCrmData(location.organizationId)
    await deleteLocationFixture(location)
  })

  describe('findOrCreateByPhone', () => {
    it('creates a customer on first call and returns the same one on a repeat call with the same phone', async () => {
      const authContext = testActorContext(location)
      const phone = '+254700111222'
      const first = await crmService.findOrCreateByPhone(authContext, { phone, firstName: 'Amina' })
      const second = await crmService.findOrCreateByPhone(authContext, { phone })
      expect(second.id).toBe(first.id)
    })
  })

  describe('customers', () => {
    it('creates, updates, and tags a customer', async () => {
      const authContext = testActorContext(location)
      const created = await crmService.createCustomer(authContext, { firstName: 'Juma', phone: '+254700333444' })
      const updated = await crmService.updateCustomer(authContext, created.id, { notes: 'regular, prefers window seat' })
      expect(updated.notes).toContain('window seat')

      const tag = await crmService.addTag(authContext, created.id, 'vip')
      expect(tag?.tag).toBe('vip')

      const fetched = await crmService.getCustomer(authContext, created.id)
      expect(fetched.tags.map((t) => t.tag)).toContain('vip')
    })

    it('mergeCustomers moves identities/tags/loyalty/credit onto the target and marks the source merged', async () => {
      const authContext = testActorContext(location)
      const target = await crmService.createCustomer(authContext, { firstName: 'Target' })
      const source = await crmService.createCustomer(authContext, { firstName: 'Duplicate' })
      await crmService.addTag(authContext, source.id, 'loyal')
      await crmService.createLoyaltyAccount(authContext, { customerId: source.id, points: 50 })

      const merged = await crmService.mergeCustomers(authContext, target.id, source.id)
      expect(merged?.id).toBe(target.id)

      const targetView = await crmService.getCustomer(authContext, target.id)
      expect(targetView.tags.map((t) => t.tag)).toContain('loyal')
      expect(targetView.loyaltyAccount?.points).toBe(50)

      const sourceView = await crmService.getCustomer(authContext, source.id)
      expect(sourceView.status).toBe('merged')
    })
  })

  describe('loyalty', () => {
    it('earning then redeeming points keeps the balance consistent', async () => {
      const authContext = testActorContext(location)
      const customer = await crmService.createCustomer(authContext, { firstName: 'Loyal Customer' })
      const account = await crmService.createLoyaltyAccount(authContext, { customerId: customer.id, points: 0 })

      await crmService.earnLoyaltyPoints(authContext, account.id, 100, 'welcome bonus')
      const afterEarn = await crmService.getLoyaltyAccount(authContext, account.id)
      expect(afterEarn.points).toBe(100)
      expect(afterEarn.lifetimePoints).toBe(100)

      await crmService.redeemLoyaltyPoints(authContext, account.id, 40)
      const afterRedeem = await crmService.getLoyaltyAccount(authContext, account.id)
      expect(afterRedeem.points).toBe(60)
      expect(afterRedeem.lifetimePoints).toBe(100) // lifetime never decreases
    })

    it('rejects redeeming more points than the account holds', async () => {
      const authContext = testActorContext(location)
      const customer = await crmService.createCustomer(authContext, { firstName: 'Broke Customer' })
      const account = await crmService.createLoyaltyAccount(authContext, { customerId: customer.id, points: 10 })

      await expect(crmService.redeemLoyaltyPoints(authContext, account.id, 20)).rejects.toThrow('insufficient loyalty points')
    })

    it('findOrCreateLoyaltyAccountInTx is idempotent per customer', async () => {
      const authContext = testActorContext(location)
      const customer = await crmService.createCustomer(authContext, { firstName: 'Fresh Customer' })

      const a = await withTenantContext(pool, location.organizationId, (db: Db) =>
        crmService.findOrCreateLoyaltyAccountInTx(db, location.organizationId, customer.id),
      )
      const b = await withTenantContext(pool, location.organizationId, (db: Db) =>
        crmService.findOrCreateLoyaltyAccountInTx(db, location.organizationId, customer.id),
      )
      expect(a.created).toBe(true)
      expect(b.created).toBe(false)
      expect(b.account.id).toBe(a.account.id)
    })
  })

  describe('gift cards', () => {
    it('partial redemption keeps the card active; redeeming the remainder marks it redeemed', async () => {
      const authContext = testActorContext(location)
      const code = `GC-${randomUUID().slice(0, 8)}`
      await crmService.createGiftCard(authContext, { code, initialBalance: 1000, currency: 'KES' })

      const partial = await crmService.redeemGiftCard(authContext, code, 400)
      expect(partial.currentBalance).toBe(600)
      expect(partial.status).toBe('active')

      const full = await crmService.redeemGiftCard(authContext, code, 600)
      expect(full.currentBalance).toBe(0)
      expect(full.status).toBe('redeemed')
    })

    it('never redeems more than the remaining balance, even if more is requested', async () => {
      const authContext = testActorContext(location)
      const code = `GC-${randomUUID().slice(0, 8)}`
      await crmService.createGiftCard(authContext, { code, initialBalance: 300, currency: 'KES' })

      const result = await crmService.redeemGiftCard(authContext, code, 1000)
      expect(result.redeemedAmount).toBe(300)
      expect(result.currentBalance).toBe(0)
    })

    it('a fully-redeemed card flips to status "redeemed", so a further redemption attempt no longer finds it as active', async () => {
      const authContext = testActorContext(location)
      const code = `GC-${randomUUID().slice(0, 8)}`
      await crmService.createGiftCard(authContext, { code, initialBalance: 100, currency: 'KES' })
      await crmService.redeemGiftCard(authContext, code, 100)

      await expect(crmService.redeemGiftCard(authContext, code, 1)).rejects.toThrow('active gift card not found')
    })
  })

  describe('customer credit accounts', () => {
    it('charges accumulate and settlements reduce the balance, clamped at zero', async () => {
      const authContext = testActorContext(location)
      const customer = await crmService.createCustomer(authContext, { firstName: 'Credit Customer' })
      const account = await crmService.createCreditAccount(authContext, { customerId: customer.id, creditLimit: 5000 })
      expect(account.currentBalance).toBe(0)

      await crmService.chargeCreditAccount(authContext, customer.id, 2000)
      const afterCharge = await crmService.getCreditAccount(authContext, customer.id)
      expect(afterCharge.currentBalance).toBe(2000)

      await crmService.settleCreditAccount(authContext, customer.id, 5000) // overpay
      const afterSettle = await crmService.getCreditAccount(authContext, customer.id)
      expect(afterSettle.currentBalance).toBe(0)
    })

    it('rejects a charge that would exceed the credit limit', async () => {
      const authContext = testActorContext(location)
      const customer = await crmService.createCustomer(authContext, { firstName: 'Tight Limit Customer' })
      await crmService.createCreditAccount(authContext, { customerId: customer.id, creditLimit: 1000 })

      await expect(crmService.chargeCreditAccount(authContext, customer.id, 1500)).rejects.toThrow('exceed credit limit')
    })
  })

  describe('feedback', () => {
    it('a rating of 2 or below is automatically flagged as negative', async () => {
      const authContext = testActorContext(location)
      const negative = await crmService.createFeedback(authContext, { locationId: location.locationId, rating: 1, comment: 'cold food' })
      expect(negative.isNegative).toBe(true)

      const positive = await crmService.createFeedback(authContext, { locationId: location.locationId, rating: 5, comment: 'great!' })
      expect(positive.isNegative).toBe(false)
    })

    it('getSentimentAlerts only returns negative, not-yet-alerted feedback', async () => {
      const authContext = testActorContext(location)
      await crmService.createFeedback(authContext, { locationId: location.locationId, rating: 1, comment: 'terrible' })
      await crmService.createFeedback(authContext, { locationId: location.locationId, rating: 5, comment: 'lovely' })

      const alerts = await crmService.getSentimentAlerts(authContext, location.locationId)
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.comment).toBe('terrible')
    })
  })

  describe('chama routing', () => {
    it('rejects a percentage outside 1-100', async () => {
      const authContext = testActorContext(location)
      await expect(crmService.setupChamaRouting(authContext, 0, 'ACC-123')).rejects.toThrow('percentage must be between 1 and 100')
      await expect(crmService.setupChamaRouting(authContext, 101, 'ACC-123')).rejects.toThrow('percentage must be between 1 and 100')
    })

    it('rejects processing before setup', async () => {
      const authContext = testActorContext(location)
      await expect(crmService.processChamaRouting(authContext, location.locationId)).rejects.toThrow('chama routing not configured')
    })

    it("computes the chama amount as percentage of today's paid bill revenue", async () => {
      const fixture: BillFixture = await createBillFixture({ totalAmount: 10_000 })
      const billAuthContext = testActorContext(fixture)
      await systemDb.update(billsTable).set({ status: 'paid', paidAt: new Date() }).where(eq(billsTable.id, fixture.billId))

      await crmService.setupChamaRouting(billAuthContext, 10, 'ACC-999')
      const result = await crmService.processChamaRouting(billAuthContext, fixture.locationId)
      expect(result.chamaAmount).toBe(1000) // 10% of 10,000

      await deleteBillFixture(fixture)
    })
  })
})
