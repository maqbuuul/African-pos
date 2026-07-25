import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Pool } from 'pg'
import { withTenantContext } from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { CrmService } from '../crm/crm.service.js'
import { StaffNotificationsService } from '../notifications/staff-notifications.service.js'
import { OrdersService } from '../orders/orders.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import { ProductsService } from '../products/products.service.js'
import { TablesService } from '../restaurant/tables.service.js'
import { signTableSessionToken, type TableSessionClaims } from './table-session.js'

export interface OrderItemInput {
  productId: string
  quantity: number
  modifierIds?: string[]
  notes?: string
  sessionLabel?: string
}

@Injectable()
export class QrOrderService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(TablesService) private readonly tablesService: TablesService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(ProductsService) private readonly productsService: ProductsService,
    @Inject(CrmService) private readonly crmService: CrmService,
    @Inject(StaffNotificationsService) private readonly staffNotifications: StaffNotificationsService,
  ) {}

  async createSession(qrSlug: string) {
    // restaurant_tables is restaurant-owned.
    const table = await withTenantContext(this.pool, null as unknown as string, (db) => this.tablesService.findByQrSlug(db, qrSlug))
    if (!table) throw new NotFoundException('table not found')
    if (table.status === 'blocked' || table.status === 'cleaning') {
      throw new BadRequestException({ code: 'table_unavailable', message: 'table is currently unavailable' })
    }
    return { token: await signTableSessionToken({ organizationId: table.organizationId, locationId: table.locationId, tableId: table.id, qrSlug: table.qrSlug ?? '' }), table }
  }

  async getMenu(session: TableSessionClaims) {
    // menus/menu_categories/products/product_prices/modifier_groups/
    // modifiers/product_modifier_groups are all products-owned.
    return withTenantContext(this.pool, session.organizationId, (db) =>
      this.productsService.getMenuCatalogForLocation(db, session.organizationId, session.locationId),
    )
  }

  async submitOrder(session: TableSessionClaims, items: OrderItemInput[]) {
    if (items.length === 0) throw new BadRequestException('order must contain at least one item')
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      await this.tablesService.getByIdInTx(db, session.organizationId, session.tableId)
      return this.ordersService.createDraftOrderWithItems(
        db,
        { organizationId: session.organizationId, locationId: session.locationId, tableId: session.tableId, currency: 'KES' },
        items,
      )
    })
  }

  async getOrder(session: TableSessionClaims, orderId: string) {
    // orders/order_items/bills are orders-owned.
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const order = await this.ordersService.getOrderById(db, session.organizationId, orderId)
      const [items, billList] = await Promise.all([
        this.ordersService.listOrderItemsForOrder(db, session.organizationId, order.id),
        this.ordersService.listBillsForOrder(db, session.organizationId, order.id),
      ])
      return { order, items, bills: billList }
    })
  }

  async requestWaiter(session: TableSessionClaims, reason?: string) {
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const notification = await this.staffNotifications.create(db, {
        organizationId: session.organizationId,
        locationId: session.locationId,
        tableId: session.tableId,
        notificationType: 'waiter_request',
        reason: reason ?? null,
      })
      return { message: 'waiter has been notified', notification }
    })
  }

  async submitFeedback(session: TableSessionClaims, orderItemId: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5')
    }
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      await this.ordersService.getOrderItemById(db, session.organizationId, orderItemId)

      const feedback = await this.crmService.createFeedbackInTx(db, this.sessionAuthContext(session), {
        locationId: session.locationId,
        orderItemId,
        source: 'qr_table',
        rating,
        comment,
      })
      return { orderItemId, rating, comment: comment ?? null, message: 'feedback recorded', feedback }
    })
  }

  async fireCourse(session: TableSessionClaims, orderId: string, courseName: string) {
    const result = await this.ordersService.sendCourse(this.sessionAuthContext(session), orderId, courseName)

    await this.auditLog.record({
      organizationId: session.organizationId,
      locationId: session.locationId,
      actorType: 'system',
      actorId: session.tableId,
      action: 'qr_order.course_fired',
      entityType: 'order',
      entityId: orderId,
      newValue: { courseName, firedItemIds: result.firedItemIds },
    })

    return { message: `course "${courseName}" fired`, firedItemIds: result.firedItemIds }
  }

  async rateDish(session: TableSessionClaims, orderItemId: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5')
    }
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const item = await this.ordersService.getOrderItemById(db, session.organizationId, orderItemId)

      const feedback = await this.crmService.createFeedbackInTx(db, this.sessionAuthContext(session), {
        locationId: session.locationId,
        orderItemId,
        orderId: item.orderId,
        source: 'qr_table',
        rating,
        comment,
      })

      return { orderItemId, rating, comment: comment ?? null, message: 'rating recorded', feedback }
    })
  }

  async payMpesa(session: TableSessionClaims, orderId: string, customerPhone: string, idempotencyKey: string) {
    const authContext = this.sessionAuthContext(session)
    // The client only ever holds an orderId (bills are created and tracked
    // server-side via requestBill) — resolve the open bill for this order
    // before delegating to PaymentsService, which operates on bill ids.
    // bills is orders-owned.
    const bill = await withTenantContext(this.pool, session.organizationId, (db) =>
      this.ordersService.getOpenBillForOrder(db, session.organizationId, orderId),
    )
    if (!bill) throw new NotFoundException('no open bill for this order — request the bill first')

    const { outstandingAmount, currency } = await this.paymentsService.getOutstandingBalance(authContext, bill.id)
    if (outstandingAmount <= 0) {
      throw new BadRequestException('bill has no outstanding balance to pay')
    }
    return this.paymentsService.takePayment(authContext, bill.id, 'mpesa_daraja', {
      amount: outstandingAmount, currency, idempotencyKey, customerPhone,
    })
  }

  async requestBill(session: TableSessionClaims, orderId: string) {
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const order = await this.ordersService.getById(this.sessionAuthContext(session), orderId)
      await this.ordersService.requestBillInTx(db, session.organizationId, session.locationId, order)
      if (order.tableId) {
        await this.tablesService.setStatusInTx(db, session.organizationId, order.tableId, 'bill_requested')
      }
      return { message: 'bill requested' }
    })
  }

  async payWithWaiter(session: TableSessionClaims, orderId: string) {
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const order = await this.ordersService.getById(this.sessionAuthContext(session), orderId)
      await this.ordersService.markForWaiterPayment(db, session.organizationId, order)
      if (order.tableId) {
        await this.tablesService.setStatusInTx(db, session.organizationId, order.tableId, 'payment_pending')
      }
      await this.auditLog.record({
        organizationId: session.organizationId, locationId: session.locationId,
        actorType: 'system', actorId: session.tableId,
        action: 'qr_order.pay_with_waiter', entityType: 'order', entityId: orderId,
        newValue: { method: 'waiter' },
      })
      return { message: 'order marked for payment at counter' }
    })
  }

  async refreshMenu(session: TableSessionClaims) {
    return this.getMenu(session)
  }

  async captureLoyalty(session: TableSessionClaims, phone: string) {
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const customer = await this.crmService.findOrCreateByPhoneInTx(db, this.sessionAuthContext(session), { phone })
      const { account, created } = await this.crmService.findOrCreateLoyaltyAccountInTx(db, session.organizationId, customer.id)
      return {
        message: created ? 'loyalty account created' : 'loyalty account already exists',
        customerId: customer.id,
        account,
      }
    })
  }

  async getOrderStatus(session: TableSessionClaims, orderId: string) {
    // orders/order_items/bills are orders-owned; restaurant_tables is
    // restaurant-owned. Table lookup tolerates "not found" (returns null,
    // matching the original inline query's behavior) rather than throwing —
    // a missing table shouldn't fail the whole status response.
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const order = await this.ordersService.getOrderById(db, session.organizationId, orderId)
      const [items, billList, table] = await Promise.all([
        this.ordersService.listOrderItemsForOrder(db, session.organizationId, order.id),
        this.ordersService.listBillsForOrder(db, session.organizationId, order.id),
        this.tablesService.getByIdInTx(db, session.organizationId, session.tableId).catch(() => null),
      ])
      return { order, items, bills: billList, tableStatus: table?.status ?? null }
    })
  }

  // Table-occupancy analytics — restaurant_tables is restaurant-owned, so
  // this belongs in TablesService; qr-order just orchestrates the call.
  async tableUtilizationReport(authContext: AuthContext, locationId: string) {
    return this.tablesService.utilizationReport(authContext, locationId)
  }

  // A table-session customer has no staff/user identity — this synthesizes
  // the AuthContext every downstream service call expects, consistent with
  // how this file already did it inline for KdsService before this pass.
  private sessionAuthContext(session: TableSessionClaims): AuthContext {
    return {
      actorType: 'customer',
      actorId: session.tableId,
      organizationId: session.organizationId,
      locationId: session.locationId,
    }
  }
}
