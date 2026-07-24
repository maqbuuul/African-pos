import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  customerCreditAccounts,
  customerFeedback,
  customerIdentities,
  customerTags,
  customers,
  giftCards,
  loyaltyAccounts,
  loyaltyEvents,
  orders,
  tenantSettings,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import type { GiftCardStatus } from '@hospitality-os/domain'
import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateCreditAccountDto } from './dto/create-credit-account.dto.js'
import type { CreateCustomerDto } from './dto/create-customer.dto.js'
import type { CreateLoyaltyAccountDto } from './dto/create-loyalty-account.dto.js'

export interface FindOrCreateCustomerParams {
  phone?: string
  email?: string
  firstName?: string
  lastName?: string
}

@Injectable()
export class CrmService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Customer identity resolution — phone-first merge key (PRD 13 Business Rules).
  // ---------------------------------------------------------------------------
  async findOrCreateByPhone(authContext: AuthContext, params: FindOrCreateCustomerParams) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => this.findOrCreateByPhoneInTx(db, authContext, params))
  }

  // db-first: callable from another module's already-open transaction (e.g.
  // QrOrderService.captureLoyalty, so the find-or-create commits atomically
  // with the rest of that request instead of opening a second connection).
  async findOrCreateByPhoneInTx(db: Db, authContext: AuthContext, params: FindOrCreateCustomerParams) {
    if (params.phone) {
      const existing = await db
        .select()
        .from(customers)
        .where(and(eq(customers.organizationId, authContext.organizationId), eq(customers.phone, params.phone), eq(customers.status, 'active')))
        .limit(1)
        .then((r) => r[0])
      if (existing) return existing
      const identity = await db
        .select()
        .from(customerIdentities)
        .where(and(eq(customerIdentities.organizationId, authContext.organizationId), eq(customerIdentities.identityType, 'phone'), eq(customerIdentities.identityValue, params.phone)))
        .limit(1)
        .then((r) => r[0])
      if (identity) {
        const customer = await db
          .select()
          .from(customers)
          .where(and(eq(customers.id, identity.customerId), eq(customers.organizationId, authContext.organizationId)))
          .limit(1)
          .then((r) => r[0])
        if (customer) return customer
      }
    }
    const [customer] = await db
      .insert(customers)
      .values({
        organizationId: authContext.organizationId,
        phone: params.phone ?? null,
        email: params.email ?? null,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
      })
      .returning()
    if (!customer) throw new Error('failed to create customer')
    if (params.phone) {
      await db.insert(customerIdentities).values({
        organizationId: authContext.organizationId, customerId: customer.id,
        identityType: 'phone', identityValue: params.phone,
      })
    }
    return customer
  }

  async createCustomer(authContext: AuthContext, dto: CreateCustomerDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [customer] = await db.insert(customers).values({
        organizationId: authContext.organizationId,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        notes: dto.notes ?? null,
        allergyNotes: dto.allergyNotes ?? null,
        creditRisk: dto.creditRisk ?? false,
      }).returning()
      return customer!
    })
  }

  async listCustomers(authContext: AuthContext, query: { search?: string | undefined; limit?: number | undefined }) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const conditions = [eq(customers.organizationId, authContext.organizationId)]
      if (query.search) {
        conditions.push(sql`(${customers.phone}::text ILIKE ${'%' + query.search + '%'} OR ${customers.firstName} ILIKE ${'%' + query.search + '%'} OR ${customers.lastName} ILIKE ${'%' + query.search + '%'} OR ${customers.email} ILIKE ${'%' + query.search + '%'})`)
      }
      return db.select().from(customers).where(and(...conditions)).limit(query.limit ?? 50)
    })
  }

  async getCustomer(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const customer = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!customer) throw new NotFoundException('customer not found')
      const [identities, tags, loyalty, credit] = await Promise.all([
        db.select().from(customerIdentities).where(and(eq(customerIdentities.customerId, id), eq(customerIdentities.organizationId, authContext.organizationId))),
        db.select().from(customerTags).where(and(eq(customerTags.customerId, id), eq(customerTags.organizationId, authContext.organizationId))),
        db.select().from(loyaltyAccounts).where(and(eq(loyaltyAccounts.customerId, id), eq(loyaltyAccounts.organizationId, authContext.organizationId))).limit(1).then((r) => r[0] ?? null),
        db.select().from(customerCreditAccounts).where(and(eq(customerCreditAccounts.customerId, id), eq(customerCreditAccounts.organizationId, authContext.organizationId))).limit(1).then((r) => r[0] ?? null),
      ])
      return { ...customer, identities, tags, loyaltyAccount: loyalty, creditAccount: credit }
    })
  }

  async updateCustomer(authContext: AuthContext, id: string, data: { firstName?: string; lastName?: string; notes?: string; allergyNotes?: string; phone?: string; email?: string }) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(customers)
        .set({ ...data, updatedAt: sql`now()` })
        .where(and(eq(customers.id, id), eq(customers.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('customer not found')
      return updated
    })
  }

  async addTag(authContext: AuthContext, customerId: string, tag: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [row] = await db
        .insert(customerTags)
        .values({ organizationId: authContext.organizationId, customerId, tag })
        .onConflictDoNothing()
        .returning()
      return row ?? null
    })
  }

  async mergeCustomers(authContext: AuthContext, targetId: string, sourceId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [target, source] = await Promise.all([
        db.select().from(customers).where(and(eq(customers.id, targetId), eq(customers.organizationId, authContext.organizationId))).limit(1).then((r) => r[0]),
        db.select().from(customers).where(and(eq(customers.id, sourceId), eq(customers.organizationId, authContext.organizationId))).limit(1).then((r) => r[0]),
      ])
      if (!target || !source) throw new NotFoundException('one or both customers not found')
      await Promise.all([
        db.update(customerIdentities).set({ customerId: targetId }).where(eq(customerIdentities.customerId, sourceId)),
        db.update(customerTags).set({ customerId: targetId }).where(eq(customerTags.customerId, sourceId)),
        db.update(loyaltyAccounts).set({ customerId: targetId }).where(eq(loyaltyAccounts.customerId, sourceId)),
        db.update(customerCreditAccounts).set({ customerId: targetId }).where(eq(customerCreditAccounts.customerId, sourceId)),
        db.update(customerFeedback).set({ customerId: targetId }).where(eq(customerFeedback.customerId, sourceId)),
        db.update(customers).set({ status: 'merged', updatedAt: sql`now()` }).where(eq(customers.id, sourceId)),
      ])
      return db.select().from(customers).where(and(eq(customers.id, targetId), eq(customers.organizationId, authContext.organizationId))).limit(1).then((r) => r[0])
    })
  }

  // ---------------------------------------------------------------------------
  // Loyalty
  // ---------------------------------------------------------------------------
  // db-first: callable from another module's already-open transaction (e.g.
  // QrOrderService.captureLoyalty).
  async findOrCreateLoyaltyAccountInTx(db: Db, organizationId: string, customerId: string): Promise<{ account: typeof loyaltyAccounts.$inferSelect; created: boolean }> {
    const existing = await db
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.customerId, customerId))
      .limit(1)
      .then((r) => r[0])
    if (existing) return { account: existing, created: false }

    const [account] = await db
      .insert(loyaltyAccounts)
      .values({ organizationId, customerId, tier: 'bronze', points: 0, lifetimePoints: 0 })
      .returning()
    if (!account) throw new Error('failed to create loyalty account')
    return { account, created: true }
  }

  async createLoyaltyAccount(authContext: AuthContext, dto: CreateLoyaltyAccountDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [account] = await db.insert(loyaltyAccounts).values({
        organizationId: authContext.organizationId,
        customerId: dto.customerId,
        tier: dto.tier ?? 'bronze',
        points: dto.points ?? 0,
      }).returning()
      return account!
    })
  }

  async getLoyaltyAccount(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const account = await db
        .select()
        .from(loyaltyAccounts)
        .where(and(eq(loyaltyAccounts.id, id), eq(loyaltyAccounts.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!account) throw new NotFoundException('loyalty account not found')
      const events = await db
        .select()
        .from(loyaltyEvents)
        .where(eq(loyaltyEvents.loyaltyAccountId, id))
        .orderBy(loyaltyEvents.createdAt)
      return { ...account, events }
    })
  }

  async redeemLoyaltyPoints(authContext: AuthContext, accountId: string, points: number) {
    if (points <= 0) throw new BadRequestException('points must be positive')
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const account = await db
        .select()
        .from(loyaltyAccounts)
        .where(and(eq(loyaltyAccounts.id, accountId), eq(loyaltyAccounts.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!account) throw new NotFoundException('loyalty account not found')
      if (account.points < points) throw new BadRequestException('insufficient loyalty points')
      const balanceAfter = account.points - points
      const [event] = await db
        .insert(loyaltyEvents)
        .values({
          organizationId: authContext.organizationId, locationId: authContext.locationId ?? account.organizationId,
          loyaltyAccountId: accountId, eventType: 'redeem', points: -points, balanceAfter,
        })
        .returning()
      if (!event) throw new Error('failed to record redemption')
      await db.update(loyaltyAccounts).set({ points: balanceAfter, updatedAt: sql`now()` }).where(eq(loyaltyAccounts.id, accountId))
      return event
    })
  }

  async earnLoyaltyPoints(authContext: AuthContext, accountId: string, points: number, description?: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      if (points <= 0) throw new BadRequestException('points must be positive')
      const accounts = await db
        .select()
        .from(loyaltyAccounts)
        .where(and(eq(loyaltyAccounts.id, accountId), eq(loyaltyAccounts.organizationId, authContext.organizationId)))
      if (!accounts.length) throw new NotFoundException('loyalty account not found')
      const account = accounts[0]!
      const balanceAfter = account.points + points
      await db
        .update(loyaltyAccounts)
        .set({
          points: sql`${loyaltyAccounts.points} + ${points}`,
          lifetimePoints: sql`${loyaltyAccounts.lifetimePoints} + ${points}`,
          updatedAt: sql`now()`,
        })
        .where(eq(loyaltyAccounts.id, accountId))
      await db.insert(loyaltyEvents).values({
        organizationId: authContext.organizationId,
        locationId: authContext.locationId ?? account.organizationId,
        loyaltyAccountId: accountId,
        eventType: 'earn',
        points,
        balanceAfter,
        reason: description ?? 'points earned',
      })
      return { accountId, pointsEarned: points, totalPoints: account.points + points }
    })
  }

  // ---------------------------------------------------------------------------
  // Gift cards
  // ---------------------------------------------------------------------------
  async createGiftCard(authContext: AuthContext, data: { code: string; initialBalance: number; currency: string; expiresAt?: string }) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [card] = await db
        .insert(giftCards)
        .values({
          organizationId: authContext.organizationId, locationId: authContext.locationId ?? authContext.organizationId,
          code: data.code, initialBalance: data.initialBalance, currentBalance: data.initialBalance,
          currency: data.currency, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        })
        .returning()
      if (!card) throw new Error('failed to create gift card')
      return card
    })
  }

  async getGiftCard(authContext: AuthContext, code: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const card = await db
        .select()
        .from(giftCards)
        .where(and(eq(giftCards.code, code), eq(giftCards.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!card) throw new NotFoundException('gift card not found')
      return card
    })
  }

  async listGiftCards(authContext: AuthContext) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return db
        .select()
        .from(giftCards)
        .where(eq(giftCards.organizationId, authContext.organizationId))
        .orderBy(desc(giftCards.createdAt))
    })
  }

  async redeemGiftCard(authContext: AuthContext, code: string, amount: number) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const card = await db
        .select()
        .from(giftCards)
        .where(and(eq(giftCards.code, code), eq(giftCards.organizationId, authContext.organizationId), eq(giftCards.status, 'active')))
        .limit(1)
        .then((r) => r[0])
      if (!card) throw new NotFoundException('active gift card not found')
      if (card.currentBalance <= 0) throw new BadRequestException('gift card has no remaining balance')
      const redeemAmount = Math.min(amount, card.currentBalance)
      const newBalance = card.currentBalance - redeemAmount
      const newStatus: GiftCardStatus = newBalance <= 0 ? 'redeemed' : 'active'
      const [updated] = await db
        .update(giftCards)
        .set({ currentBalance: newBalance, status: newStatus, updatedAt: sql`now()` })
        .where(eq(giftCards.id, card.id))
        .returning()
      if (!updated) throw new Error('failed to redeem gift card')
      return { ...updated, redeemedAmount: redeemAmount }
    })
  }

  // ---------------------------------------------------------------------------
  // Customer credit tab
  // ---------------------------------------------------------------------------
  async createCreditAccount(authContext: AuthContext, dto: CreateCreditAccountDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [account] = await db.insert(customerCreditAccounts).values({
        organizationId: authContext.organizationId,
        customerId: dto.customerId,
        creditLimit: dto.creditLimit,
        currentBalance: 0,
        currency: dto.currency ?? 'KES',
        status: 'active',
      }).returning()
      return account!
    })
  }

  async getCreditAccount(authContext: AuthContext, customerId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const account = await db
        .select()
        .from(customerCreditAccounts)
        .where(and(eq(customerCreditAccounts.customerId, customerId), eq(customerCreditAccounts.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!account) throw new NotFoundException('credit account not found')
      return account
    })
  }

  async chargeCreditAccount(authContext: AuthContext, customerId: string, amount: number) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const account = await db
        .select()
        .from(customerCreditAccounts)
        .where(and(eq(customerCreditAccounts.customerId, customerId), eq(customerCreditAccounts.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!account) throw new NotFoundException('credit account not found')
      if (account.status !== 'active') throw new BadRequestException('credit account is not active')
      const newBalance = account.currentBalance + amount
      if (newBalance > account.creditLimit) throw new BadRequestException('charge would exceed credit limit')
      const [updated] = await db
        .update(customerCreditAccounts)
        .set({ currentBalance: newBalance, updatedAt: sql`now()` })
        .where(eq(customerCreditAccounts.id, account.id))
        .returning()
      if (!updated) throw new Error('failed to charge credit account')
      return updated
    })
  }

  async settleCreditAccount(authContext: AuthContext, customerId: string, amount: number) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const account = await db
        .select()
        .from(customerCreditAccounts)
        .where(and(eq(customerCreditAccounts.customerId, customerId), eq(customerCreditAccounts.organizationId, authContext.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!account) throw new NotFoundException('credit account not found')
      const newBalance = Math.max(0, account.currentBalance - amount)
      const [updated] = await db
        .update(customerCreditAccounts)
        .set({ currentBalance: newBalance, updatedAt: sql`now()` })
        .where(eq(customerCreditAccounts.id, account.id))
        .returning()
      if (!updated) throw new Error('failed to settle credit account')
      return updated
    })
  }

  // ---------------------------------------------------------------------------
  // Feedback / Reviews
  // ---------------------------------------------------------------------------
  async listFeedback(authContext: AuthContext, query: { locationId?: string | undefined; isNegative?: boolean | undefined; limit?: number | undefined }) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const conditions = [eq(customerFeedback.organizationId, authContext.organizationId)]
      if (query.locationId) conditions.push(eq(customerFeedback.locationId, query.locationId))
      if (query.isNegative !== undefined) conditions.push(eq(customerFeedback.isNegative, query.isNegative))
      return db.select().from(customerFeedback).where(and(...conditions)).orderBy(customerFeedback.createdAt).limit(query.limit ?? 50)
    })
  }

  async createFeedback(
    authContext: AuthContext,
    data: { locationId: string; customerId?: string; orderId?: string; orderItemId?: string; rating?: number; comment?: string | undefined; source?: string },
  ) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => this.createFeedbackInTx(db, authContext, data))
  }

  // db-first: callable from another module's already-open transaction (e.g.
  // QrOrderService.submitFeedback/rateDish).
  async createFeedbackInTx(
    db: Db,
    authContext: AuthContext,
    data: { locationId: string; customerId?: string; orderId?: string; orderItemId?: string; rating?: number; comment?: string | undefined; source?: string },
  ) {
    const rows = await db.insert(customerFeedback).values({
      organizationId: authContext.organizationId,
      locationId: data.locationId,
      customerId: data.customerId ?? null,
      orderId: data.orderId ?? null,
      orderItemId: data.orderItemId ?? null,
      source: data.source ?? 'manual',
      rating: data.rating ?? null,
      comment: data.comment ?? null,
      externalReviewId: null,
      sourceUrl: null,
      sentiment: null,
      isNegative: data.rating != null && data.rating <= 2,
      alertSent: false,
    }).returning()
    return rows[0]!
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  async customerSummaryReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      interface CountRow { count: number }
      const [totalActive, newCustomers] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(customers)
          .where(and(eq(customers.organizationId, authContext.organizationId), eq(customers.status, 'active'))) as Promise<CountRow[]>,
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(customers)
          .where(and(eq(customers.organizationId, authContext.organizationId), sql`${customers.createdAt} >= ${from}`, sql`${customers.createdAt} <= ${to}`)) as Promise<CountRow[]>,
      ])
      return {
        from,
        to,
        totalActiveCustomers: Number(totalActive[0]?.count ?? 0),
        newCustomersInPeriod: Number(newCustomers[0]?.count ?? 0),
      }
    })
  }

  async loyaltySummaryReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [accountStats, pointsSummary] = await Promise.all([
        db
          .select({
            totalAccounts: sql<number>`COUNT(*)`,
            totalPoints: sql<number>`COALESCE(SUM(${loyaltyAccounts.points}), 0)`,
            avgPoints: sql<number>`COALESCE(AVG(${loyaltyAccounts.points}), 0)`,
            tierDistribution: sql<string>`${loyaltyAccounts.tier}`,
            tierCount: sql<number>`COUNT(*)`,
          })
          .from(loyaltyAccounts)
          .where(eq(loyaltyAccounts.organizationId, authContext.organizationId))
          .groupBy(loyaltyAccounts.tier),
        db
          .select({
            eventType: loyaltyEvents.eventType,
            totalPoints: sql<number>`SUM(${loyaltyEvents.points})`,
            eventCount: sql<number>`COUNT(*)`,
          })
          .from(loyaltyEvents)
          .where(and(eq(loyaltyEvents.organizationId, authContext.organizationId), eq(loyaltyEvents.locationId, locationId), sql`${loyaltyEvents.createdAt} >= ${from}`, sql`${loyaltyEvents.createdAt} <= ${to}`))
          .groupBy(loyaltyEvents.eventType),
      ])
      return { from, to, accountStats: accountStats, pointsSummary }
    })
  }

  async feedbackSummaryReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          totalReviews: sql<number>`COUNT(*)`,
          avgRating: sql<number>`COALESCE(AVG(${customerFeedback.rating}), 0)`,
          negativeCount: sql<number>`COUNT(*) FILTER (WHERE ${customerFeedback.isNegative} = true)`,
          positiveCount: sql<number>`COUNT(*) FILTER (WHERE ${customerFeedback.isNegative} = false)`,
          ratingDistribution: sql<string>`${customerFeedback.rating}`,
          ratingCount: sql<number>`COUNT(*)`,
        })
        .from(customerFeedback)
        .where(and(eq(customerFeedback.organizationId, authContext.organizationId), eq(customerFeedback.locationId, locationId), sql`${customerFeedback.createdAt} >= ${from}`, sql`${customerFeedback.createdAt} <= ${to}`))
        .groupBy(customerFeedback.rating)
        .orderBy(customerFeedback.rating)
      const totalReviews = Number(rows.reduce((sum, r) => sum + Number(r.totalReviews || 0), 0))
      const negativeCount = Number(rows.reduce((sum, r) => sum + Number(r.negativeCount || 0), 0))
      return {
        from,
        to,
        totalReviews,
        avgRating: rows.length > 0 ? Number(rows.reduce((sum, r) => sum + Number(r.avgRating || 0), 0)) / rows.length : 0,
        negativeCount,
        negativeRate: totalReviews > 0 ? negativeCount / totalReviews : 0,
        ratingDistribution: rows.map((r) => ({ rating: r.ratingDistribution, count: Number(r.ratingCount) })),
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Chama / SACCO auto-routing (P13)
  // ---------------------------------------------------------------------------
  async setupChamaRouting(authContext: AuthContext, percentage: number, linkedAccountRef: string) {
    if (percentage < 1 || percentage > 100) {
      throw new BadRequestException('percentage must be between 1 and 100')
    }
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const config = { percentage, linkedAccountRef, enabled: true }
      await db
        .insert(tenantSettings)
        .values({ organizationId: authContext.organizationId, locationId: null, key: 'chama_routing_config', value: config })
        .onConflictDoUpdate({
          target: [tenantSettings.organizationId, tenantSettings.key],
          set: { value: config, updatedAt: sql`now()` },
          targetWhere: sql`${tenantSettings.locationId} is null`,
        })
      return { ...config, organizationId: authContext.organizationId, createdAt: new Date() }
    })
  }

  async processChamaRouting(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const setting = await db
        .select()
        .from(tenantSettings)
        .where(and(eq(tenantSettings.organizationId, authContext.organizationId), eq(tenantSettings.key, 'chama_routing_config'), sql`${tenantSettings.locationId} is null`))
        .limit(1)
        .then((r) => r[0] ?? null)
      if (!setting) throw new NotFoundException('chama routing not configured — call setupChamaRouting first')
      const config = setting.value as { percentage: number; linkedAccountRef: string; enabled: boolean }
      if (!config.enabled) throw new BadRequestException('chama routing is disabled')
      const today = sql`CURRENT_DATE`
      const rows = await db
        .select({ totalAmount: bills.totalAmount })
        .from(bills)
        .innerJoin(orders, eq(bills.orderId, orders.id))
        .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`DATE(${bills.paidAt}) = ${today}`))
      const totalRevenue = rows.reduce((sum, r) => sum + Number(r.totalAmount), 0)
      const chamaAmount = Math.round(totalRevenue * config.percentage / 100)
      return {
        totalRevenue,
        percentage: config.percentage,
        chamaAmount,
        linkedAccountRef: config.linkedAccountRef,
        date: new Date(),
      }
    })
  }

  async getSentimentAlerts(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select()
        .from(customerFeedback)
        .where(and(eq(customerFeedback.organizationId, authContext.organizationId), eq(customerFeedback.locationId, locationId), eq(customerFeedback.isNegative, true), eq(customerFeedback.alertSent, false)))
        .orderBy(customerFeedback.createdAt)
      return rows.map((r) => ({
        rating: r.rating,
        comment: r.comment,
        source: r.source,
        createdAt: r.createdAt,
      }))
    })
  }
}
