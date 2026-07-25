import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createDeviceFixture,
  createKdsStationFixture,
  createLocationFixture,
  createProductFixture,
  createStaffFixture,
  deleteDeviceFixture,
  deleteKdsStationFixture,
  deleteLocationFixture,
  deleteOrgOrderData,
  deleteOrgShiftData,
  deleteProductFixture,
  deleteStaffFixture,
  staffActorContext,
  type KdsStationFixture,
  type LocationFixture,
  type ProductFixture,
  type StaffFixture,
} from '../../test/fixtures.js'
import { OrdersService } from '../orders/orders.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import { ShiftsService } from './shifts.service.js'

describe('ShiftsService (integration)', () => {
  let moduleRef: TestingModule
  let shiftsService: ShiftsService
  let ordersService: OrdersService
  let paymentsService: PaymentsService
  let location: LocationFixture
  let product: ProductFixture
  let cashier: StaffFixture
  let stationToClean: KdsStationFixture | undefined

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    shiftsService = moduleRef.get(ShiftsService)
    ordersService = moduleRef.get(OrdersService)
    paymentsService = moduleRef.get(PaymentsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    product = await createProductFixture(location, { priceAmount: 1000 })
    cashier = await createStaffFixture(location, 'cashier')
    stationToClean = undefined
  })

  afterEach(async () => {
    await deleteOrgShiftData(location.organizationId)
    await deleteOrgOrderData(location.organizationId)
    if (stationToClean) await deleteKdsStationFixture(stationToClean)
    await deleteStaffFixture(cashier)
    await deleteProductFixture(product)
    await deleteLocationFixture(location)
  })

  describe('open', () => {
    it('creates a shift and its cash drawer session together', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift, session } = await shiftsService.open(authContext, {
        locationId: location.locationId,
        startingCashAmount: 5000,
        currency: 'KES',
      })
      expect(shift.status).toBe('open')
      expect(session.startingAmount).toBe(5000)
      expect(session.shiftId).toBe(shift.id)
    })

    it('rejects opening a second shift on the same device while one is already open', async () => {
      const authContext = staffActorContext(location, cashier)
      const device = await createDeviceFixture(location)
      await shiftsService.open(authContext, { locationId: location.locationId, deviceId: device.deviceId, startingCashAmount: 1000, currency: 'KES' })

      await expect(
        shiftsService.open(authContext, { locationId: location.locationId, deviceId: device.deviceId, startingCashAmount: 1000, currency: 'KES' }),
      ).rejects.toMatchObject({ response: { code: 'shift_already_open' } })

      await deleteDeviceFixture(device)
    })
  })

  describe('close', () => {
    it('rejects closing while a blocking open order exists, unless force=true', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 0, currency: 'KES' })
      await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })

      await expect(shiftsService.close(authContext, shift.id, { countedAmount: 0 })).rejects.toMatchObject({
        response: { code: 'shift_close_blocked' },
      })

      const forced = await shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })
      expect(forced.shift.status).toBe('closed')
    })

    it('computes expectedCash as starting + cash payments, and a zero-variance close needs no reason', async () => {
      stationToClean = await createKdsStationFixture(location)
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 1000, currency: 'KES' })

      const order = await ordersService.create(authContext, { locationId: location.locationId, channel: 'pos', currency: 'KES' })
      await ordersService.addItem(authContext, order.id, { productId: product.productId })
      await ordersService.send(authContext, order.id, {}) // required for the order to be closeable through to 'paid'
      const [bill] = await ordersService.split(authContext, order.id, { method: 'evenly', evenCount: 1 })
      await paymentsService.takeCash(authContext, bill!.id, { amount: 1000, currency: 'KES', idempotencyKey: randomUUID(), amountTendered: 1000 })

      const result = await shiftsService.close(authContext, shift.id, { countedAmount: 2000, force: true }) // 1000 starting + 1000 cash
      expect(result.variance).toBe(0)
      expect(result.shift.closeReport).toMatchObject({ expectedCash: 2000, cashPayments: 1000, startingCash: 1000 })
    })

    it('a variance beyond the threshold requires a reason to close', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 1000, currency: 'KES' })

      // Default threshold is 500 KES — counting 600 short is well beyond it.
      await expect(shiftsService.close(authContext, shift.id, { countedAmount: 400, force: true })).rejects.toMatchObject({
        response: { code: 'variance_requires_reason' },
      })

      const closed = await shiftsService.close(authContext, shift.id, {
        countedAmount: 400,
        varianceReason: 'till was short, investigating',
        force: true,
      })
      expect(closed.variance).toBe(-600)
    })

    it('rejects closing a shift that is not open', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 0, currency: 'KES' })
      await shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })

      await expect(shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })).rejects.toMatchObject({
        response: { code: 'shift_not_open' },
      })
    })
  })

  describe('adjustDrawer', () => {
    it('an "in" adjustment increases expectedCash on close; an "out" adjustment decreases it', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 1000, currency: 'KES' })

      await shiftsService.adjustDrawer(authContext, shift.id, { direction: 'in', amount: 200, currency: 'KES', reason: 'change float top-up' })
      await shiftsService.adjustDrawer(authContext, shift.id, { direction: 'out', amount: 50, currency: 'KES', reason: 'petty cash' })

      const pnl = await shiftsService.getLivePnl(authContext, shift.id)
      expect(pnl.expectedCash).toBe(1150) // 1000 + 200 - 50

      await shiftsService.close(authContext, shift.id, { countedAmount: 1150, force: true })
    })

    it('rejects adjusting a drawer for a shift that is not open', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 0, currency: 'KES' })
      await shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })

      await expect(
        shiftsService.adjustDrawer(authContext, shift.id, { direction: 'in', amount: 100, currency: 'KES', reason: 'late add' }),
      ).rejects.toMatchObject({ response: { code: 'shift_not_open' } })
    })
  })

  describe('reopen', () => {
    it('a manager can reopen a closed shift, clearing the close report', async () => {
      const authContext = staffActorContext(location, cashier)
      const { shift } = await shiftsService.open(authContext, { locationId: location.locationId, startingCashAmount: 0, currency: 'KES' })
      await shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })

      const reopened = await shiftsService.reopen(authContext, shift.id, 'need to add a missed cash sale')
      expect(reopened.status).toBe('open')
      expect(reopened.closeReport).toBeNull()

      await shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })
    })
  })

  describe('getActive', () => {
    it('returns the open shift for a device, and null once closed', async () => {
      const authContext = staffActorContext(location, cashier)
      const device = await createDeviceFixture(location)
      const { shift } = await shiftsService.open(authContext, {
        locationId: location.locationId,
        deviceId: device.deviceId,
        startingCashAmount: 0,
        currency: 'KES',
      })

      const active = await shiftsService.getActive(authContext, location.locationId, device.deviceId)
      expect(active?.shift.id).toBe(shift.id)

      await shiftsService.close(authContext, shift.id, { countedAmount: 0, force: true })
      const afterClose = await shiftsService.getActive(authContext, location.locationId, device.deviceId)
      expect(afterClose).toBeNull()

      await deleteDeviceFixture(device)
    })
  })
})
