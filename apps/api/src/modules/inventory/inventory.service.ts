import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm'
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
  type Db,
} from '@hospitality-os/database'

import { OutboxService } from '../../core/events/outbox.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { StaffNotificationsService } from '../notifications/staff-notifications.service.js'
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
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(StaffNotificationsService) private readonly staffNotifications: StaffNotificationsService,
  ) {}

  private async emitStockMovementRecorded(
    db: Db,
    movement: { id: string; organizationId: string; locationId: string; movementType: string; quantity: number; inventoryItemId: string },
  ): Promise<void> {
    await this.outbox.persistAndEmit(db, {
      eventType: 'StockMovementRecorded',
      organizationId: movement.organizationId,
      locationId: movement.locationId,
      entityType: 'stock_movement',
      entityId: movement.id,
      data: { movementType: movement.movementType, quantity: movement.quantity, inventoryItemId: movement.inventoryItemId },
      occurredAt: new Date(),
    })
  }

  // db-first: callable from another module's already-open transaction (e.g.
  // OrdersService.markServed deducting recipe-linked stock on a served
  // item) — recipes/recipe_ingredients/stock_movements are inventory-owned.
  async deductForRecipeSale(
    db: Db,
    authContext: AuthContext,
    locationId: string,
    productId: string,
    orderItemId: string,
    itemQty: number,
  ): Promise<void> {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.productId, productId), eq(recipes.organizationId, authContext.organizationId)))
      .limit(1)
    if (!recipe) return

    const ingredients = await db
      .select({ inventoryItemId: recipeIngredients.inventoryItemId, quantity: recipeIngredients.quantity, unit: recipeIngredients.unit })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipe.id))
    if (ingredients.length === 0) return

    const now = new Date()
    for (const ing of ingredients) {
      const totalDeduction = Math.abs(ing.quantity) * itemQty
      const [movement] = await db
        .insert(stockMovements)
        .values({
          organizationId: authContext.organizationId,
          locationId,
          inventoryItemId: ing.inventoryItemId,
          movementType: 'recipe_deduction',
          quantity: -totalDeduction,
          unit: ing.unit,
          referenceType: 'order_item',
          referenceId: orderItemId,
          movedByActorId: authContext.actorId,
          movedAt: now,
        })
        .returning()
      if (movement) await this.emitStockMovementRecorded(db, movement)
    }
  }

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
            organizationId: auth.organizationId,
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
        const [movement] = await db.insert(stockMovements).values({
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
        }).returning()
        if (movement) await this.emitStockMovementRecorded(db, movement)
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

  async completeStockCount(auth: AuthContext, id: string, body: { items: { inventoryItemId: string; countedQuantity: number }[] }) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const scRows = await db.select().from(stockCounts).where(and(eq(stockCounts.id, id), eq(stockCounts.organizationId, auth.organizationId)))
      if (!scRows.length) throw new NotFoundException('stock count not found')
      const sc = scRows[0]!

      const adjustments: typeof stockAdjustments.$inferInsert[] = []
      const now = new Date()

      for (const item of body.items) {
        const [level] = await db
          .select()
          .from(stockLevels)
          .where(and(eq(stockLevels.inventoryItemId, item.inventoryItemId), eq(stockLevels.stockLocationId, sc.stockLocationId ?? '')))
        const expected = level?.quantity ?? 0
        const counted = item.countedQuantity
        const variance = counted - expected

        if (variance === 0) continue

        const pctVariance = expected > 0 ? Math.abs(variance) / expected : 1
        const isLarge = pctVariance > 0.1 || Math.abs(variance) > 1000

        adjustments.push({
          organizationId: auth.organizationId,
          locationId: sc.locationId,
          inventoryItemId: item.inventoryItemId,
          stockLocationId: sc.stockLocationId,
          stockCountId: sc.id,
          expectedQuantity: expected,
          countedQuantity: counted,
          variance,
          reason: 'stock count adjustment',
          adjustedByActorId: auth.actorId,
          approvedByActorId: isLarge ? null : auth.actorId,
          approvedAt: isLarge ? null : now,
        })

        await db.insert(stockLevels).values({
          organizationId: auth.organizationId,
          locationId: sc.locationId,
          inventoryItemId: item.inventoryItemId,
          stockLocationId: sc.stockLocationId,
          quantity: counted,
          unit: level?.unit ?? 'piece',
        }).onConflictDoUpdate({
          target: [stockLevels.inventoryItemId, stockLevels.stockLocationId],
          set: { quantity: counted, updatedAt: now },
        })

        const [movement] = await db.insert(stockMovements).values({
          organizationId: auth.organizationId,
          locationId: sc.locationId,
          inventoryItemId: item.inventoryItemId,
          stockLocationId: sc.stockLocationId,
          movementType: 'adjustment',
          quantity: variance,
          unit: level?.unit ?? 'piece',
          referenceType: 'stock_count',
          referenceId: sc.id,
          reason: isLarge ? 'stock count adjustment (pending approval)' : 'stock count adjustment',
          movedByActorId: auth.actorId,
          movedAt: now,
        }).returning()
        if (movement) await this.emitStockMovementRecorded(db, movement)
      }

      if (adjustments.length) {
        await db.insert(stockAdjustments).values(adjustments)
      }

      const status = adjustments.some((a) => a.approvedByActorId === null) ? 'submitted' : 'approved'
      const updatedRows = await db.update(stockCounts).set({ status, approvedByActorId: status === 'approved' ? auth.actorId : null, approvedAt: status === 'approved' ? now : null }).where(eq(stockCounts.id, id)).returning()
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
        locationId: auth.locationId ?? auth.organizationId,
        productId: dto.productId,
        versionNumber,
        notes: dto.notes ?? null,
        createdByActorId: auth.actorId,
      }).returning()
      const r = rs[0]!
      if (dto.ingredients?.length) {
        await db.insert(recipeIngredients).values(
          dto.ingredients.map((ing) => ({ organizationId: auth.organizationId, recipeId: r.id, inventoryItemId: ing.inventoryItemId, quantity: ing.quantity, unit: ing.unit, notes: ing.notes ?? null })),
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

      const [movement] = await db.insert(stockMovements).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        inventoryItemId: dto.inventoryItemId,
        stockLocationId: dto.stockLocationId,
        movementType: 'wastage',
        quantity: -Math.abs(dto.quantity),
        unit: dto.unit,
        reason: dto.reason,
        movedByActorId: auth.actorId,
      }).returning()
      if (movement) await this.emitStockMovementRecorded(db, movement)

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
  // Stock Transfers
  // =========================================================================
  async createStockTransfer(auth: AuthContext, dto: { sourceLocationId: string; destLocationId: string; items: { inventoryItemId: string; quantity: number; unit: string }[] }) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const ref = crypto.randomUUID()
      const now = new Date()
      const movements: typeof stockMovements.$inferInsert[] = []

      for (const item of dto.items) {
        movements.push({
          organizationId: auth.organizationId,
          locationId: auth.locationId ?? '',
          inventoryItemId: item.inventoryItemId,
          stockLocationId: dto.sourceLocationId,
          movementType: 'transfer_out',
          quantity: -Math.abs(item.quantity),
          unit: item.unit,
          referenceType: 'transfer',
          referenceId: ref,
          transferReferenceId: ref,
          movedByActorId: auth.actorId,
          movedAt: now,
        })
        movements.push({
          organizationId: auth.organizationId,
          locationId: auth.locationId ?? '',
          inventoryItemId: item.inventoryItemId,
          stockLocationId: dto.destLocationId,
          movementType: 'transfer_in',
          quantity: Math.abs(item.quantity),
          unit: item.unit,
          referenceType: 'transfer',
          referenceId: ref,
          transferReferenceId: ref,
          movedByActorId: auth.actorId,
          movedAt: now,
        })

        await db.insert(stockLevels).values({
          organizationId: auth.organizationId,
          locationId: auth.locationId ?? '',
          inventoryItemId: item.inventoryItemId,
          stockLocationId: dto.sourceLocationId,
          quantity: -Math.abs(item.quantity),
          unit: item.unit,
        }).onConflictDoUpdate({
          target: [stockLevels.inventoryItemId, stockLevels.stockLocationId],
          set: { quantity: sql`${stockLevels.quantity} - ${Math.abs(item.quantity)}`, updatedAt: now },
        })

        await db.insert(stockLevels).values({
          organizationId: auth.organizationId,
          locationId: auth.locationId ?? '',
          inventoryItemId: item.inventoryItemId,
          stockLocationId: dto.destLocationId,
          quantity: Math.abs(item.quantity),
          unit: item.unit,
        }).onConflictDoUpdate({
          target: [stockLevels.inventoryItemId, stockLevels.stockLocationId],
          set: { quantity: sql`${stockLevels.quantity} + ${Math.abs(item.quantity)}`, updatedAt: now },
        })
      }

      if (movements.length) {
        const inserted = await db.insert(stockMovements).values(movements).returning()
        for (const movement of inserted) {
          await this.emitStockMovementRecorded(db, movement)
        }
      }

      return { transferReferenceId: ref, itemCount: dto.items.length }
    })
  }

  async listStockTransfers(auth: AuthContext) {
    return withTenantContext(this.pool, auth.organizationId, (db) =>
      db.select().from(stockMovements).where(and(eq(stockMovements.organizationId, auth.organizationId), eq(stockMovements.movementType, 'transfer_out'))).orderBy(desc(stockMovements.movedAt)),
    )
  }

  // =========================================================================
  // Recipe Cost
  // =========================================================================
  async getRecipeCost(auth: AuthContext, id: string) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const raws = await db.select().from(recipes).where(and(eq(recipes.id, id), eq(recipes.organizationId, auth.organizationId)))
      if (!raws.length) throw new NotFoundException('recipe not found')
      const ingredients = await db
        .select({
          inventoryItemId: recipeIngredients.inventoryItemId,
          quantity: recipeIngredients.quantity,
          unit: recipeIngredients.unit,
          unitCost: inventoryItems.unitCost,
          currency: inventoryItems.currency,
          itemName: inventoryItems.name,
        })
        .from(recipeIngredients)
        .leftJoin(inventoryItems, eq(recipeIngredients.inventoryItemId, inventoryItems.id))
        .where(eq(recipeIngredients.recipeId, id))
      let totalCost = 0
      const rows = ingredients.map((ing) => {
        const lineCost = Math.round((ing.quantity ?? 0) * (ing.unitCost ?? 0))
        totalCost += lineCost
        return { inventoryItemId: ing.inventoryItemId, itemName: ing.itemName, quantity: ing.quantity, unit: ing.unit, unitCost: ing.unitCost, lineCost }
      })
      return { recipeId: id, totalCost, currency: ingredients[0]?.currency ?? 'KES', rows }
    })
  }

  // =========================================================================
  // Standalone Stock Adjustment
  // =========================================================================
  async createStockAdjustment(auth: AuthContext, dto: { inventoryItemId: string; stockLocationId: string; newQuantity: number; reason: string }) {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, dto.inventoryItemId), eq(inventoryItems.organizationId, auth.organizationId)))
      if (!item) throw new NotFoundException('inventory item not found')
      const [level] = await db
        .select()
        .from(stockLevels)
        .where(and(eq(stockLevels.inventoryItemId, dto.inventoryItemId), eq(stockLevels.stockLocationId, dto.stockLocationId)))
      const currentQty = level?.quantity ?? 0
      const variance = dto.newQuantity - currentQty
      const now = new Date()
      const [movement] = await db.insert(stockMovements).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        inventoryItemId: dto.inventoryItemId,
        stockLocationId: dto.stockLocationId,
        movementType: 'adjustment',
        quantity: variance,
        unit: level?.unit ?? item.unit,
        referenceType: 'stock_adjustment',
        reason: dto.reason,
        movedByActorId: auth.actorId,
        movedAt: now,
      }).returning()
      if (movement) await this.emitStockMovementRecorded(db, movement)
      await db.insert(stockLevels).values({
        organizationId: auth.organizationId,
        locationId: auth.locationId ?? '',
        inventoryItemId: dto.inventoryItemId,
        stockLocationId: dto.stockLocationId,
        quantity: dto.newQuantity,
        unit: level?.unit ?? item.unit,
      }).onConflictDoUpdate({
        target: [stockLevels.inventoryItemId, stockLevels.stockLocationId],
        set: { quantity: dto.newQuantity, updatedAt: now },
      })
      return { inventoryItemId: dto.inventoryItemId, stockLocationId: dto.stockLocationId, previousQuantity: currentQty, newQuantity: dto.newQuantity, variance }
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

  async supplierCreditReminders(auth: AuthContext): Promise<{ reminders: { supplierId: string; supplierName: string; dueOrders: number }[] }> {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      const dueOrders = await db
        .select()
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, auth.organizationId),
            eq(purchaseOrders.status, 'sent'),
            lte(purchaseOrders.expectedDeliveryDate, threeDaysFromNow),
          ),
        )
      const reminders: { supplierId: string; supplierName: string; dueOrders: number }[] = []
      for (const po of dueOrders) {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, po.supplierId))
        if (!supplier) continue
        await this.staffNotifications.create(db, {
          organizationId: auth.organizationId,
          locationId: po.locationId,
          notificationType: 'supplier_credit_reminder',
          message: `Supplier "${supplier.name}" has order ${po.orderNumber} due ${po.expectedDeliveryDate?.toISOString().slice(0, 10)}`,
        })
        reminders.push({ supplierId: supplier.id, supplierName: supplier.name, dueOrders: 1 })
      }
      return { reminders }
    })
  }

  async sellByWeight(auth: AuthContext, itemId: string, weightGrams: number, pricePerKg: number): Promise<{ totalPrice: number; weightKg: number }> {
    return withTenantContext(this.pool, auth.organizationId, async (db) => {
      const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.organizationId, auth.organizationId)))
      if (!item) throw new NotFoundException('inventory item not found')
      const weightKg = weightGrams / 1000
      const totalPrice = Math.round(weightKg * pricePerKg)
      return { totalPrice, weightKg }
    })
  }
}
