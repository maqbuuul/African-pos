import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  inventoryItems,
  orders,
  stockLevels,
  withTenantContext,
} from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'

@Injectable()
export class WhatsAppReportsService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  async handleCommand(authContext: AuthContext, locationId: string, command: string): Promise<{ text: string }> {
    switch (command.toUpperCase()) {
      case 'SALES':
        return this.salesCommand(authContext, locationId)
      case 'STOCK':
        return this.stockCommand(authContext, locationId)
      case 'HELP':
        return { text: 'Commands: SALES (today summary), STOCK (low stock), HELP (this list)' }
      default:
        return { text: `Unknown command "${command}". Reply HELP for available commands.` }
    }
  }

  private async salesCommand(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const today = sql`CURRENT_DATE`
      const [revenueRow, orderCount] = await Promise.all([
        db
          .select({ total: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)` })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`DATE(${bills.paidAt}) = ${today}`)),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(and(eq(orders.organizationId, authContext.organizationId), eq(orders.locationId, locationId), sql`DATE(${orders.createdAt}) = ${today}`, sql`${orders.status} != 'draft'`)),
      ])
      const revenue = Number(revenueRow[0]?.total ?? 0)
      const orders_ = Number(orderCount[0]?.count ?? 0)
      // bills.totalAmount is already whole currency units throughout this
      // codebase (e.g. 1200 = KES 1,200, confirmed against M-Pesa Daraja's
      // own Amount field) — dividing by 100 here treated it as cents and
      // understated every WhatsApp sales report by 100x.
      return {
        text: `📊 *Today's Sales*\nRevenue: KSh ${revenue.toLocaleString()}\nOrders: ${orders_}\nAvg: KSh ${orders_ > 0 ? Math.round(revenue / orders_).toLocaleString() : 0}`,
      }
    })
  }

  private async stockCommand(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const items = await db
        .select({
          name: inventoryItems.name,
          stock: stockLevels.quantity,
          reorderPoint: inventoryItems.reorderPoint,
        })
        .from(inventoryItems)
        .leftJoin(stockLevels, and(eq(stockLevels.inventoryItemId, inventoryItems.id), sql`${stockLevels.stockLocationId} IS NULL`))
        .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active'), sql`${stockLevels.quantity} <= ${inventoryItems.reorderPoint}`))
        .orderBy(sql`${inventoryItems.reorderPoint} - ${stockLevels.quantity} DESC`)
        .limit(5)
      if (items.length === 0) return { text: '✅ All stock levels are healthy.' }
      const lines = items.map((i) => `• ${i.name}: ${i.stock} left (reorder at ${i.reorderPoint})`)
      return { text: `⚠️ *Low Stock Alerts*\n${lines.join('\n')}\n\nReply ORDER <item> to reorder.` }
    })
  }
}
