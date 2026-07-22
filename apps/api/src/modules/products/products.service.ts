import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  menuCategories,
  modifierGroups,
  productModifierGroups,
  productPrices,
  products,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { ApprovalRequiredException } from '../../core/errors/approval-required.exception.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { TenantSettingsService } from '../../core/tenant/tenant-settings.service.js'
import type { ChangePriceDto } from './dto/change-price.dto.js'
import type { CreateProductDto } from './dto/create-product.dto.js'
import type { MarkUnavailableDto } from './dto/mark-unavailable.dto.js'
import type { UpdateProductDto } from './dto/update-product.dto.js'

// A price jump beyond this percentage needs owner sign-off (PRD 03
// Permissions: "Bulk price update ... owner-approved for large % changes,"
// applied here to any single price change too — protects against
// fat-finger errors like entering 8000 instead of 800). Per-tenant
// overridable via tenant_settings key PRICE_CHANGE_THRESHOLD_SETTING_KEY;
// this is only the fallback when a tenant hasn't configured one.
const DEFAULT_PRICE_CHANGE_THRESHOLD_PCT = 20
const PRICE_CHANGE_THRESHOLD_SETTING_KEY = 'price_change_approval_threshold_pct'
export const LARGE_PRICE_CHANGE_ACTION = 'products:approve_large_price_change'

export const APPROVAL_HEADER = 'x-approval-request-id'

