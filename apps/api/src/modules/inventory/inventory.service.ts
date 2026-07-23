import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  inventoryItems,
  stockLevels,
  stockMovements,
  suppliers,
  wastageEvents,
  withTenantContext,
} from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'

@Injectable()
export class InventoryService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  async stockValueReport(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          itemId: inventoryItems.id,
          itemName: inventoryItems.name,
          sku: inventoryItems.sku,
          category: inventoryItems.category,
          unit: inventoryItems.unit,
          unitCost: inventoryItems.unitCost,
          currency: inventoryItems.currency,
          currentStock: stockLevels.quantity,
          stockValue: sql<number>`COALESCE(${inventoryItems.unitCost} * ${stockLevels.quantity}, 0)`,
          reorderPoint: inventoryItems.reorderPoint,
        })
        .from(inventoryItems)
        .leftJoin(stockLevels, and(eq(stockLevels.inventoryItemId, inventoryItems.id), isNull(stockLevels.stockLocationId)))
        .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active')))
        .orderBy(desc(sql`COALESCE(${inventoryItems.unitCost} * ${stockLevels.quantity}, 0)`))
      const totalValue = rows.reduce((sum, r) => sum + Number(r.stockValue), 0)
      return { totalValue, currency: rows[0]?.currency ?? 'KES', rows }
    })
  }

  async lowStockReport(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          itemId: inventoryItems.id,
          itemName: inventoryItems.name,
          sku: inventoryItems.sku,
          category: inventoryItems.category,
          unit: inventoryItems.unit,
          unitCost: inventoryItems.unitCost,
          reorderPoint: inventoryItems.reorderPoint,
          reorderQuantity: inventoryItems.reorderQuantity,
          currentStock: stockLevels.quantity,
          preferredSupplierId: inventoryItems.preferredSupplierId,
          supplierName: sql<string | null>`${suppliers.name}`,
        })
        .from(inventoryItems)
        .leftJoin(stockLevels, and(eq(stockLevels.inventoryItemId, inventoryItems.id), isNull(stockLevels.stockLocationId)))
        .leftJoin(suppliers, eq(inventoryItems.preferredSupplierId, suppliers.id))
        .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active'), sql`${stockLevels.quantity} <= ${inventoryItems.reorderPoint}`))
        .orderBy(desc(sql`${inventoryItems.reorderPoint} - ${stockLevels.quantity}`))
      return { total: rows.length, rows }
    })
  }

  async stockMovementSummary(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          movementType: stockMovements.movementType,
          totalQuantity: sql<number>`SUM(${stockMovements.quantity})`,
          count: sql<number>`COUNT(*)`,
          totalCost: sql<number>`COALESCE(SUM(${stockMovements.quantity} * COALESCE(${stockMovements.unitCost}, 0)), 0)`,
        })
        .from(stockMovements)
        .where(and(eq(stockMovements.organizationId, authContext.organizationId), eq(stockMovements.locationId, locationId), sql`${stockMovements.movedAt} >= ${from}`, sql`${stockMovements.movedAt} <= ${to}`))
        .groupBy(stockMovements.movementType)
        .orderBy(desc(sql`SUM(${stockMovements.quantity})`))
      return { from, to, rows }
    })
  }

  async wastageSummaryReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          reason: wastageEvents.reason,
          totalQuantity: sql<number>`SUM(${wastageEvents.quantity})`,
          count: sql<number>`COUNT(*)`,
          totalCost: sql<number>`COALESCE(SUM(${wastageEvents.costImpact}), 0)`,
        })
        .from(wastageEvents)
        .where(and(eq(wastageEvents.organizationId, authContext.organizationId), eq(wastageEvents.locationId, locationId), sql`${wastageEvents.occurredAt} >= ${from}`, sql`${wastageEvents.occurredAt} <= ${to}`))
        .groupBy(wastageEvents.reason)
        .orderBy(desc(sql`SUM(${wastageEvents.costImpact})`))
      const totalCost = rows.reduce((sum, r) => sum + Number(r.totalCost), 0)
      return { from, to, totalCost, rows }
    })
  }

  async stockActivityReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      // 1) Opening stock: net of all movements BEFORE `from`
      const openingRows = await db.execute(sql`
        SELECT
          inventory_item_id AS "itemId",
          COALESCE(SUM(
            CASE WHEN movement_type IN ('receive','transfer_in','return') THEN quantity ELSE 0 END
            - CASE WHEN movement_type IN ('sale','recipe_deduction','transfer_out','wastage') THEN quantity ELSE 0 END
            + CASE WHEN movement_type = 'adjustment' THEN quantity ELSE 0 END
          ), 0) AS "openingQty"
        FROM stock_movements
        WHERE organization_id = ${authContext.organizationId}
          AND location_id = ${locationId}
          AND moved_at < ${from}
        GROUP BY inventory_item_id
      `) as unknown as { rows: { itemId: string; openingQty: number }[] }

      // 2) Period activity: movements during [from, to]
      const activityRows = await db.execute(sql`
        SELECT
          inventory_item_id AS "itemId",
          COALESCE(SUM(CASE WHEN movement_type IN ('receive','transfer_in','return') THEN quantity ELSE 0 END), 0) AS "receivedQty",
          COALESCE(SUM(CASE WHEN movement_type IN ('sale','recipe_deduction') THEN quantity ELSE 0 END), 0) AS "issuedQty",
          COALESCE(SUM(CASE WHEN movement_type = 'transfer_out' THEN quantity ELSE 0 END), 0) AS "transferredOutQty",
          COALESCE(SUM(CASE WHEN movement_type = 'wastage' THEN quantity ELSE 0 END), 0) AS "wastageQty",
          COALESCE(SUM(CASE WHEN movement_type = 'adjustment' THEN quantity ELSE 0 END), 0) AS "adjustedQty",
          COALESCE(SUM(CASE WHEN movement_type IN ('receive','transfer_in','return') THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS "valueReceived",
          COALESCE(SUM(CASE WHEN movement_type IN ('sale','recipe_deduction') THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS "valueIssued",
          COALESCE(SUM(CASE WHEN movement_type = 'wastage' THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS "valueWastage"
        FROM stock_movements
        WHERE organization_id = ${authContext.organizationId}
          AND location_id = ${locationId}
          AND moved_at >= ${from}
          AND moved_at <= ${to}
        GROUP BY inventory_item_id
      `) as unknown as { rows: ActivityRow[] }

      // 3) Load all tracked items for the location (to include items with zero activity)
      const items = await db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          sku: inventoryItems.sku,
          category: inventoryItems.category,
          unit: inventoryItems.unit,
          unitCost: inventoryItems.unitCost,
          currency: inventoryItems.currency,
          reorderPoint: inventoryItems.reorderPoint,
        })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active')))

      // 4) Build lookup maps
      const openingMap = new Map<string, number>()
      for (const row of openingRows.rows) {
        openingMap.set(row.itemId, Number(row.openingQty))
      }

      interface ActivityRow {
        itemId: string
        receivedQty: number
        issuedQty: number
        transferredOutQty: number
        wastageQty: number
        adjustedQty: number
        valueReceived: number
        valueIssued: number
        valueWastage: number
      }
      const activityMap = new Map<string, ActivityRow>()
      for (const row of activityRows.rows) {
        activityMap.set(row.itemId, row as unknown as ActivityRow)
      }

      // 5) Build final report
      const rows = items.map((item) => {
        const opening = openingMap.get(item.id) ?? 0
        const activity = activityMap.get(item.id)
        const received = Number(activity?.receivedQty ?? 0)
        const issued = Number(activity?.issuedQty ?? 0)
        const transferredOut = Number(activity?.transferredOutQty ?? 0)
        const wastage = Number(activity?.wastageQty ?? 0)
        const adjusted = Number(activity?.adjustedQty ?? 0)
        const closing = opening + received - issued - transferredOut - wastage + adjusted
        const valueReceived = Number(activity?.valueReceived ?? 0)
        const valueIssued = Number(activity?.valueIssued ?? 0)
        const valueWastage = Number(activity?.valueWastage ?? 0)
        const unitCost = Number(item.unitCost ?? 0)
        const closingValue = closing * unitCost
        return {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          category: item.category,
          unit: item.unit,
          currency: item.currency,
          reorderPoint: item.reorderPoint,
          opening,
          received,
          issued,
          transferredOut,
          wastage,
          adjusted,
          closing,
          valueReceived,
          valueIssued,
          valueWastage,
          closingValue,
        }
      })

      // 6) Summary totals
      const totals = rows.reduce((acc, r) => ({
        opening: acc.opening + r.opening,
        received: acc.received + r.received,
        issued: acc.issued + r.issued,
        transferredOut: acc.transferredOut + r.transferredOut,
        wastage: acc.wastage + r.wastage,
        adjusted: acc.adjusted + r.adjusted,
        closing: acc.closing + r.closing,
        valueReceived: acc.valueReceived + r.valueReceived,
        valueIssued: acc.valueIssued + r.valueIssued,
        valueWastage: acc.valueWastage + r.valueWastage,
        closingValue: acc.closingValue + r.closingValue,
      }), {
        opening: 0, received: 0, issued: 0, transferredOut: 0, wastage: 0, adjusted: 0,
        closing: 0, valueReceived: 0, valueIssued: 0, valueWastage: 0, closingValue: 0,
      })

      return { from, to, currency: items[0]?.currency ?? 'KES', totals, rows }
    })
  }
}
