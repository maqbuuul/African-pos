import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { kitchenTicketItems } from '@hospitality-os/database'

import { AppModule } from '../../app.module.js'
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
import { KdsService } from './kds.service.js'
import { OrdersService } from '../orders/orders.service.js'

describe('KdsService (integration)', () => {
  let moduleRef: TestingModule
  let kdsService: KdsService
  let ordersService: OrdersService
  let location: LocationFixture
  let product: ProductFixture
  let station: KdsStationFixture
  // Extra products a test creates beyond the shared `product` fixture, e.g.
  // for a multi-item ticket. Cleaned up after deleteOrgOrderData so the
  // order_items rows referencing them are already gone (products.id is
  // onDelete:'restrict' from order_items).
  let extraProducts: ProductFixture[] = []

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    kdsService = moduleRef.get(KdsService)
    ordersService = moduleRef.get(OrdersService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    product = await createProductFixture(location, { priceAmount: 500 })
    station = await createKdsStationFixture(location, 'kitchen')
    extraProducts = []
  })

  afterEach(async () => {
    await deleteOrgOrderData(location.organizationId)
    for (const extra of extraProducts) await deleteProductFixture(extra)
    await deleteKdsStationFixture(station)
    await deleteProductFixture(product)
    await deleteLocationFixture(location)
  })

  async function fireOneItem(authContext = testActorContext(location)) {
    const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
    const item = await ordersService.addItem(authContext, order.id, { productId: product.productId })
    await ordersService.send(authContext, order.id, {})
    const queue = await kdsService.listStationTickets(authContext, station.stationId)
    const ticketItem = queue.tickets[0]!.items[0]!
    return { authContext, order, item, ticketItemId: ticketItem.id, ticketId: queue.tickets[0]!.id }
  }

  describe('createTicketsForSentItems (via OrdersService.send)', () => {
    it('lands a fired item on the correct station queue as "queued"', async () => {
      const { ticketItemId } = await fireOneItem()
      const authContext = testActorContext(location)
      const queue = await kdsService.listStationTickets(authContext, station.stationId)
      expect(queue.tickets).toHaveLength(1)
      expect(queue.tickets[0]!.items[0]!.id).toBe(ticketItemId)
      expect(queue.tickets[0]!.items[0]!.status).toBe('queued')
    })
  })

  describe('ticket item lifecycle: accept -> start -> bump', () => {
    it('walks a ticket item through the full lifecycle, syncing order_item status at each step', async () => {
      const { authContext, ticketItemId, order, item } = await fireOneItem()

      const accepted = await kdsService.acceptTicketItem(authContext, ticketItemId)
      expect(accepted.status).toBe('accepted')
      let refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.items.find((i) => i.id === item.id)?.status).toBe('accepted')

      const started = await kdsService.startTicketItem(authContext, ticketItemId)
      expect(started.status).toBe('in_progress')
      refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.items.find((i) => i.id === item.id)?.status).toBe('in_progress')

      const bumped = await kdsService.bumpTicketItem(authContext, ticketItemId)
      expect(bumped.status).toBe('ready')
      refreshed = await ordersService.getById(authContext, order.id)
      expect(refreshed.items.find((i) => i.id === item.id)?.status).toBe('ready')
      expect(refreshed.status).toBe('ready') // recomputeReadinessAndTotals rolls the order up too
    })

    it('rejects skipping straight from queued to ready without going through accepted/in_progress first (illegal transition on the order_item side is not the gate — KDS_TICKET_ITEM_STATUS_TRANSITIONS allows queued->ready directly)', async () => {
      // KDS_TICKET_ITEM_STATUS_TRANSITIONS.queued legally allows 'ready' directly
      // (a single-step bump, e.g. a drink poured immediately) — verify that
      // works, then verify a genuinely illegal one (ready -> accepted) is rejected.
      const { authContext, ticketItemId } = await fireOneItem()
      const bumped = await kdsService.bumpTicketItem(authContext, ticketItemId)
      expect(bumped.status).toBe('ready')

      await expect(kdsService.acceptTicketItem(authContext, ticketItemId)).rejects.toMatchObject({
        response: { code: 'illegal_kitchen_ticket_item_transition' },
      })
    })
  })

  describe('station-scoped bump/recall permissions', () => {
    it('kds:bump_own_station only works when the station is unassigned or assigned to that chef', async () => {
      const chefA = await createStaffFixture(location, 'chef', { name: 'Chef A' })
      const chefB = await createStaffFixture(location, 'chef', { name: 'Chef B' })
      await kdsService.updateStation(testActorContext(location), station.stationId, { assignedStaffId: chefA.staffId })

      const { ticketItemId } = await fireOneItem()

      await expect(kdsService.acceptTicketItem(staffActorContext(location, chefB), ticketItemId)).rejects.toMatchObject({
        response: { code: 'permission_denied' },
      })

      const accepted = await kdsService.acceptTicketItem(staffActorContext(location, chefA), ticketItemId)
      expect(accepted.status).toBe('accepted')

      await deleteStaffFixture(chefA)
      await deleteStaffFixture(chefB)
    })

    it('kds:bump_any_station (supervisor) works regardless of station assignment', async () => {
      const chefA = await createStaffFixture(location, 'chef')
      const supervisor = await createStaffFixture(location, 'supervisor')
      await kdsService.updateStation(testActorContext(location), station.stationId, { assignedStaffId: chefA.staffId })

      const { ticketItemId } = await fireOneItem()
      const accepted = await kdsService.acceptTicketItem(staffActorContext(location, supervisor), ticketItemId)
      expect(accepted.status).toBe('accepted')

      await deleteStaffFixture(chefA)
      await deleteStaffFixture(supervisor)
    })
  })

  describe('recallTicketItem', () => {
    it('recalls a just-bumped item back to in_progress within the grace window', async () => {
      const { authContext, ticketItemId } = await fireOneItem()
      await kdsService.bumpTicketItem(authContext, ticketItemId)

      const recalled = await kdsService.recallTicketItem(authContext, ticketItemId)
      expect(recalled.status).toBe('in_progress')
    })

    it('rejects recalling an item that was never bumped (not ready)', async () => {
      const { authContext, ticketItemId } = await fireOneItem()
      await expect(kdsService.recallTicketItem(authContext, ticketItemId)).rejects.toMatchObject({
        response: { code: 'ticket_item_not_ready' },
      })
    })

    it('rejects recalling once the station recall grace window has elapsed', async () => {
      await kdsService.updateStation(testActorContext(location), station.stationId, { recallGraceSeconds: 60 })
      const { authContext, ticketItemId } = await fireOneItem()
      await kdsService.bumpTicketItem(authContext, ticketItemId)

      // Backdate readyAt past the 60s grace window instead of sleeping the
      // test — recallTicketItem computes elapsed time from this column.
      await systemDb
        .update(kitchenTicketItems)
        .set({ readyAt: new Date(Date.now() - 90_000) })
        .where(eq(kitchenTicketItems.id, ticketItemId))

      await expect(kdsService.recallTicketItem(authContext, ticketItemId)).rejects.toMatchObject({
        response: { code: 'recall_window_expired' },
      })
    })
  })

  describe('acknowledgeVoid (via OrdersService.updateItem -> requestVoidForOrderItem)', () => {
    it('a branch_manager voiding a sent item puts the ticket item into void_requested, then kitchen ack finalizes it', async () => {
      const manager = await createStaffFixture(location, 'branch_manager')
      const { ticketItemId, order, item } = await fireOneItem(staffActorContext(location, manager))

      const voidResult = await ordersService.updateItem(staffActorContext(location, manager), order.id, item.id, {
        status: 'voided',
        reason: 'kitchen error',
      })
      expect('status' in voidResult && voidResult.status).toBe('void_requested')

      const queueBefore = await kdsService.listStationTickets(testActorContext(location), station.stationId)
      expect(queueBefore.tickets[0]!.items[0]!.status).toBe('void_requested')

      const acked = await kdsService.acknowledgeVoid(staffActorContext(location, manager), ticketItemId)
      expect(acked.status).toBe('voided')
      expect(acked.orderItemStatus).toBe('voided')

      await deleteStaffFixture(manager)
    })
  })

  describe('bumpTicket (bulk)', () => {
    it('bumps every active item on a ticket in one call', async () => {
      const authContext = testActorContext(location)
      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      const productB = await createProductFixture(location, { priceAmount: 300 })
      extraProducts.push(productB)
      await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.addItem(authContext, order.id, { productId: productB.productId })
      await ordersService.send(authContext, order.id, {})

      const queue = await kdsService.listStationTickets(authContext, station.stationId)
      const ticketId = queue.tickets[0]!.id

      const result = await kdsService.bumpTicket(authContext, ticketId)
      expect(result.readyCount).toBe(2)

      await expect(kdsService.bumpTicket(authContext, ticketId)).rejects.toMatchObject({ response: { code: 'ticket_already_bumped' } })
    })
  })

  describe('station CRUD + permissions', () => {
    it('createStation requires kds:manage_stations', async () => {
      const chef = await createStaffFixture(location, 'chef')
      await expect(
        kdsService.createStation(staffActorContext(location, chef), { locationId: location.locationId, code: 'grill', name: 'Grill' }),
      ).rejects.toMatchObject({ response: { code: 'permission_denied' } })
      await deleteStaffFixture(chef)
    })

    it('deleteStation removes the station; a subsequent get 404s', async () => {
      const authContext = testActorContext(location)
      const created = await kdsService.createStation(authContext, { locationId: location.locationId, code: 'grill', name: 'Grill' })
      await kdsService.deleteStation(authContext, created.id)
      await expect(kdsService.getStationById(authContext, created.id)).rejects.toThrow('KDS station not found')
    })
  })

  describe('bar station extension', () => {
    let barStation: KdsStationFixture

    beforeEach(async () => {
      const authContext = testActorContext(location)
      const created = await kdsService.createStation(authContext, {
        locationId: location.locationId,
        code: 'bar',
        name: 'Bar',
        stationType: 'bar',
      })
      barStation = { stationId: created.id, code: created.code }
    })

    afterEach(async () => {
      await deleteKdsStationFixture(barStation)
    })

    it('recordPourCost is rejected on a non-bar station (the default kitchen station)', async () => {
      const authContext = testActorContext(location)
      const { ticketItemId } = await fireOneItem(authContext)
      await expect(kdsService.recordPourCost(authContext, ticketItemId, 40, 45)).rejects.toMatchObject({
        response: { code: 'not_a_bar_station' },
      })
    })

    it('getBarTabSummary and batchCloseTabs are gated to bar-type stations', async () => {
      const authContext = testActorContext(location)
      const summary = await kdsService.getBarTabSummary(authContext, barStation.stationId)
      expect(summary.openTabs).toEqual([])

      const closed = await kdsService.batchCloseTabs(authContext, barStation.stationId)
      expect(closed.closed).toBe(0)

      await expect(kdsService.getBarTabSummary(authContext, station.stationId)).rejects.toMatchObject({
        response: { code: 'not_a_bar_station' },
      })
    })
  })

  describe('getCookTimeAnalytics', () => {
    it('reports the configured expectedPrepTimeSeconds as the baseline when no samples exist yet', async () => {
      const authContext = testActorContext(location)
      const analytics = await kdsService.getCookTimeAnalytics(authContext, location.locationId)
      const row = analytics.stations.find((s) => s.stationId === station.stationId)
      expect(row?.averageCompletedSeconds).toBe(900) // default expectedPrepTimeSeconds
      expect(row?.completedTicketItems).toBe(0)
    })
  })

  describe('rush/VIP flagging', () => {
    it('flagRushOrder and flagVipOrder set their respective boolean on every ticket for the order', async () => {
      const authContext = testActorContext(location)
      const { order } = await fireOneItem(authContext)

      const rushTickets = await kdsService.flagRushOrder(authContext, order.id)
      expect(rushTickets.every((t) => t.isRush)).toBe(true)

      const vipTickets = await kdsService.flagVipOrder(authContext, order.id)
      expect(vipTickets.every((t) => t.isVip)).toBe(true)
    })
  })
})
