import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { staffNotifications } from '@hospitality-os/database'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createKdsStationFixture,
  createLocationFixture,
  createProductFixture,
  createStaffFixture,
  createTableFixture,
  deleteKdsStationFixture,
  deleteLocationFixture,
  deleteOrgCrmData,
  deleteOrgOrderData,
  deleteProductFixture,
  deleteStaffFixture,
  deleteTableFixture,
  staffActorContext,
  systemDb,
  type KdsStationFixture,
  type LocationFixture,
  type ProductFixture,
  type TableFixture,
} from '../../test/fixtures.js'
import { TablesService } from '../restaurant/tables.service.js'
import type { TableSessionClaims } from './table-session.js'
import { QrOrderService } from './qr-order.service.js'

describe('QrOrderService (integration)', () => {
  let moduleRef: TestingModule
  let qrOrderService: QrOrderService
  let tablesService: TablesService
  let location: LocationFixture
  let product: ProductFixture
  let table: TableFixture
  let station: KdsStationFixture
  let session: TableSessionClaims

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    qrOrderService = moduleRef.get(QrOrderService)
    tablesService = moduleRef.get(TablesService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    product = await createProductFixture(location, { priceAmount: 800 })
    station = await createKdsStationFixture(location)
    const qrSlug = `qr-${randomUUID().slice(0, 8)}`
    table = await createTableFixture(location, { qrSlug })
    session = { organizationId: location.organizationId, locationId: location.locationId, tableId: table.tableId, qrSlug }
  })

  afterEach(async () => {
    await deleteOrgCrmData(location.organizationId)
    await deleteOrgOrderData(location.organizationId)
    // staff_notifications.table_id is onDelete restrict — requestWaiter
    // writes rows here that must clear before the table itself can go.
    await systemDb.delete(staffNotifications).where(eq(staffNotifications.organizationId, location.organizationId))
    await deleteKdsStationFixture(station)
    await deleteTableFixture(table)
    await deleteProductFixture(product)
    await deleteLocationFixture(location)
  })

  describe('createSession', () => {
    it('issues a signed session token for a table found by its QR slug', async () => {
      const result = await qrOrderService.createSession(session.qrSlug)
      expect(result.token).toBeTruthy()
      expect(result.table.id).toBe(table.tableId)
    })

    it('rejects an unknown QR slug', async () => {
      await expect(qrOrderService.createSession('does-not-exist')).rejects.toThrow('table not found')
    })

    it('rejects a table that is currently blocked', async () => {
      const manager = await createStaffFixture(location, 'branch_manager')
      await tablesService.setStatus(staffActorContext(location, manager), table.tableId, { status: 'blocked' })

      await expect(qrOrderService.createSession(session.qrSlug)).rejects.toMatchObject({
        response: { code: 'table_unavailable' },
      })

      await deleteStaffFixture(manager)
    })
  })

  describe('getMenu', () => {
    it('returns only active, available products for the session location', async () => {
      const menu = await qrOrderService.getMenu(session)
      expect(menu.products.some((p) => p.id === product.productId)).toBe(true)
    })
  })

  describe('full customer ordering journey', () => {
    it('submits a draft order, fires a course, requests the bill, and the resulting bill total matches the order', async () => {
      const submitted = await qrOrderService.submitOrder(session, [{ productId: product.productId, quantity: 2, sessionLabel: 'mains' }])
      expect(submitted.order.status).toBe('draft')
      expect(submitted.order.totalAmount).toBe(1600) // 800 * 2, computed immediately (cart view)

      const fired = await qrOrderService.fireCourse(session, submitted.order.id, 'mains')
      expect(fired.firedItemIds).toHaveLength(1)

      await qrOrderService.requestBill(session, submitted.order.id)
      const status = await qrOrderService.getOrderStatus(session, submitted.order.id)
      expect(status.bills).toHaveLength(1)
      expect(status.bills[0]?.totalAmount).toBe(1600)
      expect(status.order.status).toBe('bill_requested')
    })

    it('rejects submitting an empty order', async () => {
      await expect(qrOrderService.submitOrder(session, [])).rejects.toThrow('at least one item')
    })

    it('payMpesa rejects when no bill has been requested yet', async () => {
      const submitted = await qrOrderService.submitOrder(session, [{ productId: product.productId, quantity: 1 }])
      await expect(qrOrderService.payMpesa(session, submitted.order.id, '254712345678', randomUUID())).rejects.toThrow(
        'request the bill first',
      )
    })

    it('payMpesa gets past the outstanding-balance guard once a bill exists, stopping only at the unconfigured-integration boundary', async () => {
      const submitted = await qrOrderService.submitOrder(session, [{ productId: product.productId, quantity: 1, sessionLabel: 'mains' }])
      // requestBill only accepts an order already past 'draft' (sent to the
      // kitchen or later) — fire the course first, matching the real flow.
      await qrOrderService.fireCourse(session, submitted.order.id, 'mains')
      await qrOrderService.requestBill(session, submitted.order.id)

      // No M-Pesa integration is connected for this fresh test org — the
      // real failure boundary is "integration not configured", not the
      // amount/balance guard this test is actually exercising.
      await expect(qrOrderService.payMpesa(session, submitted.order.id, '254712345678', randomUUID())).rejects.toMatchObject({
        response: { code: 'integration_not_configured' },
      })
    })

    it('payWithWaiter marks the order for counter payment', async () => {
      const submitted = await qrOrderService.submitOrder(session, [{ productId: product.productId, quantity: 1, sessionLabel: 'mains' }])
      await qrOrderService.fireCourse(session, submitted.order.id, 'mains')
      await qrOrderService.requestBill(session, submitted.order.id)

      await qrOrderService.payWithWaiter(session, submitted.order.id)
      const status = await qrOrderService.getOrderStatus(session, submitted.order.id)
      expect(status.order.status).toBe('payment_pending')
    })
  })

  describe('requestWaiter', () => {
    it('creates a pending staff notification', async () => {
      const result = await qrOrderService.requestWaiter(session, 'need extra napkins')
      expect(result.notification.status).toBe('pending')
      expect(result.notification.notificationType).toBe('waiter_request')
    })
  })

  describe('feedback', () => {
    it('submitFeedback rejects a rating outside 1-5', async () => {
      const submitted = await qrOrderService.submitOrder(session, [{ productId: product.productId, quantity: 1 }])
      const itemId = (await qrOrderService.getOrder(session, submitted.order.id)).items[0]!.id
      await expect(qrOrderService.submitFeedback(session, itemId, 6)).rejects.toThrow('between 1 and 5')
    })

    it('rateDish records feedback tied to both the item and its order', async () => {
      const submitted = await qrOrderService.submitOrder(session, [{ productId: product.productId, quantity: 1 }])
      const itemId = (await qrOrderService.getOrder(session, submitted.order.id)).items[0]!.id

      const result = await qrOrderService.rateDish(session, itemId, 5, 'delicious')
      expect(result.feedback.rating).toBe(5)
      expect(result.feedback.orderId).toBe(submitted.order.id)
    })
  })

  describe('captureLoyalty', () => {
    it('creates a customer and loyalty account on first capture, reuses both on a repeat capture', async () => {
      const phone = '+254711222333'
      const first = await qrOrderService.captureLoyalty(session, phone)
      expect(first.message).toBe('loyalty account created')

      const second = await qrOrderService.captureLoyalty(session, phone)
      expect(second.message).toBe('loyalty account already exists')
      expect(second.customerId).toBe(first.customerId)
      expect(second.account.id).toBe(first.account.id)
    })
  })
})