export interface ListProductsQuery {
  locationId?: string | undefined
  categoryId?: string | undefined
  q?: string | undefined
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(TenantSettingsService) private readonly tenantSettings: TenantSettingsService,
  ) {}

  async list(authContext: AuthContext, query: ListProductsQuery) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => {
      const conditions: SQL[] = [eq(products.organizationId, authContext.organizationId)]
      if (query.locationId) conditions.push(eq(products.locationId, query.locationId))
      if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId))
      if (query.q) {
        const term = `%${query.q}%`
        // Trigram GIN indexes (products_name_trgm_idx etc., migration 0002)
        // accelerate ILIKE directly — no separate search service needed at
        // this phase (ADR 0001 decision 8).
        conditions.push(
          sql`(${products.name} ILIKE ${term} OR ${products.localName} ILIKE ${term} OR ${products.sku} ILIKE ${term})`,
        )
      }
      return db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(asc(products.sortOrder))
    })
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const product = await this.loadProduct(db, authContext.organizationId, id)
      const attachedGroups = await db
        .select({ modifierGroupId: productModifierGroups.modifierGroupId, sortOrder: productModifierGroups.sortOrder })
        .from(productModifierGroups)
        .where(eq(productModifierGroups.productId, id))
        .orderBy(asc(productModifierGroups.sortOrder))
      return { ...product, modifierGroupIds: attachedGroups.map((g) => g.modifierGroupId) }
    })
  }

  async priceHistory(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.loadProduct(db, authContext.organizationId, id)
      return db
        .select()
        .from(productPrices)
        .where(and(eq(productPrices.productId, id), eq(productPrices.organizationId, authContext.organizationId)))
        .orderBy(desc(productPrices.effectiveFrom))
    })
  }

  async create(authContext: AuthContext, dto: CreateProductDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      // RLS-scoped SELECT — a foreign-tenant categoryId is simply invisible
      // on this connection, same reasoning as CategoriesService.create.
      const [category] = await db.select().from(menuCategories).where(eq(menuCategories.id, dto.categoryId))
      if (!category) throw new NotFoundException('category not found')

      await this.assertModifierGroupsBelongToTenant(db, authContext.organizationId, dto.modifierGroupIds)

      const [product] = await db
        .insert(products)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          categoryId: dto.categoryId,
          name: dto.name,
          localName: dto.localName ?? null,
          description: dto.description ?? null,
          sku: dto.sku ?? null,
          photoUrl: dto.photoUrl ?? null,
          priceAmount: dto.priceAmount,
          currency: dto.currency,
          taxCategoryId: dto.taxCategoryId ?? null,
          kdsStationOverride: dto.kdsStationOverride ?? null,
          status: dto.status ?? 'draft',
          sortOrder: dto.sortOrder ?? 0,
        })
        .returning()
      if (!product) throw new Error('failed to create product')

      await db.insert(productPrices).values({
        organizationId: authContext.organizationId,
        productId: product.id,
        priceAmount: dto.priceAmount,
        currency: dto.currency,
        reason: 'initial price',
        changedByStaffId: authContext.actorType === 'staff' ? authContext.actorId : null,
      })

      if (dto.modifierGroupIds?.length) {
        await db.insert(productModifierGroups).values(
          dto.modifierGroupIds.map((modifierGroupId, index) => ({
            organizationId: authContext.organizationId,
            productId: product.id,
            modifierGroupId,
            sortOrder: index,
          })),
        )
      }

      return product
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'product.created',
      entityType: 'product',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async update(authContext: AuthContext, id: string, dto: UpdateProductDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      if (dto.categoryId) {
        const [category] = await db.select().from(menuCategories).where(eq(menuCategories.id, dto.categoryId))
        if (!category) throw new NotFoundException('category not found')
      }
      await this.assertModifierGroupsBelongToTenant(db, authContext.organizationId, dto.modifierGroupIds)

      const [updated] = await db
        .update(products)
        .set({
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.localName !== undefined && { localName: dto.localName }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
          ...(dto.taxCategoryId !== undefined && { taxCategoryId: dto.taxCategoryId }),
          ...(dto.kdsStationOverride !== undefined && { kdsStationOverride: dto.kdsStationOverride }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        })
        .where(and(eq(products.id, id), eq(products.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('product not found')

      if (dto.modifierGroupIds !== undefined) {
        await db.delete(productModifierGroups).where(eq(productModifierGroups.productId, id))
        if (dto.modifierGroupIds.length) {
          await db.insert(productModifierGroups).values(
            dto.modifierGroupIds.map((modifierGroupId, index) => ({
              organizationId: authContext.organizationId,
              productId: id,
              modifierGroupId,
              sortOrder: index,
            })),
          )
        }
      }

      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'product.updated',
      entityType: 'product',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // Never overwrites products.priceAmount in place — closes the current
  // productPrices row and inserts a new one in the same transaction (PRD 03
  // "Changing a price"). A jump beyond the configured threshold requires an
  // owner to approve first (see LARGE_PRICE_CHANGE_ACTION); this mirrors
  // PermissionsGuard's create-then-throw / header-then-consume shape, but is
  // a business-rule gate independent of the caller's own RBAC permissions —
  // even a branch_manager who holds products:manage needs this for a big
  // jump, so it can't be expressed as a route-level RequirePermission.
  async changePrice(authContext: AuthContext, id: string, dto: ChangePriceDto, approvalRequestId?: string) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const product = await this.loadProduct(db, authContext.organizationId, id)

      const thresholdPct = await this.tenantSettings.get(
        db,
        authContext.organizationId,
        PRICE_CHANGE_THRESHOLD_SETTING_KEY,
        DEFAULT_PRICE_CHANGE_THRESHOLD_PCT,
        product.locationId,
      )
      const pctChange =
        product.priceAmount === 0 ? Infinity : (Math.abs(dto.priceAmount - product.priceAmount) / product.priceAmount) * 100

      if (pctChange > thresholdPct) {
        if (approvalRequestId) {
          const consumed = await this.approvalsService.tryConsume(db, {
            id: approvalRequestId,
            organizationId: authContext.organizationId,
            requestedByActorId: authContext.actorId,
            action: LARGE_PRICE_CHANGE_ACTION,
          })
          if (consumed) return this.applyPriceChange(db, authContext, product, dto)
          // Stale/foreign/already-spent header — fall through and request a
          // fresh approval, same recovery path as PermissionsGuard.
        }

        const approval = await this.approvalsService.create(db, {
          organizationId: authContext.organizationId,
          locationId: product.locationId,
          requestedByActorId: authContext.actorId,
          action: LARGE_PRICE_CHANGE_ACTION,
          entityType: 'product',
          entityId: product.id,
          reason: `price change ${product.priceAmount} -> ${dto.priceAmount} (${pctChange.toFixed(1)}%)`,
        })
        return { pending: approval.id } as const
      }

      return this.applyPriceChange(db, authContext, product, dto)
    })

    if ('pending' in result) {
      await this.auditLog.record({
        organizationId: authContext.organizationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'product.price_change_requires_approval',
        entityType: 'product',
        entityId: id,
      })
      throw new ApprovalRequiredException(result.pending)
    }

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'product.price_changed',
      entityType: 'product',
      entityId: result.id,
      newValue: { priceAmount: result.priceAmount, currency: result.currency },
    })

    return result
  }

  async markUnavailable(authContext: AuthContext, id: string, dto: MarkUnavailableDto) {
    return this.setAvailability(authContext, id, false, dto)
  }

  async markAvailable(authContext: AuthContext, id: string) {
    return this.setAvailability(authContext, id, true, {})
  }

  private async setAvailability(authContext: AuthContext, id: string, isAvailable: boolean, dto: MarkUnavailableDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(products)
        .set({
          isAvailable,
          autoRestoreAt: isAvailable ? null : (dto.autoRestoreAt ? new Date(dto.autoRestoreAt) : null),
        })
        .where(and(eq(products.id, id), eq(products.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('product not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: isAvailable ? 'product.marked_available' : 'product.marked_unavailable',
      entityType: 'product',
      entityId: row.id,
      reason: dto.reason ?? null,
    })

    return row
  }

  private async applyPriceChange(
    db: Db,
    authContext: AuthContext,
    product: { id: string; locationId: string },
    dto: ChangePriceDto,
  ) {
    await db
      .update(productPrices)
      .set({ effectiveTo: sql`now()` })
      .where(and(eq(productPrices.productId, product.id), isNull(productPrices.effectiveTo)))

    await db.insert(productPrices).values({
      organizationId: authContext.organizationId,
      productId: product.id,
      priceAmount: dto.priceAmount,
      currency: dto.currency,
      reason: dto.reason ?? null,
      changedByStaffId: authContext.actorType === 'staff' ? authContext.actorId : null,
    })

    const [updated] = await db
      .update(products)
      .set({ priceAmount: dto.priceAmount, currency: dto.currency })
      .where(eq(products.id, product.id))
      .returning()
    if (!updated) throw new Error('failed to update product price cache')
    return updated
  }

  private async loadProduct(db: Db, organizationId: string, id: string) {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    if (!product) throw new NotFoundException('product not found')
    return product
  }

  private async assertModifierGroupsBelongToTenant(db: Db, organizationId: string, modifierGroupIds: string[] | undefined) {
    if (!modifierGroupIds?.length) return
    const rows = await db
      .select({ id: modifierGroups.id })
      .from(modifierGroups)
      .where(and(eq(modifierGroups.organizationId, organizationId), inArray(modifierGroups.id, modifierGroupIds)))
    if (rows.length !== new Set(modifierGroupIds).size) {
      throw new NotFoundException('one or more modifier groups not found')
    }
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  async priceHistoryReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          productId: productPrices.productId,
          productName: sql<string>`MAX(${products.name})`,
          priceAmount: productPrices.priceAmount,
          currency: productPrices.currency,
          effectiveFrom: productPrices.effectiveFrom,
          effectiveTo: productPrices.effectiveTo,
          reason: productPrices.reason,
        })
        .from(productPrices)
        .innerJoin(products, eq(productPrices.productId, products.id))
        .where(and(eq(productPrices.organizationId, authContext.organizationId), eq(products.locationId, locationId), sql`${productPrices.createdAt} >= ${from}`, sql`${productPrices.createdAt} <= ${to}`))
        .orderBy(productPrices.effectiveFrom)
      return { from, to, rows }
    })
  }

  async unavailableItemsReport(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          id: products.id,
          name: products.name,
          categoryId: products.categoryId,
          priceAmount: products.priceAmount,
          currency: products.currency,
          autoRestoreAt: products.autoRestoreAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(and(eq(products.organizationId, authContext.organizationId), eq(products.locationId, locationId), eq(products.isAvailable, false), eq(products.status, 'active')))
        .orderBy(products.updatedAt)
      return { total: rows.length, rows }
    })
  }

  async categoryBreakdownReport(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          categoryId: products.categoryId,
          categoryName: sql<string>`MAX(${menuCategories.name})`,
          productCount: sql<number>`COUNT(*)`,
          avgPrice: sql<number>`COALESCE(AVG(${products.priceAmount}), 0)`,
          minPrice: sql<number>`COALESCE(MIN(${products.priceAmount}), 0)`,
          maxPrice: sql<number>`COALESCE(MAX(${products.priceAmount}), 0)`,
          totalValue: sql<number>`COALESCE(SUM(${products.priceAmount}), 0)`,
          availableCount: sql<number>`COUNT(*) FILTER (WHERE ${products.isAvailable} = true)`,
          unavailableCount: sql<number>`COUNT(*) FILTER (WHERE ${products.isAvailable} = false)`,
        })
        .from(products)
        .innerJoin(menuCategories, eq(products.categoryId, menuCategories.id))
        .where(and(eq(products.organizationId, authContext.organizationId), eq(products.locationId, locationId), ne(products.status, 'discontinued')))
        .groupBy(products.categoryId)
        .orderBy(sql`COUNT(*) DESC`)
      return { rows }
    })
  }
}
