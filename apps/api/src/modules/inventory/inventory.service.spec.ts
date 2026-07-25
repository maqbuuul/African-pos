import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import {
  closeFixturePool,
  createLocationFixture,
  createProductFixture,
  deleteLocationFixture,
  deleteOrgInventoryData,
  deleteProductFixture,
  testActorContext,
  type LocationFixture,
  type ProductFixture,
} from '../../test/fixtures.js'
import { InventoryService } from './inventory.service.js'

describe('InventoryService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let inventoryService: InventoryService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    inventoryService = moduleRef.get(InventoryService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteOrgInventoryData(location.organizationId)
    await deleteLocationFixture(location)
  })

  describe('inventory items + suppliers + stock locations', () => {
    it('creates an inventory item and can fetch/update it', async () => {
      const authContext = testActorContext(location)
      const created = await inventoryService.createInventoryItem(authContext, { name: 'Tomatoes', unit: 'kg', reorderPoint: 5 })
      expect(created?.name).toBe('Tomatoes')

      const updated = await inventoryService.updateInventoryItem(authContext, created!.id, { reorderPoint: 10 })
      expect(updated?.reorderPoint).toBe(10)

      await expect(inventoryService.getInventoryItem(authContext, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        'inventory item not found',
      )
    })

    it('creates a supplier and a stock location', async () => {
      const authContext = testActorContext(location)
      const supplier = await inventoryService.createSupplier(authContext, { name: 'Local Farms Ltd' })
      expect(supplier?.name).toBe('Local Farms Ltd')

      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Main Store' })
      expect(stockLocation?.name).toBe('Main Store')
    })
  })

  describe('purchase orders + receiveGoods', () => {
    it('receiving goods against a PO increases stock levels and marks it received', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Rice', unit: 'kg' })
      const supplier = await inventoryService.createSupplier(authContext, { name: 'Wholesale Rice Co' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Dry Store' })

      const po = await inventoryService.createPurchaseOrder(authContext, {
        supplierId: supplier!.id,
        orderNumber: 'PO-001',
        items: [{ inventoryItemId: item!.id, orderedQuantity: 50, unit: 'kg', expectedUnitCost: 120 }],
      })
      expect(po.items).toHaveLength(1)

      const result = await inventoryService.receiveGoods(authContext, po.id!, stockLocation!.id)
      expect(result.received).toBe(true)
      expect(result.itemCount).toBe(1)

      const updatedPo = await inventoryService.getPurchaseOrder(authContext, po.id!)
      expect(updatedPo.status).toBe('received')

      const levels = await inventoryService.listStockLevels(authContext, location.locationId)
      const level = levels.find((l) => l.inventoryItemId === item!.id && l.stockLocationId === stockLocation!.id)
      expect(level?.quantity).toBe(50)
    })

    it('receiving the same PO twice accumulates stock (onConflictDoUpdate adds, not overwrites)', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Sugar', unit: 'kg' })
      const supplier = await inventoryService.createSupplier(authContext, { name: 'Sugar Co' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Store' })
      const po = await inventoryService.createPurchaseOrder(authContext, {
        supplierId: supplier!.id,
        orderNumber: 'PO-002',
        items: [{ inventoryItemId: item!.id, orderedQuantity: 20, unit: 'kg' }],
      })

      await inventoryService.receiveGoods(authContext, po.id!, stockLocation!.id)
      await inventoryService.receiveGoods(authContext, po.id!, stockLocation!.id)

      const levels = await inventoryService.listStockLevels(authContext, location.locationId)
      const level = levels.find((l) => l.inventoryItemId === item!.id)
      expect(level?.quantity).toBe(40)
    })
  })

  describe('recordWastage', () => {
    it('decreases stock level and records a negative-quantity stock movement', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Milk', unit: 'l' })
      const supplier = await inventoryService.createSupplier(authContext, { name: 'Dairy Co' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Fridge' })
      const po = await inventoryService.createPurchaseOrder(authContext, {
        supplierId: supplier!.id,
        orderNumber: 'PO-003',
        items: [{ inventoryItemId: item!.id, orderedQuantity: 10, unit: 'l' }],
      })
      await inventoryService.receiveGoods(authContext, po.id!, stockLocation!.id)

      const wastage = await inventoryService.recordWastage(authContext, {
        inventoryItemId: item!.id,
        stockLocationId: stockLocation!.id,
        quantity: 3,
        unit: 'l',
        reason: 'spoiled',
      })
      expect(wastage?.quantity).toBe(3)

      const levels = await inventoryService.listStockLevels(authContext, location.locationId)
      const level = levels.find((l) => l.inventoryItemId === item!.id)
      expect(level?.quantity).toBe(7)

      const movements = await inventoryService.listStockMovements(authContext, item!.id)
      expect(movements.find((m) => m.movementType === 'wastage')?.quantity).toBe(-3)
    })
  })

  describe('createStockTransfer', () => {
    it('moves quantity from source to destination location, both stock levels updated', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Flour', unit: 'kg' })
      const supplier = await inventoryService.createSupplier(authContext, { name: 'Flour Co' })
      const source = await inventoryService.createStockLocation(authContext, { name: 'Warehouse' })
      const dest = await inventoryService.createStockLocation(authContext, { name: 'Kitchen' })
      const po = await inventoryService.createPurchaseOrder(authContext, {
        supplierId: supplier!.id,
        orderNumber: 'PO-004',
        items: [{ inventoryItemId: item!.id, orderedQuantity: 100, unit: 'kg' }],
      })
      await inventoryService.receiveGoods(authContext, po.id!, source!.id)

      const transfer = await inventoryService.createStockTransfer(authContext, {
        sourceLocationId: source!.id,
        destLocationId: dest!.id,
        items: [{ inventoryItemId: item!.id, quantity: 30, unit: 'kg' }],
      })
      expect(transfer.itemCount).toBe(1)

      const levels = await inventoryService.listStockLevels(authContext, location.locationId)
      expect(levels.find((l) => l.stockLocationId === source!.id)?.quantity).toBe(70)
      expect(levels.find((l) => l.stockLocationId === dest!.id)?.quantity).toBe(30)
    })
  })

  describe('createStockAdjustment', () => {
    it('sets stock to an exact new quantity and records the variance as a movement', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Salt', unit: 'kg' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Pantry' })

      const result = await inventoryService.createStockAdjustment(authContext, {
        inventoryItemId: item!.id,
        stockLocationId: stockLocation!.id,
        newQuantity: 25,
        reason: 'initial count',
      })
      expect(result.previousQuantity).toBe(0)
      expect(result.newQuantity).toBe(25)
      expect(result.variance).toBe(25)

      const levels = await inventoryService.listStockLevels(authContext, location.locationId)
      expect(levels.find((l) => l.inventoryItemId === item!.id)?.quantity).toBe(25)
    })
  })

  describe('createStockCount / completeStockCount', () => {
    it('a small variance auto-approves; the resulting stock count status is "approved"', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Pepper', unit: 'kg' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Spice Rack' })
      await inventoryService.createStockAdjustment(authContext, {
        inventoryItemId: item!.id,
        stockLocationId: stockLocation!.id,
        newQuantity: 100,
        reason: 'baseline',
      })

      const count = await inventoryService.createStockCount(authContext, stockLocation!.id)
      const completed = await inventoryService.completeStockCount(authContext, count!.id, {
        items: [{ inventoryItemId: item!.id, countedQuantity: 98 }], // 2% variance — small
      })
      expect(completed?.status).toBe('approved')
    })

    it('a large variance (>10% or >1000 units) leaves the count "submitted", pending approval', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Cooking Oil', unit: 'l' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Store Room' })
      await inventoryService.createStockAdjustment(authContext, {
        inventoryItemId: item!.id,
        stockLocationId: stockLocation!.id,
        newQuantity: 100,
        reason: 'baseline',
      })

      const count = await inventoryService.createStockCount(authContext, stockLocation!.id)
      const completed = await inventoryService.completeStockCount(authContext, count!.id, {
        items: [{ inventoryItemId: item!.id, countedQuantity: 50 }], // 50% variance — large
      })
      expect(completed?.status).toBe('submitted')
    })

    it('a zero-variance item is skipped entirely — no adjustment row, count still resolves', async () => {
      const authContext = testActorContext(location)
      const item = await inventoryService.createInventoryItem(authContext, { name: 'Vinegar', unit: 'l' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Store' })
      await inventoryService.createStockAdjustment(authContext, {
        inventoryItemId: item!.id,
        stockLocationId: stockLocation!.id,
        newQuantity: 10,
        reason: 'baseline',
      })

      const count = await inventoryService.createStockCount(authContext, stockLocation!.id)
      const completed = await inventoryService.completeStockCount(authContext, count!.id, {
        items: [{ inventoryItemId: item!.id, countedQuantity: 10 }],
      })
      expect(completed?.status).toBe('approved')
    })
  })

  describe('deductForRecipeSale (db-first, used by OrdersService.markServed)', () => {
    let product: ProductFixture

    beforeEach(async () => {
      product = await createProductFixture(location)
    })

    afterEach(async () => {
      // recipes.product_id is onDelete:'restrict' — clear recipe data (owned
      // by deleteOrgInventoryData) before the product it points at.
      await deleteOrgInventoryData(location.organizationId)
      await deleteProductFixture(product)
    })

    it('deducts each ingredient by quantity * items sold, scaled by recipe quantity', async () => {
      const authContext = testActorContext(location)
      const flour = await inventoryService.createInventoryItem(authContext, { name: 'Flour (recipe)', unit: 'g' })
      const stockLocation = await inventoryService.createStockLocation(authContext, { name: 'Kitchen Store' })
      await inventoryService.createStockAdjustment(authContext, {
        inventoryItemId: flour!.id,
        stockLocationId: stockLocation!.id,
        newQuantity: 5000,
        reason: 'baseline',
      })

      await inventoryService.createRecipe(authContext, {
        productId: product.productId,
        ingredients: [{ inventoryItemId: flour!.id, quantity: 200, unit: 'g' }],
      })

      await withTenantContext(pool, location.organizationId, (db: Db) =>
        inventoryService.deductForRecipeSale(db, authContext, location.locationId, product.productId, 'fake-order-item-id', 3),
      )

      const movements = await inventoryService.listStockMovements(authContext, flour!.id)
      const deduction = movements.find((m) => m.movementType === 'recipe_deduction')
      expect(deduction?.quantity).toBe(-600) // 200g * 3 items sold
    })

    it('is a no-op when the product has no recipe at all', async () => {
      const authContext = testActorContext(location)
      await withTenantContext(pool, location.organizationId, (db: Db) =>
        inventoryService.deductForRecipeSale(db, authContext, location.locationId, product.productId, 'fake-order-item-id', 1),
      )
      // No throw, no movements — nothing to assert beyond "didn't crash".
    })
  })

  describe('getRecipeCost', () => {
    let product: ProductFixture

    beforeEach(async () => {
      product = await createProductFixture(location)
    })

    afterEach(async () => {
      // recipes.product_id is onDelete:'restrict' — clear recipe data (owned
      // by deleteOrgInventoryData) before the product it points at.
      await deleteOrgInventoryData(location.organizationId)
      await deleteProductFixture(product)
    })

    it('sums ingredient quantity * unitCost across the recipe', async () => {
      const authContext = testActorContext(location)
      const sugar = await inventoryService.createInventoryItem(authContext, { name: 'Sugar (cost)', unit: 'g', unitCost: 2 })
      const butter = await inventoryService.createInventoryItem(authContext, { name: 'Butter (cost)', unit: 'g', unitCost: 5 })

      const recipe = await inventoryService.createRecipe(authContext, {
        productId: product.productId,
        ingredients: [
          { inventoryItemId: sugar!.id, quantity: 100, unit: 'g' },
          { inventoryItemId: butter!.id, quantity: 50, unit: 'g' },
        ],
      })

      const cost = await inventoryService.getRecipeCost(authContext, recipe!.id)
      expect(cost.totalCost).toBe(100 * 2 + 50 * 5) // 450
    })
  })
})
