import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  billItems,
  modifiers,
  orderDiscounts,
  orderItemModifiers,
  orderItems,
  orders,
  products,
  restaurantTables,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import {
  ORDER_ITEM_PRE_SEND_STATUSES,
  ORDER_ITEM_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS,
  ORDER_VOIDABLE_PRE_PAYMENT,
  TABLE_STATE_TRANSITIONS,
  type OrderItemStatus,
  type OrderStatus,
  type TableStatus,
} from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { ApprovalRequiredException } from '../../core/errors/approval-required.exception.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import { TenantSettingsService } from '../../core/tenant/tenant-settings.service.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { KdsService } from '../restaurant/kds.service.js'
import type { AddOrderItemDto } from './dto/add-order-item.dto.js'
import type { ApplyDiscountDto } from './dto/apply-discount.dto.js'
import type { CreateOrderDto } from './dto/create-order.dto.js'
import type { FireOrderDto } from './dto/fire-order.dto.js'
import type { SplitOrderDto } from './dto/split-order.dto.js'
import type { UpdateOrderItemDto } from './dto/update-order-item.dto.js'
import type { VoidOrderDto } from './dto/void-order.dto.js'

// Approval-request action keys (ApprovalsService), distinct from the base
// RBAC permission the caller already holds — same "elevated action, not just
// a permission" shape as ProductsService.LARGE_PRICE_CHANGE_ACTION.
const VOID_AFTER_SEND_ACTION = 'orders:void_after_send'
const COMP_ACTION = 'orders:comp_item'
const DISCOUNT_LARGE_ACTION = 'orders:discount_above_threshold'

const MANAGER_TIER_VOID_PERMISSION = 'orders:void_bill'

// Same header name as ProductsService/PermissionsGuard's own APPROVAL_HEADER
// const (each module defines its own rather than importing across domain
// modules — existing codebase convention, not new duplication introduced here).
export const APPROVAL_HEADER = 'x-approval-request-id'

// Per-location-overridable via tenant_settings (TenantSettingsService), same
// pattern as ProductsService's price-change threshold — this is only the
// fallback when a tenant hasn't configured one.
const DEFAULT_DISCOUNT_LARGE_THRESHOLD_PCT = 15
const DISCOUNT_LARGE_THRESHOLD_SETTING_KEY = 'order_discount_large_threshold_pct'

type OrderRow = typeof orders.$inferSelect
type OrderItemRow = typeof orderItems.$inferSelect
type BillRow = typeof bills.$inferSelect

