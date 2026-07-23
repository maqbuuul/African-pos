import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  goodsReceipts,
  inventoryItems,
  purchaseOrderItems,
  purchaseOrders,
  recipeIngredients,
  recipes,
  stockAdjustments,
  stockCounts,
  stockLevels,
  stockLocations,
  stockMovements,
  suppliers,
  wastageEvents,
  withTenantContext,
} from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js'
import type { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js'
import type { CreateRecipeDto } from './dto/create-recipe.dto.js'
import type { CreateStockLocationDto } from './dto/create-stock-location.dto.js'
import type { CreateSupplierDto } from './dto/create-supplier.dto.js'
import type { RecordWastageDto } from './dto/record-wastage.dto.js'
import type { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js'
import type { UpdateSupplierDto } from './dto/update-supplier.dto.js'

@Injectable()
export class InventoryService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  // =========================================================================
  // Suppliers
  // =========================================================================
  async listSuppliers(auth: AuthContext) {
    return withTenantContext(this.pool, auth.organizationId, (db) =>
      db.select().from(suppliers).where(eq(suppliers.organizationId, auth.organizationId)).orderBy(suppliers.name),
    )
  }

  async getSupplier(auth: AuthContext, id: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, auth.organizationId)))
      if (!rows.length) throw new NotFoundException('supplier not found')
      return rows[0]
    })
  }

  async createSupplier(auth: AuthContext, dto: CreateSupplierDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.insert(suppliers).values({ organizationId: auth.organizationId, locationId: auth.locationId ?? '', ...dto }).returning()
      return rows[0]
    })
  }

  async updateSupplier(auth: AuthContext, id: string, dto: UpdateSupplierDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.update(suppliers).set(dto).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, auth.organizationId))).returning()
      if (!rows.length) throw new NotFoundException('supplier not found')
      return rows[0]
    })
  }

  // =========================================================================
  // Inventory Items
  // =========================================================================
  async listInventoryItems(auth: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, auth.organizationId, (db) => {
      const conditions = [eq(inventoryItems.organizationId, auth.organizationId)]
      if (locationId) conditions.push(eq(inventoryItems.locationId, locationId))
      return db.select().from(inventoryItems).where(and(...conditions)).orderBy(inventoryItems.name)
    })
  }

  async getInventoryItem(auth: AuthContext, id: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, auth.organizationId)))
      if (!rows.length) throw new NotFoundException('inventory item not found')
      return rows[0]
    })
  }

  async createInventoryItem(auth: AuthContext, dto: CreateInventoryItemDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.insert(inventoryItems).values({ organizationId: auth.organizationId, locationId: auth.locationId ?? '', ...dto }).returning()
      return rows[0]
    })
  }

  async updateInventoryItem(auth: AuthContext, id: string, dto: UpdateInventoryItemDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.update(inventoryItems).set(dto).where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, auth.organizationId))).returning()
      if (!rows.length) throw new NotFoundException('inventory item not found')
      return rows[0]
    })
  }

  // =========================================================================
  // Stock Locations
  // =========================================================================
  async listStockLocations(auth: AuthContext) {
    return withTenantContext(this.pool, auth.organizationId, (db) =>
      db.select().from(stockLocations).where(eq(stockLocations.organizationId, auth.organizationId)).orderBy(stockLocations.name),
    )
  }

  async createStockLocation(auth: AuthContext, dto: CreateStockLocationDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.insert(stockLocations).values({ organizationId: auth.organizationId, locationId: auth.locationId ?? '', ...dto }).returning()
      return rows[0]
    })
  }

  // =========================================================================
  // Stock Levels
  // =========================================================================
  async listStockLevels(auth: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, auth.organizationId, (db) => {
      const conditions = [eq(stockLevels.organizationId, auth.organizationId)]
      if (locationId) conditions.push(eq(stockLevels.locationId, locationId))
      return db.select().from(stockLevels).where(and(...conditions))
    })
  }

  // =========================================================================
  // Stock Movements
  // =========================================================================
  async listStockMovements(auth: AuthContext, inventoryItemId?: string, from?: Date, to?: Date) {
    return withTenantContext(this.pool, auth.organizationId, (db) => {
      const conditions = [eq(stockMovements.organizationId, auth.organizationId)]
      if (inventoryItemId) conditions.push(eq(stockMovements.inventoryItemId, inventoryItemId))
      if (from) conditions.push(sql`${stockMovements.movedAt} >= ${from}`)
      if (to) conditions.push(sql`${stockMovements.movedAt} <= ${to}`)
      return db.select().from(stockMovements).where(and(...conditions)).orderBy(desc(stockMovements.movedAt))
    })
  }

  // =========================================================================
  // Purchase Orders
  // =========================================================================
  async listPurchaseOrders(auth: AuthContext, supplierId?: string) {
    return withTenantContext(this.pool, auth.organizationId, (db) => {
      const conditions = [eq(purchaseOrders.organizationId, auth.organizationId)]
      if (supplierId) conditions.push(eq(purchaseOrders.supplierId, supplierId))
      return db.select().from(purchaseOrders).where(and(...conditions)).orderBy(desc(purchaseOrders.createdAt))
    })
  }

  async getPurchaseOrder(auth: AuthContext, id: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const pos = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, auth.organizationId)))
      if (!pos.length) throw new NotFoundException('purchase order not found')
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id))
      return { ...pos[0], items }
    })
  }

  async createPurchaseOrder(auth: AuthContext, dto: CreatePurchaseOrderDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const { items: _items, ...poFields } = dto
      const pos = await db.insert(purchaseOrders).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        supplierId: dto.supplierId,
        orderNumber: dto.orderNumber,
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        notes: dto.notes ?? null,
        totalAmount: dto.totalAmount ?? 0,
        currency: dto.currency ?? 'KES',
        createdByActorId: auth.actorId,
        status: 'draft',
      }).returning()
      const po = pos[0]!
      if (dto.items?.length) {
        await db.insert(purchaseOrderItems).values(
          dto.items.map((i) => ({
            purchaseOrderId: po.id,
            inventoryItemId: i.inventoryItemId,
            orderedQuantity: i.orderedQuantity,
            unit: i.unit,
            expectedUnitCost: i.expectedUnitCost ?? null,
          })),
        )
      }
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id))
      return { ...po, items }
    })
  }

  async updatePurchaseOrderStatus(auth: AuthContext, id: string, status: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const rows = await db.update(purchaseOrders).set({ status }).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, auth.organizationId))).returning()
      if (!rows.length) throw new NotFoundException('purchase order not found')
      return rows[0]
    })
  }

  async receiveGoods(auth: AuthContext, purchaseOrderId: string, stockLocationId: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const pos = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.organizationId, auth.organizationId)))
      if (!pos.length) throw new NotFoundException('purchase order not found')
      const po = pos[0]!

      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
      const now = new Date()

      for (const item of items) {
        const receivedQty = item.orderedQuantity
        await db.update(purchaseOrderItems).set({ receivedQuantity: receivedQty, actualUnitCost: item.expectedUnitCost }).where(eq(purchaseOrderItems.id, item.id))
        await db.insert(stockMovements).values({
          organizationId: auth.organizationId,
          locationId: po.locationId,
          inventoryItemId: item.inventoryItemId,
          stockLocationId,
          movementType: 'receive',
          quantity: receivedQty,
          unit: item.unit,
          unitCost: item.expectedUnitCost ?? undefined,
          referenceType: 'purchase_order',
          referenceId: purchaseOrderId,
          movedByActorId: auth.actorId,
          movedAt: now,
        })
        await db.insert(stockLevels).values({
          organizationId: auth.organizationId,
          locationId: po.locationId,
          inventoryItemId: item.inventoryItemId,
          stockLocationId,
          quantity: receivedQty,
          unit: item.unit,
        }).onConflictDoUpdate({
          target: [stockLevels.inventoryItemId, stockLevels.stockLocationId],
          set: { quantity: sql`${stockLevels.quantity} + ${receivedQty}`, updatedAt: now },
        })
      }

      await db.insert(goodsReceipts).values({
        organizationId: auth.organizationId,
        locationId: po.locationId,
        purchaseOrderId,
        receivedByActorId: auth.actorId,
        notes: null,
      })
      await db.update(purchaseOrders).set({ status: 'received' }).where(eq(purchaseOrders.id, purchaseOrderId))

      return { received: true, itemCount: items.length }
    })
  }

  // =========================================================================
  // Stock Counts
  // =========================================================================
  async createStockCount(auth: AuthContext, stockLocationId: string, notes?: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const scs = await db.insert(stockCounts).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        stockLocationId,
        status: 'open',
        countedByActorId: auth.actorId,
        notes: notes ?? null,
      }).returning()
      return scs[0]
    })
  }

  async completeStockCount(auth: AuthContext, id: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const scRows = await db.select().from(stockCounts).where(and(eq(stockCounts.id, id), eq(stockCounts.organizationId, auth.organizationId)))
      if (!scRows.length) throw new NotFoundException('stock count not found')
      const sc = scRows[0]!

      const currentLevels = await db.select().from(stockLevels).where(and(eq(stockLevels.stockLocationId, sc.stockLocationId ?? ''), eq(stockLevels.organizationId, auth.organizationId)))

      for (const level of currentLevels) {
        const variance = 0 - level.quantity
        if (variance !== 0) {
          await db.insert(stockAdjustments).values({
            organizationId: auth.organizationId,
            locationId: sc.locationId,
            inventoryItemId: level.inventoryItemId,
            stockLocationId: sc.stockLocationId,
            stockCountId: sc.id,
            expectedQuantity: level.quantity,
            countedQuantity: 0,
            variance,
            reason: 'stock count adjustment',
            adjustedByActorId: auth.actorId,
          })
        }
      }

      const updatedRows = await db.update(stockCounts).set({ status: 'completed', approvedByActorId: auth.actorId, approvedAt: new Date() }).where(eq(stockCounts.id, id)).returning()
      return updatedRows[0]
    })
  }

  // =========================================================================
  // Recipes
  // =========================================================================
  async listRecipes(auth: AuthContext) {
    return withTenantContext(this.pool, auth.organizationId, (db) =>
      db.select().from(recipes).where(eq(recipes.organizationId, auth.organizationId)).orderBy(desc(recipes.createdAt)),
    )
  }

  async getRecipe(auth: AuthContext, id: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const raws = await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.organizationId, auth.organizationId)))
      if (!raws.length) throw new NotFoundException('recipe not found')
      const recipe = raws[0]
      const ingredients = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, id))
      return { ...recipe, ingredients }
    })
  }

  async createRecipe(auth: AuthContext, dto: CreateRecipeDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const existingRows = await db.select().from(recipes).where(and(eq(recipes.productId, dto.productId), eq(recipes.organizationId, auth.organizationId))).orderBy(desc(recipes.versionNumber)).limit(1)
      const versionNumber = existingRows.length ? existingRows[0]!.versionNumber + 1 : 1
      const rs = await db.insert(recipes).values({
        organizationId: auth.organizationId,
        productId: dto.productId,
        versionNumber,
        notes: dto.notes ?? null,
        createdByActorId: auth.actorId,
      }).returning()
      const r = rs[0]!
      if (dto.ingredients?.length) {
        await db.insert(recipeIngredients).values(
          dto.ingredients.map((ing) => ({ recipeId: r.id, inventoryItemId: ing.inventoryItemId, quantity: ing.quantity, unit: ing.unit, notes: ing.notes ?? null })),
        )
      }
      const ingredients = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, r.id))
      return { ...r, ingredients }
    })
  }

  // =========================================================================
  // Wastage
  // =========================================================================
  async listWastageEvents(auth: AuthContext, from?: Date, to?: Date) {
    return withTenantContext(this.pool, auth.organizationId, (db) => {
      const conditions = [eq(wastageEvents.organizationId, auth.organizationId)]
      if (from) conditions.push(sql`${wastageEvents.occurredAt} >= ${from}`)
      if (to) conditions.push(sql`${wastageEvents.occurredAt} <= ${to}`)
      return db.select().from(wastageEvents).where(and(...conditions)).orderBy(desc(wastageEvents.occurredAt))
    })
  }

  async recordWastage(auth: AuthContext, dto: RecordWastageDto) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const evts = await db.insert(wastageEvents).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        inventoryItemId: dto.inventoryItemId,
        stockLocationId: dto.stockLocationId,
        quantity: dto.quantity,
        unit: dto.unit,
        reason: dto.reason,
        costImpact: dto.costImpact ?? null,
        recordedByActorId: auth.actorId,
      }).returning()

      await db.insert(stockMovements).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        inventoryItemId: dto.inventoryItemId,
        stockLocationId: dto.stockLocationId,
        movementType: 'wastage',
        quantity: -Math.abs(dto.quantity),
        unit: dto.unit,
        reason: dto.reason,
        movedByActorId: auth.actorId,
      })

      await db.insert(stockLevels).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        inventoryItemId: dto.inventoryItemId,
        stockLocationId: dto.stockLocationId,
        quantity: -Math.abs(dto.quantity),
        unit: dto.unit,
      }).onConflictDoUpdate({
        target: [stockLevels.inventoryItemId, stockLevels.stockLocationId],
        set: { quantity: sql`${stockLevels.quantity} - ${Math.abs(dto.quantity)}`, updatedAt: new Date() },
      })

      return evts[0]
    })
  }

  // =========================================================================
  // Existing Reports (preserved unchanged)
  // =========================================================================
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
      const openingRows = await db.execute(sql`
        SELECT inventory_item_id AS "itemId",
               COALESCE(SUM(CASE WHEN movement_type IN ('receive','transfer_in','return') THEN quantity ELSE 0 END
                         - CASE WHEN movement_type IN ('sale','recipe_deduction','transfer_out','wastage') THEN quantity ELSE 0 END
                         + CASE WHEN movement_type = 'adjustment' THEN quantity ELSE 0 END), 0) AS "openingQty"
        FROM stock_movements
        WHERE organization_id = ${authContext.organizationId} AND location_id = ${locationId} AND moved_at < ${from}
        GROUP BY inventory_item_id
      `) as unknown as { rows: { itemId: string; openingQty: number }[] }

      const activityRows = await db.execute(sql`
        SELECT inventory_item_id AS "itemId",
               COALESCE(SUM(CASE WHEN movement_type IN ('receive','transfer_in','return') THEN quantity ELSE 0 END), 0) AS "receivedQty",
               COALESCE(SUM(CASE WHEN movement_type IN ('sale','recipe_deduction') THEN quantity ELSE 0 END), 0) AS "issuedQty",
               COALESCE(SUM(CASE WHEN movement_type = 'transfer_out' THEN quantity ELSE 0 END), 0) AS "transferredOutQty",
               COALESCE(SUM(CASE WHEN movement_type = 'wastage' THEN quantity ELSE 0 END), 0) AS "wastageQty",
               COALESCE(SUM(CASE WHEN movement_type = 'adjustment' THEN quantity ELSE 0 END), 0) AS "adjustedQty",
               COALESCE(SUM(CASE WHEN movement_type IN ('receive','transfer_in','return') THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS "valueReceived",
               COALESCE(SUM(CASE WHEN movement_type IN ('sale','recipe_deduction') THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS "valueIssued",
               COALESCE(SUM(CASE WHEN movement_type = 'wastage' THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0) AS "valueWastage"
        FROM stock_movements
        WHERE organization_id = ${authContext.organizationId} AND location_id = ${locationId} AND moved_at >= ${from} AND moved_at <= ${to}
        GROUP BY inventory_item_id
      `) as unknown as { rows: ActivityRow[] }

      const items = await db
        .select({ id: inventoryItems.id, name: inventoryItems.name, sku: inventoryItems.sku, category: inventoryItems.category, unit: inventoryItems.unit, unitCost: inventoryItems.unitCost, currency: inventoryItems.currency, reorderPoint: inventoryItems.reorderPoint })
        .from(inventoryItems)
        .where(and(eq(inventoryItems.organizationId, authContext.organizationId), eq(inventoryItems.locationId, locationId), eq(inventoryItems.trackStock, true), eq(inventoryItems.status, 'active')))

      const openingMap = new Map<string, number>()
      for (const row of openingRows.rows) openingMap.set(row.itemId, Number(row.openingQty))

      interface ActivityRow { itemId: string; receivedQty: number; issuedQty: number; transferredOutQty: number; wastageQty: number; adjustedQty: number; valueReceived: number; valueIssued: number; valueWastage: number }
      const activityMap = new Map<string, ActivityRow>()
      for (const row of activityRows.rows) activityMap.set(row.itemId, row as unknown as ActivityRow)

      const rows = items.map((item) => {
        const opening = openingMap.get(item.id) ?? 0
        const a = activityMap.get(item.id)
        const received = Number(a?.receivedQty ?? 0); const issued = Number(a?.issuedQty ?? 0)
        const transferredOut = Number(a?.transferredOutQty ?? 0); const wastage = Number(a?.wastageQty ?? 0)
        const adjusted = Number(a?.adjustedQty ?? 0); const closing = opening + received - issued - transferredOut - wastage + adjusted
        return { itemId: item.id, itemName: item.name, sku: item.sku, category: item.category, unit: item.unit, currency: item.currency, reorderPoint: item.reorderPoint, opening, received, issued, transferredOut, wastage, adjusted, closing, valueReceived: Number(a?.valueReceived ?? 0), valueIssued: Number(a?.valueIssued ?? 0), valueWastage: Number(a?.valueWastage ?? 0), closingValue: closing * Number(item.unitCost ?? 0) }
      })

      const totals = rows.reduce((acc, r) => ({ opening: acc.opening + r.opening, received: acc.received + r.received, issued: acc.issued + r.issued, transferredOut: acc.transferredOut + r.transferredOut, wastage: acc.wastage + r.wastage, adjusted: acc.adjusted + r.adjusted, closing: acc.closing + r.closing, valueReceived: acc.valueReceived + r.valueReceived, valueIssued: acc.valueIssued + r.valueIssued, valueWastage: acc.valueWastage + r.valueWastage, closingValue: acc.closingValue + r.closingValue }), { opening: 0, received: 0, issued: 0, transferredOut: 0, wastage: 0, adjusted: 0, closing: 0, valueReceived: 0, valueIssued: 0, valueWastage: 0, closingValue: 0 })
      return { from, to, currency: items[0]?.currency ?? 'KES', totals, rows }
    })
  }
}
