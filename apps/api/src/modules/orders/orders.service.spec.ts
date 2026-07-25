import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { bills, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { ApprovalRequiredException } from '../../core/errors/approval-required.exception.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import {
  closeFixturePool,
  createKdsStationFixture,
  createLocationFixture,
  createProductFixture,
  createStaffFixture,
  deleteKdsStationFixture,
  deleteLocationFixture,
  deleteOrgOrderData,
  deleteProductFixture,
  deleteStaffFixture,
  staffActorContext,
  systemDb,
  testActorContext,
  type KdsStationFixture,
  type LocationFixture,
  type ProductFixture,
} from '../../test/fixtures.js'
import { OrdersService } from './orders.service.js'

async function expectApprovalRequired(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApprovalRequiredException) return error.approvalRequestId
    throw error
  }
  throw new Error('expected ApprovalRequiredException to be thrown')
}

describe('OrdersService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let ordersService: OrdersService
  let approvalsService: ApprovalsService
  let location: LocationFixture
  let product: ProductFixture
  // Set by any test that needs KDS routing (send()/sendCourse() create
  // kitchen_ticket_items referencing this station). Cleaned up in afterEach
  // AFTER deleteOrgOrderData, since kitchen_ticket_items.station_id is
  // onDelete:'restrict' — deleting the station first would fail with a
  // dangling-reference error.
  let stationToClean: KdsStationFixture | undefined

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    ordersService = moduleRef.get(OrdersService)
    approvalsService = moduleRef.get(ApprovalsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    product = await createProductFixture(location, { priceAmount: 500 })
    stationToClean = undefined
  })

  afterEach(async () => {
    await deleteOrgOrderData(location.organizationId)
    if (stationToClean) await deleteKdsStationFixture(stationToClean)
    await deleteProductFixture(product)
    await deleteLocationFixture(location)
  })

  describe('create', () => {
    it('opens a pos-channel order directly into "open" status', async () => {
      const order = await ordersService.create(testActorContext(location), {
        locationId: location.locationId,
        channel: 'pos',
        currency: 'KES',
      })
      expect(order.status).toBe('open')
      expect(order.subtotalAmount).toBe(0)
    })
  })

  describe('addItem', () => {
    it('computes totalAmount as unitPrice * quantity, with no modifiers', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId, quantity: 3 })

      expect(item.unitPriceAmount).toBe(500)
      expect(item.totalAmount).toBe(1500)

      const refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.subtotalAmount).toBe(1500)
      expect(refreshed.totalAmount).toBe(1500)
    })

    it('rejects adding an unavailable product', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const unavailable = await createProductFixture(location, { isAvailable: false })

      await expect(ordersService.addItem(authContext, order.id, { productId: unavailable.productId })).rejects.toMatchObject({
        response: { code: 'product_unavailable' },
      })
      await deleteProductFixture(unavailable)
    })

    it('requires an explicit billId once the order already has an active bill', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 2 })

      await expect(ordersService.addItem(authContext, order.id, { productId: product.productId })).rejects.toMatchObject({
        response: { code: 'bill_assignment_required' },
      })
    })
  })

  describe('updateItem (field edits)', () => {
    it('recomputes totalAmount when quantity changes while the item is still draft', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId, quantity: 1 })

      const updated = await ordersService.updateItem(authContext, order.id, item.id, { quantity: 4 })
      expect(updated.totalAmount).toBe(2000)
    })

    it('rejects changing quantity once the item has been sent to the kitchen', async () => {
      const authContext = testActorContext(location)
      stationToClean = await createKdsStationFixture(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.send(authContext, order.id, {})

      await expect(ordersService.updateItem(authContext, order.id, item.id, { quantity: 2 })).rejects.toMatchObject({
        response: { code: 'item_already_sent' },
      })
    })
  })

  describe('send', () => {
    it('fires every draft item and transitions the order to sent_to_kitchen', async () => {
      stationToClean = await createKdsStationFixture(location)
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })

      const result = await ordersService.send(authContext, order.id, {})
      expect(result.status).toBe('sent_to_kitchen')

      const full = await ordersService.getById(authContext, order.id)
      expect(full.items.every((item) => item.status === 'sent')).toBe(true)
    })

    it('rejects sending when there are no draft items', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })

      await expect(ordersService.send(authContext, order.id, {})).rejects.toMatchObject({ response: { code: 'no_draft_items' } })
    })
  })

  describe('applyDiscount', () => {
    it("an actor with orders:discount_small applies a small discount directly, no approval needed", async () => {
      const authContext = testActorContext(location) // 'user' actor -> owner permission set
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId, quantity: 2 }) // 1000 subtotal

      const result = await ordersService.applyDiscount(authContext, order.id, { discountType: 'percentage', discountValue: 5 })
      expect('amountApplied' in result && result.amountApplied).toBe(50) // 5% of 1000

      const refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.discountAmount).toBe(50)
      expect(refreshed.totalAmount).toBe(950)
    })

    it('an actor lacking orders:discount_small outright is forbidden, regardless of size', async () => {
      const waiter = await createStaffFixture(location, 'waiter')
      const authContext = staffActorContext(location, waiter)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })

      await expect(
        ordersService.applyDiscount(authContext, order.id, { discountType: 'percentage', discountValue: 1 }),
      ).rejects.toMatchObject({ response: { code: 'permission_denied' } })
      await deleteStaffFixture(waiter)
    })

    it('a discount above the configured threshold requires manager approval, then applies once approved+consumed', async () => {
      // supervisor has orders:discount_small but not orders:discount_large.
      const supervisor = await createStaffFixture(location, 'supervisor')
      const manager = await createStaffFixture(location, 'branch_manager')
      const requesterContext = staffActorContext(location, supervisor)

      const order = await ordersService.create(requesterContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(requesterContext, order.id, { productId: product.productId, quantity: 2 }) // 1000 subtotal

      // Default threshold is 15% — a 50% discount is well above it.
      const approvalRequestId = await expectApprovalRequired(
        ordersService.applyDiscount(requesterContext, order.id, { discountType: 'percentage', discountValue: 50 }),
      )

      await withTenantContext(pool, location.organizationId, (db: Db) =>
        approvalsService.approve(db, { id: approvalRequestId, organizationId: location.organizationId, approverActorId: manager.staffId }),
      )

      const result = await ordersService.applyDiscount(
        requesterContext,
        order.id,
        { discountType: 'percentage', discountValue: 50 },
        approvalRequestId,
      )
      expect('amountApplied' in result && result.amountApplied).toBe(500)

      await deleteStaffFixture(supervisor)
      await deleteStaffFixture(manager)
    })
  })

  describe('voidOrder', () => {
    it('voids every non-voided item and moves the order to voided', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })

      const voided = await ordersService.voidOrder(authContext, order.id, { reason: 'customer left' })
      expect(voided.status).toBe('voided')

      const full = await ordersService.getById(authContext, order.id)
      expect(full.items.every((item) => item.status === 'voided')).toBe(true)
    })

    it('rejects voiding an order that is already voided', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.voidOrder(authContext, order.id, { reason: 'first void' })

      await expect(ordersService.voidOrder(authContext, order.id, { reason: 'second void' })).rejects.toMatchObject({
        response: { code: 'order_not_voidable' },
      })
    })
  })

  describe('split', () => {
    it('method=evenly divides the order into N bills whose totals sum back to the order subtotal, and advances a sent order to bill_requested', async () => {
      stationToClean = await createKdsStationFixture(location)
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId, quantity: 3 }) // 1500
      await ordersService.send(authContext, order.id, {})

      const createdBills = await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 3 })
      expect(createdBills).toHaveLength(3)
      expect(createdBills.reduce((sum, bill) => sum + bill.totalAmount, 0)).toBe(1500)

      const refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.status).toBe('bill_requested')
    })

    it("splitting an order that was never sent to the kitchen creates bills but leaves order status at 'open' (bill_requested is only reachable from a sent-to-kitchen-or-later status)", async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })

      const createdBills = await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 1 })
      expect(createdBills).toHaveLength(1)

      const refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.status).toBe('open')
    })

    it('rejects splitting an order that already has active bills', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 2 })

      await expect(ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 2 })).rejects.toMatchObject({
        response: { code: 'already_split' },
      })
    })
  })

  describe('close', () => {
    it('rejects closing while any split bill remains unpaid', async () => {
      stationToClean = await createKdsStationFixture(location)
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.send(authContext, order.id, {})
      await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 1 })

      await expect(ordersService.close(authContext, order.id)).rejects.toMatchObject({ response: { code: 'bills_not_paid' } })
    })

    it('closes the order once every bill is marked paid, releasing straight to "paid"', async () => {
      stationToClean = await createKdsStationFixture(location)
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.send(authContext, order.id, {})
      const [bill] = await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 1 })

      await systemDb.update(bills).set({ status: 'paid' }).where(eq(bills.id, bill!.id))

      const closed = await ordersService.close(authContext, order.id)
      expect(closed.status).toBe('paid')
      expect(closed.closedAt).not.toBeNull()
    })
  })

  describe('updateItem (void/comp path)', () => {
    it("a waiter can void their own item pre-send (draft), no approval needed", async () => {
      const waiter = await createStaffFixture(location, 'waiter')
      const authContext = staffActorContext(location, waiter)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId })

      const result = await ordersService.updateItem(authContext, order.id, item.id, { status: 'voided', reason: 'wrong item' })
      expect('status' in result && result.status).toBe('voided')
      await deleteStaffFixture(waiter)
    })

    it('voiding requires a reason', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId })

      await expect(ordersService.updateItem(authContext, order.id, item.id, { status: 'voided' })).rejects.toMatchObject({
        response: { code: 'reason_required' },
      })
    })

    it('a waiter voiding an item after it has been sent to the kitchen gets a pending approval, not an immediate void', async () => {
      stationToClean = await createKdsStationFixture(location)
      const waiter = await createStaffFixture(location, 'waiter')
      const authContext = staffActorContext(location, waiter)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.send(authContext, order.id, {})

      const approvalRequestId = await expectApprovalRequired(
        ordersService.updateItem(authContext, order.id, item.id, { status: 'voided', reason: 'kitchen mistake' }),
      )
      expect(approvalRequestId).toBeTruthy()

      await deleteStaffFixture(waiter)
    })

    it('comping always requires manager tier or a consumed approval, even for a draft item', async () => {
      const waiter = await createStaffFixture(location, 'waiter')
      const authContext = staffActorContext(location, waiter)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId })

      const approvalRequestId = await expectApprovalRequired(
        ordersService.updateItem(authContext, order.id, item.id, { status: 'comped', reason: 'kitchen mistake' }),
      )
      expect(approvalRequestId).toBeTruthy()

      await deleteStaffFixture(waiter)
    })

    it('a manager can comp an item directly, zeroing its net value via a full discount', async () => {
      const manager = await createStaffFixture(location, 'branch_manager')
      const authContext = staffActorContext(location, manager)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const item = await ordersService.addItem(authContext, order.id, { productId: product.productId, quantity: 2 })

      const result = await ordersService.updateItem(authContext, order.id, item.id, { status: 'comped', reason: 'birthday' })
      expect('status' in result && result.status).toBe('comped')
      expect('discountAmount' in result && result.discountAmount).toBe(item.totalAmount)

      const refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.totalAmount).toBe(0)

      await deleteStaffFixture(manager)
    })
  })
})
