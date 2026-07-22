import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  customerCreditAccounts,
  customerFeedback,
  customerIdentities,
  customerTags,
  customers,
  giftCards,
  loyaltyAccounts,
  loyaltyEvents,
  withTenantContext,
} from '@hospitality-os/database'
import type { GiftCardStatus } from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'

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
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
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
}
