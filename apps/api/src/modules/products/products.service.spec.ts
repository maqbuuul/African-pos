import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import { ApprovalRequiredException } from '../../core/errors/approval-required.exception.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import {
  closeFixturePool,
  createLocationFixture,
  createProductFixture,
  createStaffFixture,
  deleteLocationFixture,
  deleteProductFixture,
  deleteStaffFixture,
  staffActorContext,
  systemDb,
  testActorContext,
  type LocationFixture,
  type ProductFixture,
} from '../../test/fixtures.js'
import { eq } from 'drizzle-orm'
import { productPrices, products, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'
import { ProductsService } from './products.service.js'

async function expectApprovalRequired(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApprovalRequiredException) return error.approvalRequestId
    throw error
  }
  throw new Error('expected ApprovalRequiredException to be thrown')
}

describe('ProductsService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let productsService: ProductsService
  let approvalsService: ApprovalsService
  let location: LocationFixture
  let product: ProductFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    productsService = moduleRef.get(ProductsService)
    approvalsService = moduleRef.get(ApprovalsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    product = await createProductFixture(location, { priceAmount: 1000 })
  })

  afterEach(async () => {
    await deleteProductFixture(product)
    await deleteLocationFixture(location)
  })

  describe('create', () => {
    it('opens a price-history row atomically with the product, never leaving it priceless', async () => {
      const authContext = testActorContext(location)
      const created = await productsService.create(authContext, {
        locationId: location.locationId,
        categoryId: product.categoryId,
        name: 'Nyama Choma',
        priceAmount: 1200,
        currency: 'KES',
      })
      expect(created.priceAmount).toBe(1200)

      const history = await productsService.priceHistory(authContext, created.id)
      expect(history).toHaveLength(1)
      expect(history[0]?.reason).toBe('initial price')
      expect(history[0]?.priceAmount).toBe(1200)

      // Shares product's own category/menu (created against product.categoryId) —
      // only this product's own rows need cleaning up.
      await systemDb.delete(productPrices).where(eq(productPrices.productId, created.id))
      await systemDb.delete(products).where(eq(products.id, created.id))
    })

    it('rejects a category from a different organization (RLS-invisible, not just a bare FK check)', async () => {
      const authContext = testActorContext(location)
      const other = await createLocationFixture()
      const otherProduct = await createProductFixture(other)

      await expect(
        productsService.create(authContext, {
          locationId: location.locationId,
          categoryId: otherProduct.categoryId,
          name: 'Cross-tenant item',
          priceAmount: 500,
          currency: 'KES',
        }),
      ).rejects.toThrow('category not found')

      await deleteProductFixture(otherProduct)
      await deleteLocationFixture(other)
    })
  })

  describe('changePrice', () => {
    it('applies a change under the threshold directly, closing the old price row and opening a new one', async () => {
      const authContext = testActorContext(location)
      const updated = await productsService.changePrice(authContext, product.productId, { priceAmount: 1100, currency: 'KES' })
      expect('priceAmount' in updated && updated.priceAmount).toBe(1100)

      const history = await productsService.priceHistory(authContext, product.productId)
      expect(history).toHaveLength(2)
      expect(history.find((row) => row.priceAmount === 1000)?.effectiveTo).not.toBeNull()
      expect(history.find((row) => row.priceAmount === 1100)?.effectiveTo).toBeNull()
    })

    it('never overwrites priceAmount in place — the product row always matches the currently-open price-history row', async () => {
      const authContext = testActorContext(location)
      await productsService.changePrice(authContext, product.productId, { priceAmount: 1050, currency: 'KES' })
      const fetched = await productsService.getById(authContext, product.productId)
      expect(fetched.priceAmount).toBe(1050)
    })

    it('a jump beyond the configured threshold (default 20%) requires owner approval, then applies once approved+consumed', async () => {
      const supervisor = await createStaffFixture(location, 'supervisor')
      const owner = await createStaffFixture(location, 'branch_manager')
      const requesterContext = staffActorContext(location, supervisor)

      // 1000 -> 2000 is a 100% jump, well above the 20% default threshold.
      const approvalRequestId = await expectApprovalRequired(
        productsService.changePrice(requesterContext, product.productId, { priceAmount: 2000, currency: 'KES' }),
      )

      await withTenantContext(pool, location.organizationId, (db: Db) =>
        approvalsService.approve(db, { id: approvalRequestId, organizationId: location.organizationId, approverActorId: owner.staffId }),
      )

      const result = await productsService.changePrice(
        requesterContext,
        product.productId,
        { priceAmount: 2000, currency: 'KES' },
        approvalRequestId,
      )
      expect('priceAmount' in result && result.priceAmount).toBe(2000)

      await deleteStaffFixture(supervisor)
      await deleteStaffFixture(owner)
    })
  })

  describe('markUnavailable / markAvailable', () => {
    it('86ing a product sets isAvailable=false and an optional autoRestoreAt', async () => {
      const authContext = testActorContext(location)
      const restoreAt = new Date(Date.now() + 86_400_000).toISOString()
      const updated = await productsService.markUnavailable(authContext, product.productId, { autoRestoreAt: restoreAt, reason: '86d for the night' })
      expect(updated.isAvailable).toBe(false)
      expect(updated.autoRestoreAt).not.toBeNull()

      const restored = await productsService.markAvailable(authContext, product.productId)
      expect(restored.isAvailable).toBe(true)
      expect(restored.autoRestoreAt).toBeNull()
    })
  })

  describe('delete', () => {
    it('removes the product; a subsequent get 404s', async () => {
      const authContext = testActorContext(location)
      const created = await productsService.create(authContext, {
        locationId: location.locationId,
        categoryId: product.categoryId,
        name: 'Temp Product',
        priceAmount: 100,
        currency: 'KES',
      })
      await productsService.delete(authContext, created.id)
      await expect(productsService.getById(authContext, created.id)).rejects.toThrow('product not found')
    })
  })
})
