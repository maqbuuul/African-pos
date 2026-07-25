import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common'
import { and, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  billItems,
  orderDiscounts,
  orderItemModifiers,
  orderItems,
  orders,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import {
  ORDER_ITEM_PRE_SEND_STATUSES,
  ORDER_ITEM_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS,
  ORDER_VOIDABLE_PRE_PAYMENT,
  type OrderItemStatus,
  type OrderStatus,
} from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { OutboxService } from '../../core/events/outbox.service.js'
import { ApprovalRequiredException } from '../../core/errors/approval-required.exception.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import { TenantSettingsService } from '../../core/tenant/tenant-settings.service.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { InventoryService } from '../inventory/inventory.service.js'
import { ModifierGroupsService } from '../products/modifier-groups.service.js'
import { ProductsService } from '../products/products.service.js'
import { KdsService } from '../restaurant/kds.service.js'
import { TablesService } from '../restaurant/tables.service.js'
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
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(TenantSettingsService) private readonly tenantSettings: TenantSettingsService,
    @Inject(forwardRef(() => KdsService)) private readonly kdsService: KdsService,
    @Inject(TablesService) private readonly tablesService: TablesService,
    @Inject(ProductsService) private readonly productsService: ProductsService,
    @Inject(ModifierGroupsService) private readonly modifierGroupsService: ModifierGroupsService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
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
        await this.tablesService.getByIdInTx(db, authContext.organizationId, dto.tableId)
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
        await this.tablesService.assignOrder(db, authContext.organizationId, dto.tableId, created.id)
      }

      await this.outbox.persistAndEmit(db, {
        eventType: 'OrderOpened',
        organizationId: authContext.organizationId,
        locationId: created.locationId,
        entityType: 'order',
        entityId: created.id,
        data: { channel: created.channel, tableId: created.tableId },
        occurredAt: new Date(),
      })

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

      const product = await this.productsService.getProductById(db, authContext.organizationId, dto.productId)
      if (!product.isAvailable || !['active', 'seasonal'].includes(product.status)) {
        throw new BadRequestException({ code: 'product_unavailable', message: 'product is not currently available' })
      }

      const quantity = dto.quantity ?? 1
      let modifiersPriceAmount = 0
      const selectedModifiers: { id: string; name: string; priceDelta: number; currency: string }[] = []
      if (dto.modifierIds?.length) {
        const rows = await this.modifierGroupsService.getModifiersByIds(db, authContext.organizationId, dto.modifierIds)
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
        await this.tablesService.setStatusInTx(db, authContext.organizationId, order.tableId, 'ordered')
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
        await this.tablesService.assignOrder(db, authContext.organizationId, order.tableId, null)
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
        await this.tablesService.setStatusInTx(db, authContext.organizationId, order.tableId, 'bill_requested')
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
  // only builds the completion check + table-release cascade — the negative
  // path (rejecting a close attempt while bills are unpaid) is real; the
  // positive path is the same one PaymentsService's settlement flow drives
  // automatically via applyPaymentCompletion below (P7 now built).
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
          message: `${unpaid.length} bill(s) are not yet paid`,
          pendingBillIds: unpaid.map((bill) => bill.id),
        })
      }

      return this.finalizeOrderPaid(db, authContext.organizationId, order)
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

  private async finalizeOrderPaid(db: Db, organizationId: string, order: OrderRow): Promise<OrderRow> {
    // The state machine models a `payment_pending` step between
    // `bill_requested` and `paid` (ORDER_STATUS_TRANSITIONS), but the
    // staff-facing cash/card/mobile-money flows (unlike qr-order's) never
    // explicitly set it — walk through it here so a straight
    // `bill_requested` -> `paid` completion (the common case once every
    // bill is settled) still passes validation instead of being rejected.
    let fromStatus = order.status as OrderStatus
    if (fromStatus !== 'payment_pending' && ORDER_STATUS_TRANSITIONS[fromStatus]?.includes('payment_pending')) {
      await db.update(orders).set({ status: 'payment_pending' }).where(eq(orders.id, order.id))
      fromStatus = 'payment_pending'
    }
    this.assertLegalOrderTransition(fromStatus, 'paid')
    const [updated] = await db.update(orders).set({ status: 'paid', closedAt: sql`now()` }).where(eq(orders.id, order.id)).returning()
    if (!updated) throw new Error('failed to close order')

    if (order.tableId) {
      await this.tablesService.setStatusInTx(db, organizationId, order.tableId, 'cleaning')
      await this.tablesService.assignOrder(db, organizationId, order.tableId, null)
    }

    return updated
  }

  // ---------------------------------------------------------------------------
  // db-first: called from PaymentsService's own transaction (bills/orders
  // are orders-owned — see orders.module.ts's `owns` manifest) so a bill's
  // paid status and its order's paid status flip atomically with the
  // payment confirmation that caused them, and go through the same
  // ORDER_STATUS_TRANSITIONS validation every other order-status write does.
  // ---------------------------------------------------------------------------

  // Marks a single bill paid (idempotent — returns null if already paid or
  // missing) and reports whether every bill on its order is now paid too.
  // Does not touch the order itself — see applyPaymentCompletion.
  async markBillFullyPaid(db: Db, organizationId: string, billId: string): Promise<{ orderId: string; allBillsOnOrderPaid: boolean } | null> {
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.organizationId, organizationId)))
    if (!bill || bill.status === 'paid') return null

    await db.update(bills).set({ status: 'paid', paidAt: sql`now()`, updatedAt: sql`now()` }).where(eq(bills.id, billId))

    const allOrderBills = await db.select().from(bills).where(and(eq(bills.orderId, bill.orderId), eq(bills.organizationId, organizationId)))
    const allBillsOnOrderPaid = allOrderBills.every((b) => (b.id === billId ? true : b.status === 'paid'))
    return { orderId: bill.orderId, allBillsOnOrderPaid }
  }

  // Flips the order to 'paid' + releases its table, same cascade as close().
  async applyPaymentCompletion(db: Db, organizationId: string, orderId: string): Promise<void> {
    const order = await this.loadOrder(db, organizationId, orderId)
    await this.finalizeOrderPaid(db, organizationId, order)
  }

  // billItems -> orderItems join for PaymentsService's card-surcharge
  // computation (billItems is orders-owned; orderItems too).
  async getProductIdsForBillItems(
    db: Db,
    organizationId: string,
    billId: string,
  ): Promise<{ orderItemId: string; productId: string; allocatedAmount: number }[]> {
    return db
      .select({ orderItemId: billItems.orderItemId, allocatedAmount: billItems.allocatedAmount, productId: orderItems.productId })
      .from(billItems)
      .innerJoin(orderItems, eq(billItems.orderItemId, orderItems.id))
      .where(and(eq(billItems.billId, billId), eq(billItems.organizationId, organizationId)))
  }

  // billItems -> orderItems join for ReceiptsService's line-item rendering
  // (billItems/orderItems are orders-owned). allocatedAmount is this bill's
  // share of the item's total — equal to the full item total in the common
  // unsplit case, a fraction of it when the item was split across bills.
  async getBillItemsForReceipt(
    db: Db,
    organizationId: string,
    billId: string,
  ): Promise<{ name: string; quantity: number; unitPrice: number; totalPrice: number }[]> {
    const rows = await db
      .select({
        nameSnapshot: orderItems.nameSnapshot,
        quantity: orderItems.quantity,
        allocatedAmount: billItems.allocatedAmount,
      })
      .from(billItems)
      .innerJoin(orderItems, eq(billItems.orderItemId, orderItems.id))
      .where(and(eq(billItems.billId, billId), eq(billItems.organizationId, organizationId)))
    return rows.map((row) => ({
      name: row.nameSnapshot,
      quantity: row.quantity,
      unitPrice: row.quantity > 0 ? Math.round(row.allocatedAmount / row.quantity) : row.allocatedAmount,
      totalPrice: row.allocatedAmount,
    }))
  }

  // ---------------------------------------------------------------------------
  // db-first: called from KdsService's own transaction (kitchen-initiated
  // actions — bump/recall/void-acknowledge — hit KdsController directly,
  // not through this controller) so order_item/order status writes stay
  // owned here and go through the same ORDER_ITEM_STATUS_TRANSITIONS /
  // ORDER_STATUS_TRANSITIONS validation every other write does.
  // ---------------------------------------------------------------------------

  async syncItemStatusFromKitchen(
    db: Db,
    organizationId: string,
    orderItemId: string,
    nextStatus: OrderItemStatus,
    resolvedByActorId?: string,
    voidReason?: string,
  ): Promise<OrderItemRow> {
    const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, orderItemId), eq(orderItems.organizationId, organizationId)))
    if (!item) throw new NotFoundException('order item not found')
    if (item.status === nextStatus) return item
    this.assertLegalItemTransition(item.status as OrderItemStatus, nextStatus)

    const patch: Partial<OrderItemRow> = { status: nextStatus }
    if (nextStatus === 'voided' && resolvedByActorId) patch.resolvedByActorId = resolvedByActorId
    if (nextStatus === 'void_requested' && voidReason) patch.voidReason = voidReason

    const [updated] = await db.update(orderItems).set(patch).where(eq(orderItems.id, orderItemId)).returning()
    if (!updated) throw new Error('failed to sync order item from kitchen state')
    return updated
  }

  // Collapses what used to be two near-duplicate implementations
  // (this file's own recomputeOrderTotals + kds.service.ts's
  // recomputeOrderReadiness) into one call KdsService makes after every
  // kitchen-ticket-item transition.
  async recomputeReadinessAndTotals(db: Db, organizationId: string, orderId: string): Promise<void> {
    await this.recomputeOrderTotals(db, organizationId, orderId)

    const order = await this.loadOrder(db, organizationId, orderId)
    if (!['sent_to_kitchen', 'partially_ready', 'ready', 'served'].includes(order.status)) return

    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, 'voided'), ne(orderItems.status, 'comped')))
    if (items.length === 0) return

    const nextStatus: OrderStatus = items.every((item) => item.status === 'served')
      ? 'served'
      : items.every((item) => ['ready', 'served'].includes(item.status))
        ? 'ready'
        : items.some((item) => ['ready', 'served'].includes(item.status))
          ? 'partially_ready'
          : 'sent_to_kitchen'

    if (nextStatus !== order.status && ORDER_STATUS_TRANSITIONS[order.status as OrderStatus]?.includes(nextStatus)) {
      await db.update(orders).set({ status: nextStatus }).where(eq(orders.id, orderId))
      if (nextStatus === 'ready' && order.tableId) {
        await this.tablesService.setStatusInTx(db, organizationId, order.tableId, 'food_ready')
      }
    }
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

      await this.inventoryService.deductForRecipeSale(db, authContext, order.locationId, item.productId, itemId, item.quantity)

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

  // ---------------------------------------------------------------------------
  // db-first / QrOrderService support. QrOrderModule owns no tables (see
  // qr-order.module.ts's `owns: []`) — order/order_item/bill creation and
  // status transitions for a customer table-session cart are orders-owned,
  // so they live here instead of being duplicated inline in that module.
  // ---------------------------------------------------------------------------

  // Draft status (not `open`, unlike the staff-facing create()) is
  // load-bearing: reports.service.ts/whatsapp-reports.service.ts explicitly
  // filter draft orders out of sales figures, and a QR cart isn't a real
  // order until the customer actually submits it.
  async createDraftOrderWithItems(
    db: Db,
    params: { organizationId: string; locationId: string; tableId: string; currency: string },
    items: { productId: string; quantity: number; modifierIds?: string[]; notes?: string; sessionLabel?: string }[],
  ): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
    const [order] = await db
      .insert(orders)
      .values({
        organizationId: params.organizationId,
        locationId: params.locationId,
        tableId: params.tableId,
        channel: 'qr_table',
        status: 'draft',
        currency: params.currency,
      })
      .returning()
    if (!order) throw new Error('failed to create order')

    const createdItems: OrderItemRow[] = []
    for (const item of items) {
      const [product] = await this.productsService.getProductsByIds(db, params.organizationId, [item.productId])
      if (!product) continue

      const modifierRows = item.modifierIds?.length
        ? await this.modifierGroupsService.getModifiersByIds(db, params.organizationId, item.modifierIds)
        : []
      const modsPrice = modifierRows.reduce((sum, mod) => sum + mod.priceDelta, 0)

      const [oi] = await db
        .insert(orderItems)
        .values({
          organizationId: params.organizationId,
          locationId: params.locationId,
          orderId: order.id,
          productId: product.id,
          nameSnapshot: product.name,
          localNameSnapshot: product.localName,
          quantity: item.quantity,
          kitchenNote: item.notes ?? null,
          unitPriceAmount: product.priceAmount,
          modifiersPriceAmount: modsPrice,
          totalAmount: (product.priceAmount + modsPrice) * item.quantity,
          discountAmount: 0,
          currency: params.currency,
          status: 'draft',
          sessionLabel: item.sessionLabel ?? null,
        })
        .returning()
      if (!oi) throw new Error('failed to create order item')

      if (modifierRows.length) {
        await db.insert(orderItemModifiers).values(
          modifierRows.map((mod) => ({
            organizationId: params.organizationId,
            orderItemId: oi.id,
            modifierId: mod.id,
            nameSnapshot: mod.name,
            priceDeltaAmount: mod.priceDelta,
            currency: params.currency,
          })),
        )
      }
      createdItems.push(oi)
    }

    // No bill is created here — request-bill is the single bill-creation path
    // (see requestBillInTx's own comment) so a bill's totals/billItems are
    // always populated from real order data, never left at zero. Totals do
    // need to be correct immediately, though, so the customer's cart view
    // reflects real prices before they ever request the bill.
    await this.recomputeOrderTotals(db, params.organizationId, order.id)
    const freshOrder = await this.loadOrder(db, params.organizationId, order.id)

    return { order: freshOrder, items: createdItems }
  }

  async getOrderItemById(db: Db, organizationId: string, orderItemId: string): Promise<OrderItemRow> {
    const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, orderItemId), eq(orderItems.organizationId, organizationId)))
    if (!item) throw new NotFoundException('order item not found')
    return item
  }

  // db-first, deliberately NOT organization-scoped — mirrors
  // KdsService.syncOrderItemFromKitchen's pre-existing behavior exactly
  // (it already had `organizationId` in scope but passed null to its own
  // local lookup). Whether that's intentional or a latent gap is a separate
  // question from module boundaries; kept as-is here rather than silently
  // tightened as part of this refactor.
  async getOrderItemByIdUnscoped(db: Db, orderItemId: string): Promise<OrderItemRow> {
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, orderItemId))
    if (!item) throw new NotFoundException('order item not found')
    return item
  }

  // db-first: bills/orders are orders-owned — every other module reads a
  // single bill/order through these instead of querying the tables
  // directly. Error shape ({ code, message }) matches the convention
  // already used by payments.service.ts and receipts.service.ts, both of
  // which call this.
  async getBillById(db: Db, organizationId: string, billId: string): Promise<BillRow> {
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.organizationId, organizationId)))
    if (!bill) throw new NotFoundException({ code: 'bill_not_found', message: 'bill not found' })
    return bill
  }

  async getOpenBillForOrder(db: Db, organizationId: string, orderId: string): Promise<BillRow | null> {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.orderId, orderId), eq(bills.organizationId, organizationId), eq(bills.status, 'open')))
    return bill ?? null
  }

  async listOrderItemsForOrder(db: Db, organizationId: string, orderId: string): Promise<OrderItemRow[]> {
    return db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.organizationId, organizationId)))
  }

  async listBillsForOrder(db: Db, organizationId: string, orderId: string): Promise<BillRow[]> {
    return db.select().from(bills).where(and(eq(bills.orderId, orderId), eq(bills.organizationId, organizationId)))
  }

  async getOrderById(db: Db, organizationId: string, orderId: string): Promise<OrderRow> {
    const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
    if (!order) throw new NotFoundException({ code: 'order_not_found', message: 'order not found' })
    return order
  }

  // Today's paid-bill revenue for a location — used by CrmService's chama/SACCO
  // auto-routing. Matches the original inline query's use of CURRENT_DATE
  // (server "today"), not a caller-supplied date.
  async sumPaidBillRevenue(db: Db, organizationId: string, locationId: string): Promise<number> {
    const rows = await db
      .select({ totalAmount: bills.totalAmount })
      .from(bills)
      .innerJoin(orders, eq(bills.orderId, orders.id))
      .where(
        and(
          eq(bills.organizationId, organizationId),
          eq(bills.locationId, locationId),
          eq(bills.status, 'paid'),
          sql`DATE(${bills.paidAt}) = CURRENT_DATE`,
        ),
      )
    return rows.reduce((sum, r) => sum + Number(r.totalAmount), 0)
  }

  // db-first: used by ShiftsService.close() to block closing while orders are
  // still in flight for the shift's location.
  async hasBlockingOpenOrders(db: Db, organizationId: string, locationId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.locationId, locationId),
          eq(orders.organizationId, organizationId),
          ne(orders.status, 'paid'),
          ne(orders.status, 'voided'),
          ne(orders.status, 'refunded'),
        ),
      )
      .limit(1)
    return row != null
  }

  // db-first: used by ShiftsService's cash-metrics/payment-breakdown
  // computation to find every order that fell within the shift's open
  // window. Preserves the original query's behavior exactly, including
  // that it is NOT location-scoped (org + time window only) — that's
  // pre-existing, not something this refactor should silently change.
  async findOrderIdsInWindow(db: Db, organizationId: string, openedAt: Date, closedAt?: Date | null): Promise<string[]> {
    const filters = [eq(orders.organizationId, organizationId), sql`${orders.createdAt} >= ${openedAt}`]
    if (closedAt) filters.push(sql`${orders.createdAt} <= ${closedAt}`)
    const rows = await db.select({ id: orders.id }).from(orders).where(and(...filters))
    return rows.map((r) => r.id)
  }

  // Fires every still-draft item in a named course — the QR-ordering
  // equivalent of send(), which fires by explicit itemIds instead (no
  // assertOwnOrderOrManager check: QR orders carry no staffId to compare
  // against, same as this method's caller never checking one).
  async sendCourse(authContext: AuthContext, orderId: string, courseName: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const order = await this.loadOrder(db, authContext.organizationId, orderId)

      // sessionLabel, not course: `course` is the staff-POS/KDS kitchen-display
      // grouping field (set via AddOrderItemDto, never exposed to QR
      // customers). `sessionLabel` is the field QR ordering actually lets a
      // customer set per item (see 0020_reconcile_schema_drift.sql — "QR
      // ordering per-item labels (order_items.session_label)") — filtering on
      // `course` here meant no QR-submitted item could ever match.
      const toFire = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.orderId, orderId), eq(orderItems.status, 'draft'), eq(orderItems.sessionLabel, courseName)))
      if (toFire.length === 0) {
        throw new BadRequestException({ code: 'no_items_for_course', message: `no draft items found for course "${courseName}"` })
      }

      await db
        .update(orderItems)
        .set({ status: 'sent', sentAt: sql`now()` })
        .where(inArray(orderItems.id, toFire.map((item) => item.id)))

      const fromStatus = order.status as OrderStatus
      let updatedOrder = order
      if ((fromStatus === 'open' || fromStatus === 'draft') && ORDER_STATUS_TRANSITIONS[fromStatus]?.includes('sent_to_kitchen')) {
        const [next] = await db.update(orders).set({ status: 'sent_to_kitchen' }).where(eq(orders.id, orderId)).returning()
        if (next) updatedOrder = next
      }

      if (order.tableId) {
        await this.tablesService.setStatusInTx(db, authContext.organizationId, order.tableId, 'ordered')
      }

      await this.kdsService.createTicketsForSentItems(db, authContext, updatedOrder, toFire)

      return { order: updatedOrder, firedItemIds: toFire.map((item) => item.id) }
    })
  }

  // Ensures a single open bill exists for the whole order and moves it to
  // bill_requested — the QR-ordering equivalent of split(), which always
  // partitions items across N bills; a QR customer just wants "the bill."
  async requestBillInTx(db: Db, organizationId: string, locationId: string, order: OrderRow): Promise<void> {
    const fromStatus = order.status as OrderStatus
    if (!ORDER_STATUS_TRANSITIONS[fromStatus]?.includes('bill_requested')) {
      throw new BadRequestException({ code: 'invalid_status_transition', message: `cannot request bill from status ${fromStatus}` })
    }

    // recomputeOrderTotals runs on every item mutation, so `order` here may
    // still be a pre-mutation snapshot — re-derive from order_items directly
    // rather than trusting order.subtotalAmount/totalAmount.
    const [existingBill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.orderId, order.id), eq(bills.organizationId, organizationId), eq(bills.status, 'open')))

    const bill =
      existingBill ??
      (
        await db
          .insert(bills)
          .values({
            organizationId,
            locationId,
            orderId: order.id,
            billNumber: 1,
            status: 'open',
            currency: order.currency,
            subtotalAmount: 0,
            discountAmount: 0,
            taxAmount: 0,
            serviceChargeAmount: 0,
            tipAmount: 0,
            totalAmount: 0,
          })
          .returning()
      )[0]
    if (!bill) throw new Error('failed to create bill')

    await this.linkUnbilledItemsAndRecomputeBillTotals(db, organizationId, order.id, bill.id)
    await db.update(orders).set({ status: 'bill_requested' }).where(eq(orders.id, order.id))
  }

  // Links every non-voided order_item not yet attached to any bill for this
  // order onto the given bill (billItems is a join, never a copy — see
  // packages/database/src/schema/restaurant/index.ts), then recomputes the
  // bill's totals from what's actually linked. Idempotent: safe to call
  // whether the bill was just created or already existed.
  private async linkUnbilledItemsAndRecomputeBillTotals(
    db: Db,
    organizationId: string,
    orderId: string,
    billId: string,
  ): Promise<void> {
    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.organizationId, organizationId), ne(orderItems.status, 'voided')))

    const alreadyLinked = await db
      .select({ orderItemId: billItems.orderItemId })
      .from(billItems)
      .innerJoin(bills, eq(billItems.billId, bills.id))
      .where(and(eq(bills.orderId, orderId), eq(bills.organizationId, organizationId)))
    const linkedIds = new Set(alreadyLinked.map((row) => row.orderItemId))

    const unlinked = items.filter((item) => !linkedIds.has(item.id))
    if (unlinked.length) {
      await db.insert(billItems).values(
        unlinked.map((item) => ({
          organizationId,
          billId,
          orderItemId: item.id,
          allocatedAmount: item.totalAmount - item.discountAmount,
          currency: item.currency,
        })),
      )
    }

    const linkedForThisBill = await db
      .select({ allocatedAmount: billItems.allocatedAmount })
      .from(billItems)
      .where(and(eq(billItems.billId, billId), eq(billItems.organizationId, organizationId)))
    const subtotalAmount = linkedForThisBill.reduce((sum, row) => sum + row.allocatedAmount, 0)

    await db
      .update(bills)
      .set({ subtotalAmount, totalAmount: subtotalAmount })
      .where(eq(bills.id, billId))
  }

  // Best-effort nudge toward a payable state when a customer opts to pay at
  // the counter instead of via mobile money — mirrors qr-order's pre-existing
  // logic verbatim (not a validated transition like the rest of this file;
  // out of scope for this pass to redesign).
  async markForWaiterPayment(db: Db, organizationId: string, order: OrderRow): Promise<void> {
    const fromStatus = order.status as OrderStatus
    if (!ORDER_STATUS_TRANSITIONS[fromStatus]?.includes('payment_pending')) {
      await db.update(orders).set({ status: 'bill_requested' }).where(eq(orders.id, order.id))
    } else {
      await db.update(orders).set({ status: 'payment_pending' }).where(eq(orders.id, order.id))
    }
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  async dailySalesReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          date: sql<string>`DATE(${orders.closedAt})`,
          orderCount: sql<number>`COUNT(*)`,
          totalSales: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
          avgTicket: sql<number>`COALESCE(AVG(${orders.totalAmount}), 0)`,
          voidCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'voided')`,
        })
        .from(orders)
        .where(and(eq(orders.organizationId, authContext.organizationId), eq(orders.locationId, locationId), sql`${orders.closedAt} >= ${from}`, sql`${orders.closedAt} <= ${to}`, ne(orders.status, 'draft')))
        .groupBy(sql`DATE(${orders.closedAt})`)
        .orderBy(sql`DATE(${orders.closedAt})`)
      return { from, to, rows }
    })
  }

  async topProductsReport(authContext: AuthContext, locationId: string, from: Date, to: Date, limit = 20) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          productId: orderItems.productId,
          productName: sql<string>`MAX(${orderItems.nameSnapshot})`,
          quantitySold: sql<number>`SUM(${orderItems.quantity})`,
          revenue: sql<number>`SUM(${orderItems.totalAmount})`,
          orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orderItems.organizationId, authContext.organizationId), eq(orders.locationId, locationId), ne(orders.status, 'draft'), sql`${orders.closedAt} >= ${from}`, sql`${orders.closedAt} <= ${to}`))
        .groupBy(orderItems.productId)
        .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
        .limit(limit)
      return { from, to, rows }
    })
  }

  async voidDiscountSummary(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [voidStats, discountStats] = await Promise.all([
        db
          .select({
            count: sql<number>`COUNT(*)`,
            totalVoided: sql<number>`COALESCE(SUM(${orderItems.totalAmount}), 0)`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(eq(orderItems.organizationId, authContext.organizationId), eq(orders.locationId, locationId), inArray(orderItems.status, ['voided', 'comped']), sql`${orders.closedAt} >= ${from}`, sql`${orders.closedAt} <= ${to}`)),
        db
          .select({
            totalDiscount: sql<number>`COALESCE(SUM(${orderDiscounts.amountApplied}), 0)`,
            discountCount: sql<number>`COUNT(*)`,
          })
          .from(orderDiscounts)
          .innerJoin(orders, eq(orderDiscounts.orderId, orders.id))
          .where(and(eq(orderDiscounts.organizationId, authContext.organizationId), eq(orders.locationId, locationId), sql`${orders.closedAt} >= ${from}`, sql`${orders.closedAt} <= ${to}`)),
      ])
      return { from, to, voidedItems: voidStats[0], discounts: discountStats[0] }
    })
  }

  // ---------------------------------------------------------------------------
  // Bill reports
  // ---------------------------------------------------------------------------
  async billRevenueReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          billStatus: bills.status,
          count: sql<number>`COUNT(*)`,
          totalRevenue: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
          avgRevenue: sql<number>`COALESCE(AVG(${bills.totalAmount}), 0)`,
          totalDiscount: sql<number>`COALESCE(SUM(${bills.discountAmount}), 0)`,
          totalTax: sql<number>`COALESCE(SUM(${bills.taxAmount}), 0)`,
          totalTips: sql<number>`COALESCE(SUM(${bills.tipAmount}), 0)`,
        })
        .from(bills)
        .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), sql`${bills.createdAt} >= ${from}`, sql`${bills.createdAt} <= ${to}`))
        .groupBy(bills.status)
        .orderBy(sql`SUM(${bills.totalAmount}) DESC`)
      return { from, to, rows }
    })
  }

  async billPaymentStatusBreakdown(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [paid, open, totals] = await Promise.all([
        db
          .select({
            count: sql<number>`COUNT(*)`,
            total: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
          })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`${bills.paidAt} >= ${from}`, sql`${bills.paidAt} <= ${to}`)),
        db
          .select({
            count: sql<number>`COUNT(*)`,
            total: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
          })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'open'), eq(bills.createdAt, bills.createdAt))),
        db
          .select({
            totalBills: sql<number>`COUNT(*)`,
            grandTotal: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
            paidTotal: sql<number>`COALESCE(SUM(${bills.totalAmount}) FILTER (WHERE ${bills.status} = 'paid'), 0)`,
            openTotal: sql<number>`COALESCE(SUM(${bills.totalAmount}) FILTER (WHERE ${bills.status} = 'open'), 0)`,
          })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), sql`${bills.createdAt} >= ${from}`, sql`${bills.createdAt} <= ${to}`)),
      ])
      return { from, to, paid: paid[0], open: open[0], totals: totals[0] }
    })
  }
}
