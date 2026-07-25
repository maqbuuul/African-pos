import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createFloorPlanFixture,
  createLocationFixture,
  createStaffFixture,
  createTableFixture,
  deleteFloorPlanFixture,
  deleteLocationFixture,
  deleteStaffFixture,
  deleteTableFixture,
  staffActorContext,
  testActorContext,
  type FloorPlanFixture,
  type LocationFixture,
  type TableFixture,
} from '../../test/fixtures.js'
import { TablesService } from './tables.service.js'

describe('TablesService (integration)', () => {
  let moduleRef: TestingModule
  let tablesService: TablesService
  let location: LocationFixture
  let plan: FloorPlanFixture
  let table: TableFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    tablesService = moduleRef.get(TablesService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    plan = await createFloorPlanFixture(location)
    table = await createTableFixture(location, { floorPlanId: plan.floorPlanId, capacity: 4 })
  })

  afterEach(async () => {
    await deleteTableFixture(table)
    await deleteFloorPlanFixture(plan).catch(() => {})
    await deleteLocationFixture(location)
  })

  describe('setStatus (table state machine)', () => {
    it('walks the full happy-path service loop: available -> seated -> ordered -> food_ready -> eating -> bill_requested -> payment_pending -> paid -> cleaning -> available', async () => {
      const authContext = testActorContext(location)
      const path: { status: string; partySize?: number }[] = [
        { status: 'seated', partySize: 2 },
        { status: 'ordered' },
        { status: 'food_ready' },
        { status: 'eating' },
        { status: 'bill_requested' },
        { status: 'payment_pending' },
        { status: 'paid' },
        { status: 'cleaning' },
        { status: 'available' },
      ]
      for (const step of path) {
        const result = await tablesService.setStatus(authContext, table.tableId, step)
        expect(result.status).toBe(step.status)
      }
    })

    it('rejects an illegal transition (available straight to eating)', async () => {
      const authContext = testActorContext(location)
      await expect(tablesService.setStatus(authContext, table.tableId, { status: 'eating' })).rejects.toMatchObject({
        response: { code: 'illegal_table_transition' },
      })
    })

    it('requires partySize when seating a table', async () => {
      const authContext = testActorContext(location)
      await expect(tablesService.setStatus(authContext, table.tableId, { status: 'seated' })).rejects.toMatchObject({
        response: { code: 'party_size_required' },
      })
    })

    it('flags overCapacity when the party exceeds capacity, without blocking the seat (soft warning, PRD 04)', async () => {
      const authContext = testActorContext(location)
      const result = await tablesService.setStatus(authContext, table.tableId, { status: 'seated', partySize: 10 })
      expect(result.overCapacity).toBe(true)
      expect(result.status).toBe('seated')
    })

    it('reopening bill_requested -> eating requires a reason', async () => {
      const authContext = testActorContext(location)
      await tablesService.setStatus(authContext, table.tableId, { status: 'seated', partySize: 2 })
      await tablesService.setStatus(authContext, table.tableId, { status: 'ordered' })
      await tablesService.setStatus(authContext, table.tableId, { status: 'food_ready' })
      await tablesService.setStatus(authContext, table.tableId, { status: 'eating' })
      await tablesService.setStatus(authContext, table.tableId, { status: 'bill_requested' })

      await expect(tablesService.setStatus(authContext, table.tableId, { status: 'eating' })).rejects.toMatchObject({
        response: { code: 'reopen_reason_required' },
      })

      const reopened = await tablesService.setStatus(authContext, table.tableId, { status: 'eating', reason: 'guest wants dessert' })
      expect(reopened.status).toBe('eating')
    })

    it('seating a table with no assigned server auto-claims it for the staff member who seats it', async () => {
      const waiter = await createStaffFixture(location, 'waiter')
      const authContext = staffActorContext(location, waiter)
      const result = await tablesService.setStatus(authContext, table.tableId, { status: 'seated', partySize: 2 })
      expect(result.assignedStaffId).toBe(waiter.staffId)
      await deleteStaffFixture(waiter)
    })

    it('a waiter cannot change status on a table assigned to a different waiter without tables:manage_any_section', async () => {
      const waiterA = await createStaffFixture(location, 'waiter', { name: 'Waiter A' })
      const waiterB = await createStaffFixture(location, 'waiter', { name: 'Waiter B' })
      await tablesService.setStatus(staffActorContext(location, waiterA), table.tableId, { status: 'seated', partySize: 2 })

      await expect(
        tablesService.setStatus(staffActorContext(location, waiterB), table.tableId, { status: 'ordered' }),
      ).rejects.toMatchObject({ response: { code: 'permission_denied' } })

      const supervisor = await createStaffFixture(location, 'supervisor')
      const bySupervisor = await tablesService.setStatus(staffActorContext(location, supervisor), table.tableId, { status: 'ordered' })
      expect(bySupervisor.status).toBe('ordered')

      await deleteStaffFixture(waiterA)
      await deleteStaffFixture(waiterB)
      await deleteStaffFixture(supervisor)
    })

    it('blocking a table requires tables:block, independent of section ownership', async () => {
      const waiter = await createStaffFixture(location, 'waiter')
      await expect(
        tablesService.setStatus(staffActorContext(location, waiter), table.tableId, { status: 'blocked' }),
      ).rejects.toMatchObject({ response: { code: 'permission_denied' } })

      const manager = await createStaffFixture(location, 'branch_manager')
      const blocked = await tablesService.setStatus(staffActorContext(location, manager), table.tableId, { status: 'blocked' })
      expect(blocked.status).toBe('blocked')

      await deleteStaffFixture(waiter)
      await deleteStaffFixture(manager)
    })
  })

  describe('merge / unmerge', () => {
    it('merges two tables, then unmerge ends the active merge', async () => {
      const authContext = testActorContext(location)
      const second = await createTableFixture(location, { floorPlanId: plan.floorPlanId, label: 'T2' })

      const merge = await tablesService.merge(authContext, { primaryTableId: table.tableId, mergedTableId: second.tableId })
      expect(merge.unmergedAt).toBeNull()

      const unmerged = await tablesService.unmerge(authContext, second.tableId)
      expect(unmerged.unmergedAt).not.toBeNull()

      await deleteTableFixture(second)
    })

    it('rejects merging a table into itself', async () => {
      const authContext = testActorContext(location)
      await expect(
        tablesService.merge(authContext, { primaryTableId: table.tableId, mergedTableId: table.tableId }),
      ).rejects.toMatchObject({ response: { code: 'cannot_merge_table_into_itself' } })
    })

    it('rejects merging a table that is already part of an active merge', async () => {
      const authContext = testActorContext(location)
      const second = await createTableFixture(location, { floorPlanId: plan.floorPlanId, label: 'T2' })
      const third = await createTableFixture(location, { floorPlanId: plan.floorPlanId, label: 'T3' })
      await tablesService.merge(authContext, { primaryTableId: table.tableId, mergedTableId: second.tableId })

      await expect(
        tablesService.merge(authContext, { primaryTableId: third.tableId, mergedTableId: second.tableId }),
      ).rejects.toMatchObject({ response: { code: 'table_already_merged' } })

      await deleteTableFixture(second)
      await deleteTableFixture(third)
    })
  })

  describe('transfer', () => {
    it('reassigns an unassigned table freely', async () => {
      const authContext = testActorContext(location)
      const waiter = await createStaffFixture(location, 'waiter')
      const result = await tablesService.transfer(authContext, table.tableId, { toStaffId: waiter.staffId })
      expect(result.assignedStaffId).toBe(waiter.staffId)
      await deleteStaffFixture(waiter)
    })

    it('a self-initiated handoff (the currently-assigned waiter reassigns away) needs no extra permission', async () => {
      const waiterA = await createStaffFixture(location, 'waiter', { name: 'Waiter A' })
      const waiterB = await createStaffFixture(location, 'waiter', { name: 'Waiter B' })
      const authContextA = staffActorContext(location, waiterA)
      await tablesService.transfer(authContextA, table.tableId, { toStaffId: waiterA.staffId })

      const result = await tablesService.transfer(authContextA, table.tableId, { toStaffId: waiterB.staffId })
      expect(result.assignedStaffId).toBe(waiterB.staffId)

      await deleteStaffFixture(waiterA)
      await deleteStaffFixture(waiterB)
    })

    it('a third party reassigning a table already assigned to someone else requires tables:manage_any_section', async () => {
      const waiterA = await createStaffFixture(location, 'waiter', { name: 'Waiter A' })
      const waiterB = await createStaffFixture(location, 'waiter', { name: 'Waiter B' })
      await tablesService.transfer(staffActorContext(location, waiterA), table.tableId, { toStaffId: waiterA.staffId })

      // waiterB is neither the currently-assigned staff nor waiterA — a
      // third party attempting the reassignment.
      await expect(
        tablesService.transfer(staffActorContext(location, waiterB), table.tableId, { toStaffId: waiterB.staffId }),
      ).rejects.toMatchObject({ response: { code: 'permission_denied' } })

      const manager = await createStaffFixture(location, 'branch_manager')
      const result = await tablesService.transfer(staffActorContext(location, manager), table.tableId, { toStaffId: waiterB.staffId })
      expect(result.assignedStaffId).toBe(waiterB.staffId)

      await deleteStaffFixture(waiterA)
      await deleteStaffFixture(waiterB)
      await deleteStaffFixture(manager)
    })
  })

  describe('utilizationReport', () => {
    it('breaks down table counts by status', async () => {
      const authContext = testActorContext(location)
      const report = await tablesService.utilizationReport(authContext, location.locationId)
      expect(report.statusBreakdown.some((row) => row.status === 'available')).toBe(true)
    })
  })
})
