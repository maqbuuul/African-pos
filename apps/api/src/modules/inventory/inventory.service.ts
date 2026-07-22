import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  inventoryItems,
  stockLevels,
  stockMovements,
  stockLocations,
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
}