export interface ListOrdersQuery {
  locationId?: string | undefined
  tableId?: string | undefined
  status?: string | undefined
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(TenantSettingsService) private readonly tenantSettings: TenantSettingsService,
    @Inject(KdsService) private readonly kdsService: KdsService,
  ) {}

  async list(authContext: AuthContext, query: ListOrdersQuery) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => {
      const conditions: SQL[] = [eq(orders.organizationId, authContext.organizationId)]
      if (query.locationId) conditions.push(eq(orders.locationId, query.locationId))
      if (query.tableId) conditions.push(eq(orders.tableId, query.tableId))
      if (query.status) conditions.push(eq(orders.status, query.status))
      return db.select().from(orders).where(and(...conditions))
    })
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, id)
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
      const itemIds = items.map((item) => item.id)
      const modifierRows = itemIds.length
        ? await db.select().from(orderItemModifiers).where(inArray(orderItemModifiers.orderItemId, itemIds))
        : []
      const billRows = await db.select().from(bills).where(eq(bills.orderId, id))
      return {
        ...order,
        items: items.map((item) => ({
          ...item,
          modifiers: modifierRows.filter((modifier) => modifier.orderItemId === item.id),
        })),
        bills: billRows,
      }
    })
  }

  // Opens an order directly into `open` (PRD 05 "Opening and building an
  // order") — `draft` stays in the state machine for a future not-yet-opened
  // cart (e.g. QR ordering), unused by this phase's own API.
  async create(authContext: AuthContext, dto: CreateOrderDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      if (dto.tableId) {
        // RLS-scoped SELECT — a foreign-tenant tableId is simply invisible on
        // this connection, same pattern as TablesService/ProductsService.
        const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, dto.tableId))
        if (!table) throw new NotFoundException('table not found')
      }

      const [created] = await db
        .insert(orders)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          tableId: dto.tableId ?? null,
          customerId: dto.customerId ?? null,
          staffId: authContext.actorType === 'staff' ? authContext.actorId : null,
          channel: dto.channel,
          currency: dto.currency,
        })
        .returning()
      if (!created) throw new Error('failed to create order')

      // Populate the forward-reference column P4 left for this phase to fill
      // in (packages/database/src/schema/restaurant/index.ts: "orderId ...
      // for P5 to populate once orders exists").
      if (dto.tableId) {
        await db.update(restaurantTables).set({ orderId: created.id }).where(eq(restaurantTables.id, dto.tableId))
      }

      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.opened',
      entityType: 'order',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async addItem(authContext: AuthContext, orderId: string, dto: AddOrderItemDto) {
    const item = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      await this.assertOwnOrderOrManager(db, authContext, order)

      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, dto.productId), eq(products.organizationId, authContext.organizationId)))
      if (!product) throw new NotFoundException('product not found')
      if (!product.isAvailable || !['active', 'seasonal'].includes(product.status)) {
        throw new BadRequestException({ code: 'product_unavailable', message: 'product is not currently available' })
      }

      const quantity = dto.quantity ?? 1
      let modifiersPriceAmount = 0
      const selectedModifiers: { id: string; name: string; priceDelta: number; currency: string }[] = []
      if (dto.modifierIds?.length) {
        const rows = await db
          .select()
          .from(modifiers)
          .where(and(eq(modifiers.organizationId, authContext.organizationId), inArray(modifiers.id, dto.modifierIds)))
        if (rows.length !== new Set(dto.modifierIds).size) throw new NotFoundException('one or more modifiers not found')
        for (const modifier of rows) {
          modifiersPriceAmount += modifier.priceDelta
          selectedModifiers.push({ id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta, currency: modifier.currency })
        }
      }

      // Edge case (PRD 05): once the order has an active bill, a new item
      // must be explicitly assigned to one — never silently defaulted.
      const activeBills = await db
        .select({ id: bills.id })
        .from(bills)
        .where(and(eq(bills.orderId, orderId), ne(bills.status, 'voided')))
      if (activeBills.length > 0 && !dto.billId) {
        throw new BadRequestException({
          code: 'bill_assignment_required',
          message: 'this order has already been split — specify billId to assign the new item to an existing bill',
        })
      }
      if (dto.billId && !activeBills.some((bill) => bill.id === dto.billId)) {
        throw new NotFoundException('bill not found on this order')
      }

      const totalAmount = (product.priceAmount + modifiersPriceAmount) * quantity

      const [created] = await db
        .insert(orderItems)
        .values({
          organizationId: authContext.organizationId,
          locationId: order.locationId,
          orderId,
          productId: product.id,
          nameSnapshot: product.name,
          localNameSnapshot: product.localName,
          seatNumber: dto.seatNumber ?? null,
          course: dto.course ?? null,
          kitchenNote: dto.kitchenNote ?? null,
          quantity,
          unitPriceAmount: product.priceAmount,
          modifiersPriceAmount,
          totalAmount,
          currency: product.currency,
          taxCategoryId: product.taxCategoryId,
        })
        .returning()
      if (!created) throw new Error('failed to add order item')

      if (selectedModifiers.length) {
        await db.insert(orderItemModifiers).values(
          selectedModifiers.map((modifier) => ({
            organizationId: authContext.organizationId,
            orderItemId: created.id,
            modifierId: modifier.id,
            nameSnapshot: modifier.name,
            priceDeltaAmount: modifier.priceDelta,
            currency: modifier.currency,
          })),
        )
      }

      if (dto.billId) {
        await db.insert(billItems).values({
          organizationId: authContext.organizationId,
          billId: dto.billId,
          orderItemId: created.id,
          allocatedAmount: totalAmount,
          currency: created.currency,
        })
      }

      await this.recomputeOrderTotals(db, authContext.organizationId, orderId)
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: item.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.item_added',
      entityType: 'order_item',
      entityId: item.id,
      newValue: item,
    })

    return item
  }

  async updateItem(authContext: AuthContext, orderId: string, itemId: string, dto: UpdateOrderItemDto, approvalRequestId?: string) {
    if (dto.status === 'served') return this.markServed(authContext, orderId, itemId)
    if (dto.status === 'voided' || dto.status === 'comped') {
      return this.resolveItemStatusChange(authContext, orderId, itemId, dto.status, dto.reason, approvalRequestId)
    }

    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      await this.assertOwnOrderOrManager(db, authContext, order)
      const item = await this.loadOrderItem(db, authContext.organizationId, orderId, itemId)

      if (item.status !== 'draft' && (dto.quantity !== undefined || dto.course !== undefined || dto.kitchenNote !== undefined)) {
        throw new BadRequestException({
          code: 'item_already_sent',
          message: 'quantity/course/kitchenNote can only change while the item is still draft',
        })
      }

      const quantity = dto.quantity ?? item.quantity
      const totalAmount = (item.unitPriceAmount + item.modifiersPriceAmount) * quantity

      const [updated] = await db
        .update(orderItems)
        .set({
          ...(dto.quantity !== undefined && { quantity, totalAmount }),
          ...(dto.course !== undefined && { course: dto.course }),
          ...(dto.kitchenNote !== undefined && { kitchenNote: dto.kitchenNote }),
        })
        .where(eq(orderItems.id, itemId))
        .returning()
      if (!updated) throw new Error('failed to update order item')

      await this.recomputeOrderTotals(db, authContext.organizationId, orderId)
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.item_updated',
      entityType: 'order_item',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // "Send"/"fire" (PRD 05). Omit itemIds to fire every draft item; include
  // specific ids for a partial fire (held courses fired later).
  async send(authContext: AuthContext, orderId: string, dto: FireOrderDto) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      await this.assertOwnOrderOrManager(db, authContext, order)

      const conditions = [eq(orderItems.orderId, orderId), eq(orderItems.status, 'draft')]
      if (dto.itemIds?.length) conditions.push(inArray(orderItems.id, dto.itemIds))
      const toFire = await db.select().from(orderItems).where(and(...conditions))
      if (toFire.length === 0) throw new BadRequestException({ code: 'no_draft_items', message: 'no draft items to send' })

      await db
        .update(orderItems)
        .set({ status: 'sent', sentAt: sql`now()` })
        .where(inArray(orderItems.id, toFire.map((item) => item.id)))

      const fromStatus = order.status as OrderStatus
      let updatedOrder = order
      if (fromStatus === 'open') {
        this.assertLegalOrderTransition(fromStatus, 'sent_to_kitchen')
        const [next] = await db.update(orders).set({ status: 'sent_to_kitchen' }).where(eq(orders.id, orderId)).returning()
        if (next) updatedOrder = next
      }

      // Table 'seated' -> 'ordered' once items are actually fired (PRD 04/05
      // co-drive table state) — best-effort, silently skipped when the
      // table's current status doesn't legally allow it (e.g. a second
      // course fired after the table is already 'ordered').
      if (order.tableId) {
        const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, order.tableId))
        if (table && TABLE_STATE_TRANSITIONS[table.status as TableStatus]?.includes('ordered')) {
          await db.update(restaurantTables).set({ status: 'ordered' }).where(eq(restaurantTables.id, order.tableId))
        }
      }

      await this.kdsService.createTicketsForSentItems(db, authContext, updatedOrder, toFire)

      return { order: updatedOrder, firedItemIds: toFire.map((item) => item.id) }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.order.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.items_sent',
      entityType: 'order',
      entityId: orderId,
      newValue: { itemIds: result.firedItemIds },
    })

    return result.order
  }

  async applyDiscount(authContext: AuthContext, orderId: string, dto: ApplyDiscountDto, approvalRequestId?: string) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      await this.assertOwnOrderOrManager(db, authContext, order)

      const targetItem = dto.orderItemId ? await this.loadOrderItem(db, authContext.organizationId, orderId, dto.orderItemId) : undefined
      const baseAmount = targetItem ? targetItem.totalAmount - targetItem.discountAmount : order.subtotalAmount - order.discountAmount
      if (baseAmount <= 0) throw new BadRequestException({ code: 'nothing_to_discount', message: 'nothing left to discount' })

      const amountApplied =
        dto.discountType === 'percentage' ? Math.round((baseAmount * dto.discountValue) / 100) : Math.min(dto.discountValue, baseAmount)
      if (amountApplied <= 0) throw new BadRequestException({ code: 'invalid_discount', message: 'discount amount must be greater than zero' })

      const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
      if (!granted.includes('orders:discount_small')) {
        throw new ForbiddenException({ code: 'permission_denied', message: 'missing permission: orders:discount_small' })
      }

      const pctOfBase = (amountApplied / baseAmount) * 100
      const thresholdPct = await this.tenantSettings.get(
        db,
        authContext.organizationId,
        DISCOUNT_LARGE_THRESHOLD_SETTING_KEY,
        DEFAULT_DISCOUNT_LARGE_THRESHOLD_PCT,
        order.locationId,
      )
      const isLarge = pctOfBase > thresholdPct

      if (!isLarge || granted.includes('orders:discount_large')) {
        return this.finalizeDiscount(db, authContext, order, targetItem, dto, amountApplied)
      }

      if (approvalRequestId) {
        const consumed = await this.approvalsService.tryConsume(db, {
          id: approvalRequestId,
          organizationId: authContext.organizationId,
          requestedByActorId: authContext.actorId,
          action: DISCOUNT_LARGE_ACTION,
        })
        if (consumed) return this.finalizeDiscount(db, authContext, order, targetItem, dto, amountApplied)
      }

      const approval = await this.approvalsService.create(db, {
        organizationId: authContext.organizationId,
        locationId: order.locationId,
        requestedByActorId: authContext.actorId,
        action: DISCOUNT_LARGE_ACTION,
        entityType: targetItem ? 'order_item' : 'order',
        entityId: targetItem?.id ?? order.id,
        reason: dto.reason ?? `discount ${dto.discountType} ${dto.discountValue} (${pctOfBase.toFixed(1)}% of base)`,
      })
      return { pending: approval.id } as const
    })

    if ('pending' in result) {
      await this.auditLog.record({
        organizationId: authContext.organizationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'order.discount_requires_approval',
        entityType: 'order',
        entityId: orderId,
      })
      throw new ApprovalRequiredException(result.pending)
    }

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.discount_applied',
      entityType: result.orderItemId ? 'order_item' : 'order',
      entityId: result.orderItemId ?? result.orderId,
      newValue: result,
      reason: result.reason,
    })

    return result
  }

  // Whole-order void — manager-tier only (no approval-override path; a
  // supervisor+ either has orders:void_bill or they don't). Per-item voids
  // go through updateItem/resolveItemStatusChange instead.
  async voidOrder(authContext: AuthContext, orderId: string, dto: VoidOrderDto) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      if (!ORDER_VOIDABLE_PRE_PAYMENT.includes(order.status as OrderStatus)) {
        throw new BadRequestException({ code: 'order_not_voidable', message: `order in status "${order.status}" cannot be voided` })
      }
      this.assertLegalOrderTransition(order.status as OrderStatus, 'voided')

      await db
        .update(orderItems)
        .set({ status: 'voided', voidReason: dto.reason, resolvedByActorId: authContext.actorId })
        .where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, 'voided'), ne(orderItems.status, 'comped')))

      const [updated] = await db.update(orders).set({ status: 'voided' }).where(eq(orders.id, orderId)).returning()
      if (!updated) throw new Error('failed to void order')
      await this.recomputeOrderTotals(db, authContext.organizationId, orderId)

      if (order.tableId) {
        await db.update(restaurantTables).set({ orderId: null }).where(eq(restaurantTables.id, order.tableId))
      }

      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.voided',
      entityType: 'order',
      entityId: result.id,
      reason: dto.reason,
    })

    return result
  }

  // Splitting into bills (PRD 05: by item / by seat / evenly). Items are
  // referenced via billItems, never duplicated — see
  // packages/database/src/schema/restaurant/index.ts.
  async split(authContext: AuthContext, orderId: string, dto: SplitOrderDto) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      await this.assertOwnOrderOrManager(db, authContext, order)

      const activeBills = await db.select({ id: bills.id }).from(bills).where(and(eq(bills.orderId, orderId), ne(bills.status, 'voided')))
      if (activeBills.length > 0) throw new BadRequestException({ code: 'already_split', message: 'order already has active bills' })

      const items = await db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, 'voided')))
      if (items.length === 0) throw new BadRequestException({ code: 'no_items_to_split', message: 'order has no items to split' })

      const groups = this.buildSplitGroups(dto, items)

      const createdBills: BillRow[] = []
      for (const group of groups) {
        const totalAmount = group.items.reduce((sum, entry) => sum + entry.amount, 0)
        const [bill] = await db
          .insert(bills)
          .values({
            organizationId: authContext.organizationId,
            locationId: order.locationId,
            orderId,
            billNumber: group.billNumber,
            splitMethod: dto.method,
            subtotalAmount: totalAmount,
            totalAmount,
            currency: order.currency,
          })
          .returning()
        if (!bill) throw new Error('failed to create bill')

        if (group.items.length) {
          await db.insert(billItems).values(
            group.items.map(({ item, amount }) => ({
              organizationId: authContext.organizationId,
              billId: bill.id,
              orderItemId: item.id,
              allocatedAmount: amount,
              currency: item.currency,
            })),
          )
        }
        createdBills.push(bill)
      }

      let updatedOrder = order
      if (ORDER_STATUS_TRANSITIONS[order.status as OrderStatus]?.includes('bill_requested')) {
        const [next] = await db.update(orders).set({ status: 'bill_requested' }).where(eq(orders.id, orderId)).returning()
        if (next) updatedOrder = next
      }

      if (order.tableId) {
        const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, order.tableId))
        if (table && TABLE_STATE_TRANSITIONS[table.status as TableStatus]?.includes('bill_requested')) {
          await db.update(restaurantTables).set({ status: 'bill_requested' }).where(eq(restaurantTables.id, order.tableId))
        }
      }

      return { order: updatedOrder, createdBills }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.order.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.split',
      entityType: 'order',
      entityId: orderId,
      newValue: { method: dto.method, billIds: result.createdBills.map((bill) => bill.id) },
    })

    return result.createdBills
  }

  // Deliberately narrow: PRD 05 explicitly hands payment capture itself off
  // to P7 ("a bill reaching payment_pending hands off to it"). This phase
  // only builds the completion check + table-release cascade — the positive
  // path (all bills actually `paid`) isn't reachable until P7 exists to flip
  // a bill's status; the negative path (rejecting a close attempt while bills
  // are unpaid) is real, correct, and verifiable today.
  async close(authContext: AuthContext, orderId: string) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      const orderBills = await db.select().from(bills).where(and(eq(bills.orderId, orderId), ne(bills.status, 'voided')))
      if (orderBills.length === 0) {
        throw new BadRequestException({ code: 'no_bills', message: 'order has no bills to close — split it first' })
      }
      const unpaid = orderBills.filter((bill) => bill.status !== 'paid')
      if (unpaid.length > 0) {
        throw new BadRequestException({
          code: 'bills_not_paid',
          message: `${unpaid.length} bill(s) are not yet paid — payment capture is P7 (Payments Core) scope, not yet built`,
          pendingBillIds: unpaid.map((bill) => bill.id),
        })
      }

      this.assertLegalOrderTransition(order.status as OrderStatus, 'paid')
      const [updated] = await db.update(orders).set({ status: 'paid', closedAt: sql`now()` }).where(eq(orders.id, orderId)).returning()
      if (!updated) throw new Error('failed to close order')

      if (order.tableId) {
        await db.update(restaurantTables).set({ status: 'cleaning', orderId: null }).where(eq(restaurantTables.id, order.tableId))
      }

      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order.closed',
      entityType: 'order',
      entityId: result.id,
    })

    return result
  }

  private buildSplitGroups(dto: SplitOrderDto, items: OrderItemRow[]): { billNumber: number; items: { item: OrderItemRow; amount: number }[] }[] {
    if (dto.method === 'by_item') {
      if (!dto.assignments?.length) throw new BadRequestException({ code: 'assignments_required', message: 'assignments are required for method=by_item' })
      const itemsById = new Map(items.map((item) => [item.id, item]))
      const assignedIds = new Set(dto.assignments.map((assignment) => assignment.orderItemId))
      if (assignedIds.size !== items.length || items.some((item) => !assignedIds.has(item.id))) {
        throw new BadRequestException({ code: 'incomplete_assignment', message: 'every order item must be assigned to exactly one bill' })
      }

      const byBillNumber = new Map<number, OrderItemRow[]>()
      for (const assignment of dto.assignments) {
        const item = itemsById.get(assignment.orderItemId)
        if (!item) throw new NotFoundException(`order item ${assignment.orderItemId} not found on this order`)
        const list = byBillNumber.get(assignment.billNumber) ?? []
        list.push(item)
        byBillNumber.set(assignment.billNumber, list)
      }

      return [...byBillNumber.entries()]
        .sort(([a], [b]) => a - b)
        .map(([billNumber, its]) => ({ billNumber, items: its.map((item) => ({ item, amount: item.totalAmount - item.discountAmount })) }))
    }

    if (dto.method === 'by_seat') {
      const bySeat = new Map<string, OrderItemRow[]>()
      for (const item of items) {
        const key = item.seatNumber !== null ? String(item.seatNumber) : 'unassigned'
        const list = bySeat.get(key) ?? []
        list.push(item)
        bySeat.set(key, list)
      }
      const orderedKeys = [...bySeat.keys()].sort((a, b) => {
        if (a === 'unassigned') return 1
        if (b === 'unassigned') return -1
        return Number(a) - Number(b)
      })
      return orderedKeys.map((key, index) => ({
        billNumber: index + 1,
        items: bySeat.get(key)!.map((item) => ({ item, amount: item.totalAmount - item.discountAmount })),
      }))
    }

    // 'evenly' — each item's net amount split n ways; remainder cents go to
    // the earliest bills first (PRD 05: "rounding remainder assigned to bill
    // 1, deterministically").
    if (!dto.evenCount) throw new BadRequestException({ code: 'even_count_required', message: 'evenCount is required for method=evenly' })
    const n = dto.evenCount
    const perBill: { item: OrderItemRow; amount: number }[][] = Array.from({ length: n }, () => [])
    for (const item of items) {
      const net = item.totalAmount - item.discountAmount
      const base = Math.floor(net / n)
      const remainder = net - base * n
      for (let i = 0; i < n; i++) {
        const amount = base + (i < remainder ? 1 : 0)
        if (amount > 0) perBill[i]!.push({ item, amount })
      }
    }
    return perBill.map((its, index) => ({ billNumber: index + 1, items: its }))
  }

  private async markServed(authContext: AuthContext, orderId: string, itemId: string) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      await this.assertOwnOrderOrManager(db, authContext, order)
      const item = await this.loadOrderItem(db, authContext.organizationId, orderId, itemId)
      this.assertLegalItemTransition(item.status as OrderItemStatus, 'served')

      const [updated] = await db.update(orderItems).set({ status: 'served' }).where(eq(orderItems.id, itemId)).returning()
      if (!updated) throw new Error('failed to mark order item served')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'order_item.served',
      entityType: 'order_item',
      entityId: row.id,
    })

    return row
  }

  private async resolveItemStatusChange(
    authContext: AuthContext,
    orderId: string,
    itemId: string,
    targetStatus: 'voided' | 'comped',
    reason: string | undefined,
    approvalRequestId: string | undefined,
  ) {
    if (!reason) {
      throw new BadRequestException({ code: 'reason_required', message: `${targetStatus === 'voided' ? 'void' : 'comp'} requires a reason` })
    }

    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)
      const item = await this.loadOrderItem(db, authContext.organizationId, orderId, itemId)
      const granted = await this.permissionsService.listGrantedPermissions(db, authContext)

      return targetStatus === 'voided'
        ? this.applyVoid(db, authContext, order, item, reason, granted, approvalRequestId)
        : this.applyComp(db, authContext, order, item, reason, granted, approvalRequestId)
    })

    if ('pending' in result) {
      await this.auditLog.record({
        organizationId: authContext.organizationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: targetStatus === 'voided' ? 'order_item.void_requires_approval' : 'order_item.comp_requires_approval',
        entityType: 'order_item',
        entityId: itemId,
        reason,
      })
      throw new ApprovalRequiredException(result.pending)
    }

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action:
        targetStatus === 'voided'
          ? result.status === 'void_requested'
            ? 'order_item.void_requested'
            : 'order_item.voided'
          : 'order_item.comped',
      entityType: 'order_item',
      entityId: result.id,
      reason,
    })

    return result
  }

  // Pre-send (still `draft`): immediate, waiter-level orders:void_item, no
  // approval (PRD 05: "waiter can void own item pre-kitchen-send"). Anything
  // past that (including an already-served item — master plan edge case:
  // escalates to void_bill-level regardless of value) needs the manager tier
  // or a consumed approval, same shape as ProductsService.changePrice.
  private async applyVoid(
    db: Db,
    authContext: AuthContext,
    order: OrderRow,
    item: OrderItemRow,
    reason: string,
    granted: string[],
    approvalRequestId: string | undefined,
  ) {
    if (!granted.includes('orders:void_item')) {
      throw new ForbiddenException({ code: 'permission_denied', message: 'missing permission: orders:void_item' })
    }

    if (item.status === 'void_requested') {
      throw new BadRequestException({
        code: 'kitchen_void_pending',
        message: 'this item is already awaiting kitchen acknowledgment before it can be voided',
      })
    }

    if (ORDER_ITEM_PRE_SEND_STATUSES.has(item.status as OrderItemStatus)) {
      this.assertLegalItemTransition(item.status as OrderItemStatus, 'voided')
      return this.finalizeItemStatus(db, authContext, item, 'voided', reason)
    }

    const requiresKitchenAck = ['sent', 'accepted', 'in_progress', 'ready'].includes(item.status)
    const finalizeApprovedVoid = async () => {
      if (requiresKitchenAck) {
        return this.kdsService.requestVoidForOrderItem(db, authContext, item, reason)
      }
      this.assertLegalItemTransition(item.status as OrderItemStatus, 'voided')
      return this.finalizeItemStatus(db, authContext, item, 'voided', reason)
    }

    if (granted.includes(MANAGER_TIER_VOID_PERMISSION)) {
      return finalizeApprovedVoid()
    }

    if (approvalRequestId) {
      const consumed = await this.approvalsService.tryConsume(db, {
        id: approvalRequestId,
        organizationId: authContext.organizationId,
        requestedByActorId: authContext.actorId,
        action: VOID_AFTER_SEND_ACTION,
      })
      if (consumed) return finalizeApprovedVoid()
    }

    const approval = await this.approvalsService.create(db, {
      organizationId: authContext.organizationId,
      locationId: order.locationId,
      requestedByActorId: authContext.actorId,
      action: VOID_AFTER_SEND_ACTION,
      entityType: 'order_item',
      entityId: item.id,
      reason: `void after send: ${reason}`,
    })
    return { pending: approval.id } as const
  }

  // Comp always requires manager approval — no pre-send exemption (master
  // plan section 23: "Comp: ... Manager approval required by default").
  private async applyComp(
    db: Db,
    authContext: AuthContext,
    order: OrderRow,
    item: OrderItemRow,
    reason: string,
    granted: string[],
    approvalRequestId: string | undefined,
  ) {
    this.assertLegalItemTransition(item.status as OrderItemStatus, 'comped')

    if (granted.includes(MANAGER_TIER_VOID_PERMISSION)) {
      return this.finalizeItemStatus(db, authContext, item, 'comped', reason)
    }

    if (approvalRequestId) {
      const consumed = await this.approvalsService.tryConsume(db, {
        id: approvalRequestId,
        organizationId: authContext.organizationId,
        requestedByActorId: authContext.actorId,
        action: COMP_ACTION,
      })
      if (consumed) return this.finalizeItemStatus(db, authContext, item, 'comped', reason)
    }

    const approval = await this.approvalsService.create(db, {
      organizationId: authContext.organizationId,
      locationId: order.locationId,
      requestedByActorId: authContext.actorId,
      action: COMP_ACTION,
      entityType: 'order_item',
      entityId: item.id,
      reason,
    })
    return { pending: approval.id } as const
  }

  private async finalizeItemStatus(db: Db, authContext: AuthContext, item: OrderItemRow, status: 'voided' | 'comped', reason: string) {
    const patch: Partial<OrderItemRow> = { status, resolvedByActorId: authContext.actorId }
    if (status === 'voided') patch.voidReason = reason
    // Comp reduces the item's price to zero (master plan section 23) — done
    // by discounting it away in full, not by zeroing totalAmount itself, so
    // the original gross value survives for the comp report.
    if (status === 'comped') {
      patch.compReason = reason
      patch.discountAmount = item.totalAmount
    }

    const [updated] = await db.update(orderItems).set(patch).where(eq(orderItems.id, item.id)).returning()
    if (!updated) throw new Error(`failed to mark order item ${status}`)

    await this.recomputeOrderTotals(db, authContext.organizationId, item.orderId)
    return updated
  }

  private async finalizeDiscount(
    db: Db,
    authContext: AuthContext,
    order: OrderRow,
    targetItem: OrderItemRow | undefined,
    dto: ApplyDiscountDto,
    amountApplied: number,
  ) {
    const [discountRow] = await db
      .insert(orderDiscounts)
      .values({
        organizationId: authContext.organizationId,
        locationId: order.locationId,
        orderId: order.id,
        orderItemId: targetItem?.id ?? null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        amountApplied,
        currency: order.currency,
        reason: dto.reason ?? null,
        appliedByActorId: authContext.actorId,
      })
      .returning()
    if (!discountRow) throw new Error('failed to record discount')

    if (targetItem) {
      await db
        .update(orderItems)
        .set({ discountAmount: targetItem.discountAmount + amountApplied })
        .where(eq(orderItems.id, targetItem.id))
    }

    await this.recomputeOrderTotals(db, authContext.organizationId, order.id)
    return discountRow
  }

  // Recomputed from current non-voided items + discounts on every mutation,
  // never hand-edited (PRD 05 Business Rules). taxAmount/serviceChargeAmount
  // stay 0 — Module 18's country tax adapter and any service-charge config
  // don't exist yet, same honestly-scoped gap as order_items.taxCategoryId
  // being a forward-reference placeholder.
  private async recomputeOrderTotals(db: Db, organizationId: string, orderId: string) {
    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.organizationId, organizationId), ne(orderItems.status, 'voided')))
    const subtotalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0)
    const itemDiscounts = items.reduce((sum, item) => sum + item.discountAmount, 0)

    const [orderLevelDiscountRow] = await db
      .select({ total: sql<string>`coalesce(sum(${orderDiscounts.amountApplied}), 0)` })
      .from(orderDiscounts)
      .where(and(eq(orderDiscounts.orderId, orderId), isNull(orderDiscounts.orderItemId)))
    const discountAmount = itemDiscounts + Number(orderLevelDiscountRow?.total ?? 0)
    const totalAmount = subtotalAmount - discountAmount

    await db.update(orders).set({ subtotalAmount, discountAmount, totalAmount }).where(eq(orders.id, orderId))
  }

  private async loadOrder(db: Db, organizationId: string, id: string): Promise<OrderRow> {
    const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)))
    if (!order) throw new NotFoundException('order not found')
    return order
  }

  private async loadOrderItem(db: Db, organizationId: string, orderId: string, itemId: string): Promise<OrderItemRow> {
    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId), eq(orderItems.organizationId, organizationId)))
    if (!item) throw new NotFoundException('order item not found')
    return item
  }

  private async assertOwnOrderOrManager(db: Db, authContext: AuthContext, order: OrderRow) {
    if (!order.staffId || order.staffId === authContext.actorId) return
    const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
    if (!granted.includes('orders:update_any')) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'order belongs to another staff member — missing permission: orders:update_any',
      })
    }
  }

  private assertLegalOrderTransition(from: OrderStatus, to: OrderStatus) {
    if (!ORDER_STATUS_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException({ code: 'illegal_order_transition', message: `cannot transition order from "${from}" to "${to}"`, from, to })
    }
  }

  private assertLegalItemTransition(from: OrderItemStatus, to: OrderItemStatus) {
    if (!ORDER_ITEM_STATUS_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException({
        code: 'illegal_order_item_transition',
        message: `cannot transition order item from "${from}" to "${to}"`,
        from,
        to,
      })
    }
  }
}
