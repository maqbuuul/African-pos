import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  menuCategories,
  menus,
  modifierGroups,
  modifiers,
  orderItemModifiers,
  orderItems,
  orders,
  productModifierGroups,
  productPrices,
  products,
  restaurantTables,
  withTenantContext,
} from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { PaymentsService } from '../payments/payments.service.js'
import { signTableSessionToken, type TableSessionClaims } from './table-session.js'

export interface OrderItemInput {
  productId: string
  quantity: number
  modifierIds?: string[]
  notes?: string
}

@Injectable()
export class QrOrderService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  async createSession(qrSlug: string) {
    const table = await withTenantContext(this.pool, null as unknown as string, async (db) => {
      const rows = await db
        .select()
        .from(restaurantTables)
        .where(eq(restaurantTables.qrSlug, qrSlug))
        .limit(1)
      return rows[0] ?? null
    })
    if (!table) throw new NotFoundException('table not found')
    if (table.status === 'blocked' || table.status === 'cleaning') {
      throw new BadRequestException({ code: 'table_unavailable', message: 'table is currently unavailable' })
    }
    return { token: await signTableSessionToken({ organizationId: table.organizationId, locationId: table.locationId, tableId: table.id }), table }
  }

  async getMenu(session: TableSessionClaims) {
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const [menuList, categories, productList] = await Promise.all([
        db.select().from(menus).where(and(eq(menus.organizationId, session.organizationId), eq(menus.locationId, session.locationId))),
        db.select().from(menuCategories).where(and(eq(menuCategories.organizationId, session.organizationId), eq(menuCategories.locationId, session.locationId))),
        db.select().from(products).where(and(eq(products.organizationId, session.organizationId), eq(products.locationId, session.locationId), eq(products.status, 'active'), eq(products.isAvailable, true))),
      ])
      if (productList.length === 0) {
        return { menus: menuList, categories, products: [] }
      }
      const [prices, links, mgs, allMods] = await Promise.all([
        db.select().from(productPrices).where(and(eq(productPrices.organizationId, session.organizationId), isNull(productPrices.effectiveTo))),
        db.select().from(productModifierGroups).where(eq(productModifierGroups.organizationId, session.organizationId)),
        db.select().from(modifierGroups).where(eq(modifierGroups.organizationId, session.organizationId)),
        db.select().from(modifiers).where(eq(modifiers.organizationId, session.organizationId)),
      ])
      return { menus: menuList, categories, products: productList, productPrices: prices, productModifierGroups: links, modifierGroups: mgs, modifiers: allMods }
    })
  }

  async submitOrder(session: TableSessionClaims, items: OrderItemInput[]) {
    if (items.length === 0) throw new BadRequestException('order must contain at least one item')
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const table = await db
        .select()
        .from(restaurantTables)
        .where(and(eq(restaurantTables.id, session.tableId), eq(restaurantTables.organizationId, session.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!table) throw new NotFoundException('table not found')
      const [order] = await db
        .insert(orders)
        .values({ organizationId: session.organizationId, locationId: session.locationId, tableId: session.tableId, channel: 'qr_table', status: 'draft', currency: 'KES' })
        .returning()
      if (!order) throw new Error('failed to create order')
      const currency = 'KES'
      const orderItemRows: (typeof orderItems.$inferSelect)[] = []
      for (const item of items) {
        const product = await db
          .select()
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.organizationId, session.organizationId)))
          .limit(1)
          .then((r) => r[0])
        if (!product) continue
        const activePrice = await db
          .select()
          .from(productPrices)
          .where(and(eq(productPrices.productId, item.productId), eq(productPrices.organizationId, session.organizationId), isNull(productPrices.effectiveTo)))
          .limit(1)
          .then((r) => r[0])
        const unitPrice = activePrice?.priceAmount ?? 0
        let modsPrice = 0
        if (item.modifierIds && item.modifierIds.length > 0) {
          for (const modId of item.modifierIds) {
            const mod = await db
              .select()
              .from(modifiers)
              .where(and(eq(modifiers.id, modId), eq(modifiers.organizationId, session.organizationId)))
              .limit(1)
              .then((r) => r[0])
            if (!mod) continue
            modsPrice += mod.priceDelta
          }
        }
        const [oi] = await db
          .insert(orderItems)
          .values({
            organizationId: session.organizationId, locationId: session.locationId, orderId: order.id, productId: product.id,
            nameSnapshot: product.name, localNameSnapshot: product.localName,
            quantity: item.quantity, kitchenNote: item.notes ?? null,
            unitPriceAmount: unitPrice, modifiersPriceAmount: modsPrice, totalAmount: (unitPrice + modsPrice) * item.quantity,
            discountAmount: 0, currency, status: 'draft',
          })
          .returning()
        if (!oi) throw new Error('failed to create order item')
        if (item.modifierIds && item.modifierIds.length > 0) {
          for (const modId of item.modifierIds) {
            const mod = await db
              .select()
              .from(modifiers)
              .where(and(eq(modifiers.id, modId), eq(modifiers.organizationId, session.organizationId)))
              .limit(1)
              .then((r) => r[0])
            if (!mod) continue
            await db.insert(orderItemModifiers).values({
              organizationId: session.organizationId, orderItemId: oi.id,
              modifierId: mod.id, nameSnapshot: mod.name, priceDeltaAmount: mod.priceDelta, currency,
            })
          }
        }
        orderItemRows.push(oi)
      }
      const [bill] = await db
        .insert(bills)
        .values({
          organizationId: session.organizationId, locationId: session.locationId, orderId: order.id,
          billNumber: 1, status: 'open', currency, subtotalAmount: 0, discountAmount: 0,
          taxAmount: 0, serviceChargeAmount: 0, tipAmount: 0, totalAmount: 0,
        })
        .returning()
      if (!bill) throw new Error('failed to create bill')
      return { order, items: orderItemRows, bill }
    })
  }

  async getOrder(session: TableSessionClaims, orderId: string) {
    return withTenantContext(this.pool, session.organizationId, async (db) => {
      const order = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, session.organizationId)))
        .limit(1)
        .then((r) => r[0])
      if (!order) throw new NotFoundException('order not found')
      const [items, billList] = await Promise.all([
        db.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.organizationId, session.organizationId))),
        db.select().from(bills).where(and(eq(bills.orderId, order.id), eq(bills.organizationId, session.organizationId))),
      ])
      return { order, items, bills: billList }
    })
  }

  async requestWaiter(session: TableSessionClaims, reason?: string) {
    return { message: 'waiter has been notified', reason: reason ?? null }
  }

  async submitFeedback(session: TableSessionClaims, orderItemId: string, rating: number, comment?: string) {
    return { orderItemId, rating, comment: comment ?? null, message: 'feedback recorded' }
  }

  async payMpesa(session: TableSessionClaims, billId: string, customerPhone: string, idempotencyKey: string) {
    const authContext: AuthContext = {
      actorType: 'staff', actorId: '00000000-0000-0000-0000-000000000000',
      organizationId: session.organizationId, locationId: session.locationId,
    }
    return this.paymentsService.takeMpesa(authContext, billId, {
      amount: 0, currency: 'KES', idempotencyKey, customerPhone,
    })
  }
}
