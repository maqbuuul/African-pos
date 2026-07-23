import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  cashDrawerSessions,
  inventoryItems,
  orderDiscounts,
  orderItems,
  orders,
  payments,
  refunds,
  stockLevels,
  stockMovements,
  tips,
  withTenantContext,
} from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'

@Injectable()
export class ReportsService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  // ---------------------------------------------------------------------------
  // Dashboard composites
  // ---------------------------------------------------------------------------
  async homeDashboard(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const today = sql`CURRENT_DATE`
      const yesterday = sql`CURRENT_DATE - INTERVAL '1 day'`

      const [todayRevenue, yesterdayRevenue, openOrders, stockAlerts] = await Promise.all([
        // Today's revenue from paid bills
        db
          .select({ revenue: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)` })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`DATE(${bills.paidAt}) = ${today}`)),
        // Yesterday's revenue
        db
          .select({ revenue: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)` })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`DATE(${bills.paidAt}) = ${yesterday}`)),
        // Open orders count
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(orders)
          .where(and(eq(orders.organizationId, authContext.organizationId), eq(orders.locationId, locationId), eq(orders.status, 'open'))),
        // Low stock items (below reorder point)
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(inventoryItems)
          .leftJoin(stockLevels, and(eq(stockLevels.inventoryItemId, inventoryItems.id), sql`${stockLevels.stockLocationId} IS NULL`))
          .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active'), sql`${stockLevels.quantity} <= ${inventoryItems.reorderPoint}`)),
      ])

      const revToday = Number(todayRevenue[0]?.revenue ?? 0)
      const revYesterday = Number(yesterdayRevenue[0]?.revenue ?? 0)
      const changePct = revYesterday > 0 ? Math.round(((revToday - revYesterday) / revYesterday) * 100) : 0

      return {
        revenueToday: revToday,
        revenueYesterday: revYesterday,
        changeVsYesterday: changePct,
        openOrders: Number(openOrders[0]?.count ?? 0),
        lowStockAlerts: Number(stockAlerts[0]?.count ?? 0),
      }
    })
  }

  async salesDashboard(authContext: AuthContext, locationId: string, days = 7) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const since = sql`CURRENT_DATE - (${days} - 1) * INTERVAL '1 day'`

      const [revenueTrend, paymentMix, topItems, hourly] = await Promise.all([
        // Daily revenue trend
        db
          .select({
            date: sql<string>`DATE(${bills.paidAt})`,
            revenue: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
            orderCount: sql<number>`COUNT(DISTINCT ${bills.orderId})`,
          })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`DATE(${bills.paidAt}) >= ${since}`))
          .groupBy(sql`DATE(${bills.paidAt})`)
          .orderBy(sql`DATE(${bills.paidAt})`),
        // Payment method mix
        db
          .select({
            method: payments.method,
            totalAmount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(payments)
          .where(and(eq(payments.organizationId, authContext.organizationId), eq(payments.locationId, locationId), eq(payments.status, 'confirmed'), sql`DATE(${payments.paidAt}) >= ${since}`))
          .groupBy(payments.method)
          .orderBy(desc(sql`SUM(${payments.amount})`)),
        // Top selling items
        db
          .select({
            productId: orderItems.productId,
            productName: sql<string>`MAX(${orderItems.nameSnapshot})`,
            quantitySold: sql<number>`SUM(${orderItems.quantity})`,
            revenue: sql<number>`SUM(${orderItems.totalAmount})`,
            orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(eq(orderItems.organizationId, authContext.organizationId), eq(orders.locationId, locationId), sql`DATE(${orders.closedAt}) >= ${since}`, sql`${orders.status} != 'draft'`))
          .groupBy(orderItems.productId)
          .orderBy(desc(sql`SUM(${orderItems.quantity})`))
          .limit(10),
        // Hourly sales heatmap
        db
          .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${bills.paidAt})`,
            revenue: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)`,
            orderCount: sql<number>`COUNT(*)`,
          })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`DATE(${bills.paidAt}) >= ${since}`))
          .groupBy(sql`EXTRACT(HOUR FROM ${bills.paidAt})`)
          .orderBy(sql`EXTRACT(HOUR FROM ${bills.paidAt})`),
      ])

      return { days, revenueTrend, paymentMix, topItems, hourlyRevenue: hourly }
    })
  }

  async inventoryDashboard(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [stockValue, lowStock, movementSummary] = await Promise.all([
        // Total stock value
        db
          .select({
            category: inventoryItems.category,
            totalItems: sql<number>`COUNT(*)`,
            totalStock: sql<number>`COALESCE(SUM(${stockLevels.quantity}), 0)`,
            totalValue: sql<number>`COALESCE(SUM(${inventoryItems.unitCost} * ${stockLevels.quantity}), 0)`,
          })
          .from(inventoryItems)
          .leftJoin(stockLevels, and(eq(stockLevels.inventoryItemId, inventoryItems.id), sql`${stockLevels.stockLocationId} IS NULL`))
          .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active')))
          .groupBy(inventoryItems.category),
        // Low stock items
        db
          .select({
            itemId: inventoryItems.id,
            itemName: inventoryItems.name,
            currentStock: stockLevels.quantity,
            reorderPoint: inventoryItems.reorderPoint,
          })
          .from(inventoryItems)
          .leftJoin(stockLevels, and(eq(stockLevels.inventoryItemId, inventoryItems.id), sql`${stockLevels.stockLocationId} IS NULL`))
          .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active'), sql`${stockLevels.quantity} <= ${inventoryItems.reorderPoint}`))
          .orderBy(desc(sql`${inventoryItems.reorderPoint} - ${stockLevels.quantity}`))
          .limit(10),
        // Movement summary last 30 days
        db
          .select({
            movementType: stockMovements.movementType,
            totalQuantity: sql<number>`SUM(${stockMovements.quantity})`,
            count: sql<number>`COUNT(*)`,
          })
          .from(stockMovements)
          .where(and(eq(stockMovements.organizationId, authContext.organizationId), eq(stockMovements.locationId, locationId), sql`${stockMovements.movedAt} >= CURRENT_DATE - INTERVAL '30 days'`))
          .groupBy(stockMovements.movementType),
      ])
      return { stockValue, lowStock, movementSummary }
    })
  }

  async staffDashboard(_authContext: AuthContext, _locationId: string, days = 7) {
    return { days, attendance: [], performance: [] }
  }

  async customerDashboard(_authContext: AuthContext, _locationId: string) {
    return { totalActive: 0, newThisMonth: 0 }
  }

  async financeDashboard(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const since = sql`DATE_TRUNC('month', CURRENT_DATE)`
      const [revenue, tipsTotal, discounts, voids, refundsTotal, cashDrawer] = await Promise.all([
        db
          .select({ total: sql<number>`COALESCE(SUM(${bills.totalAmount}), 0)` })
          .from(bills)
          .where(and(eq(bills.organizationId, authContext.organizationId), eq(bills.locationId, locationId), eq(bills.status, 'paid'), sql`${bills.paidAt} >= ${since}`)),
        db
          .select({ total: sql<number>`COALESCE(SUM(${tips.amount}), 0)` })
          .from(tips)
          .where(and(eq(tips.organizationId, authContext.organizationId), eq(tips.locationId, locationId), sql`${tips.createdAt} >= ${since}`)),
        db
          .select({ total: sql<number>`COALESCE(SUM(${orderDiscounts.amountApplied}), 0)` })
          .from(orderDiscounts)
          .where(and(eq(orderDiscounts.organizationId, authContext.organizationId), eq(orderDiscounts.locationId, locationId), sql`${orderDiscounts.createdAt} >= ${since}`)),
        db
          .select({ total: sql<number>`COALESCE(SUM(${orderItems.totalAmount}), 0)` })
          .from(orderItems)
          .where(and(eq(orderItems.organizationId, authContext.organizationId), sql`${orderItems.status} IN ('voided', 'comped')`, sql`${orderItems.createdAt} >= ${since}`)),
        db
          .select({ total: sql<number>`COALESCE(SUM(${refunds.amount}), 0)` })
          .from(refunds)
          .where(and(eq(refunds.organizationId, authContext.organizationId), eq(refunds.locationId, locationId), sql`${refunds.createdAt} >= ${since}`)),
        db
          .select({ count: sql<number>`COUNT(*)`, discrepancies: sql<number>`COUNT(*) FILTER (WHERE ${cashDrawerSessions.startingAmount} != ${cashDrawerSessions.countedAmount})` })
          .from(cashDrawerSessions)
          .where(and(eq(cashDrawerSessions.organizationId, authContext.organizationId), eq(cashDrawerSessions.locationId, locationId), sql`${cashDrawerSessions.createdAt} >= ${since}`)),
      ]);
      const rev = revenue?.[0]?.total as number | undefined
      const tip = tipsTotal?.[0]?.total as number | undefined
      const disc = discounts?.[0]?.total as number | undefined
      const voided = voids?.[0]?.total as number | undefined
      const rfd = refundsTotal?.[0]?.total as number | undefined
      const drawer = cashDrawer?.[0] as { count: number; discrepancies: number } | undefined
      return {
        monthRevenue: Number(rev ?? 0),
        totalTips: Number(tip ?? 0),
        totalDiscounts: Number(disc ?? 0),
        totalVoids: Number(voided ?? 0),
        totalRefunds: Number(rfd ?? 0),
        cashDrawerSessions: Number(drawer?.count ?? 0),
        cashDiscrepancies: Number(drawer?.discrepancies ?? 0),
      }
    })
  }
}
