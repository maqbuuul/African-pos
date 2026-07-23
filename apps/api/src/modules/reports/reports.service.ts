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
  staff,
  shifts,
  stockLevels,
  stockMovements,
  tips,
  customers,
  customerFeedback,
  loyaltyAccounts,
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

  async staffDashboard(authContext: AuthContext, locationId: string, days = 7) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const since = sql`CURRENT_DATE - (${days} - 1) * INTERVAL '1 day'`
      const [attendance, performance] = await Promise.all([
        // Shift attendance per staff member
        db
          .select({
            staffId: shifts.openedByStaffId,
            staffName: sql<string>`MAX(${staff.name})`,
            totalShifts: sql<number>`COUNT(*)`,
            closedShifts: sql<number>`COUNT(*) FILTER (WHERE ${shifts.status} = 'closed')`,
            totalRevenue: sql<number>`COALESCE(SUM(${cashDrawerSessions.countedAmount}), 0)`,
          })
          .from(shifts)
          .leftJoin(staff, eq(shifts.openedByStaffId, staff.id))
          .leftJoin(cashDrawerSessions, eq(cashDrawerSessions.shiftId, shifts.id))
          .where(and(eq(shifts.organizationId, authContext.organizationId), eq(shifts.locationId, locationId), sql`DATE(${shifts.openedAt}) >= ${since}`))
          .groupBy(shifts.openedByStaffId)
          .orderBy(desc(sql`COUNT(*)`)),
        // Sales performance per staff member from orders
        db
          .select({
            staffId: orders.staffId,
            staffName: sql<string>`MAX(${staff.name})`,
            totalOrders: sql<number>`COUNT(*)`,
            totalRevenue: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
            avgTicket: sql<number>`COALESCE(ROUND(AVG(${orders.totalAmount})), 0)`,
          })
          .from(orders)
          .leftJoin(staff, eq(orders.staffId, staff.id))
          .where(and(eq(orders.organizationId, authContext.organizationId), eq(orders.locationId, locationId), sql`${orders.status} NOT IN ('draft', 'cancelled')`, sql`DATE(${orders.closedAt}) >= ${since}`))
          .groupBy(orders.staffId)
          .orderBy(desc(sql`SUM(${orders.totalAmount})`)),
      ])
      return { days, attendance, performance }
    })
  }

  async customerDashboard(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const since = sql`DATE_TRUNC('month', CURRENT_DATE)`
      const [active, newMonthly, feedback, loyalty] = await Promise.all([
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(customers)
          .where(and(eq(customers.organizationId, authContext.organizationId), eq(customers.status, 'active'))),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(customers)
          .where(and(eq(customers.organizationId, authContext.organizationId), sql`${customers.createdAt} >= ${since}`)),
        db
          .select({
            rating: customerFeedback.rating,
            count: sql<number>`COUNT(*)`,
          })
          .from(customerFeedback)
          .where(and(eq(customerFeedback.organizationId, authContext.organizationId), eq(customerFeedback.locationId, locationId)))
          .groupBy(customerFeedback.rating)
          .orderBy(customerFeedback.rating),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(loyaltyAccounts)
          .where(eq(loyaltyAccounts.organizationId, authContext.organizationId)),
      ])
      return {
        totalActive: Number(active[0]?.total ?? 0),
        newThisMonth: Number(newMonthly[0]?.total ?? 0),
        loyaltyEnrolled: Number(loyalty[0]?.total ?? 0),
        feedbackBreakdown: feedback.map((r) => ({ rating: r.rating, count: Number(r.count) })),
      }
    })
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

  async paymentsReport(authContext: AuthContext, locationId: string, days = 7) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const since = sql`CURRENT_DATE - (${days} - 1) * INTERVAL '1 day'`
      const [methodBreakdown, dailyTrend] = await Promise.all([
        db
          .select({
            method: payments.method,
            totalAmount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
            refunded: sql<number>`COALESCE(SUM(${refunds.amount}) FILTER (WHERE ${refunds.status} = 'completed'), 0)`,
          })
          .from(payments)
          .leftJoin(refunds, eq(refunds.paymentId, payments.id))
          .where(and(eq(payments.organizationId, authContext.organizationId), eq(payments.locationId, locationId), eq(payments.status, 'confirmed'), sql`DATE(${payments.paidAt}) >= ${since}`))
          .groupBy(payments.method)
          .orderBy(desc(sql`SUM(${payments.amount})`)),
        db
          .select({
            date: sql<string>`DATE(${payments.paidAt})`,
            totalAmount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(payments)
          .where(and(eq(payments.organizationId, authContext.organizationId), eq(payments.locationId, locationId), eq(payments.status, 'confirmed'), sql`DATE(${payments.paidAt}) >= ${since}`))
          .groupBy(sql`DATE(${payments.paidAt})`)
          .orderBy(sql`DATE(${payments.paidAt})`),
      ])
      return { days, methodBreakdown, dailyTrend }
    })
  }

  async exportReport(authContext: AuthContext, locationId: string, type: string, params: { days?: number; startDate?: string; endDate?: string }) {
    const days = params.days ?? 7
    switch (type) {
      case 'sales': {
        const data = await this.salesDashboard(authContext, locationId, days)
        const rows = data.revenueTrend.map((r: { date: string; revenue: number; orderCount: number }) => `${r.date},${r.revenue},${r.orderCount}`)
        return { csv: `date,revenue,order_count\n${rows.join('\n')}\n`, filename: `sales_report_${days}d.csv` }
      }
      case 'payments': {
        const data = await this.paymentsReport(authContext, locationId, days)
        const rows = data.methodBreakdown.map((r: { method: string; totalAmount: number; count: number }) => `${r.method},${r.totalAmount},${r.count}`)
        return { csv: `method,total_amount,count\n${rows.join('\n')}\n`, filename: `payments_report_${days}d.csv` }
      }
      case 'inventory': {
        const data = await this.inventoryDashboard(authContext, locationId)
        const rows = data.lowStock.map((r) => `${r.itemName},${r.currentStock ?? 0},${r.reorderPoint ?? 0}`)
        return { csv: `item_name,current_stock,reorder_point\n${rows.join('\n')}\n`, filename: `inventory_report.csv` }
      }
      case 'staff': {
        const data = await this.staffDashboard(authContext, locationId, days)
        const rows = data.performance.map((r: { staffName: string; totalOrders: number; totalRevenue: number }) => `${r.staffName},${r.totalOrders},${r.totalRevenue}`)
        return { csv: `staff_name,total_orders,total_revenue\n${rows.join('\n')}\n`, filename: `staff_report_${days}d.csv` }
      }
      default:
        return { csv: `report_type,exported,true\n${type},not_supported\n`, filename: `report.csv` }
    }
  }
}
