import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createLocationFixture,
  createStaffFixture,
  deleteLocationFixture,
  deleteStaffFixture,
  staffActorContext,
  testActorContext,
  type LocationFixture,
  type StaffFixture,
} from '../../test/fixtures.js'
import { AttendanceService } from './attendance.service.js'
import { StaffService } from './staff.service.js'

describe('StaffService (integration)', () => {
  let moduleRef: TestingModule
  let staffService: StaffService
  let location: LocationFixture
  let member: StaffFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    staffService = moduleRef.get(StaffService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    member = await createStaffFixture(location, 'waiter')
  })

  afterEach(async () => {
    await deleteStaffFixture(member)
    await deleteLocationFixture(location)
  })

  it('deactivate then reactivate round-trips status back to active', async () => {
    const deactivated = await staffService.deactivate(testActorContext(location), member.staffId)
    expect(deactivated.status).toBe('deactivated')

    const reactivated = await staffService.reactivate(testActorContext(location), member.staffId)
    expect(reactivated.status).toBe('active')
  })

  it('rejects deactivating a staff member from a different organization', async () => {
    const otherOrg = await createLocationFixture()
    await expect(staffService.deactivate(testActorContext(otherOrg), member.staffId)).rejects.toThrow('staff member not found')
    await deleteLocationFixture(otherOrg)
  })
})

describe('AttendanceService (integration)', () => {
  let moduleRef: TestingModule
  let attendanceService: AttendanceService
  let location: LocationFixture
  let member: StaffFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    attendanceService = moduleRef.get(AttendanceService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    member = await createStaffFixture(location, 'waiter')
  })

  afterEach(async () => {
    await deleteStaffFixture(member)
    await deleteLocationFixture(location)
  })

  it('clockIn then clockOut records a completed attendance window', async () => {
    const authContext = staffActorContext(location, member)
    const record = await attendanceService.clockIn(authContext, member.staffId, location.locationId)
    expect(record.clockOut).toBeNull()

    const closed = await attendanceService.clockOut(authContext, member.staffId)
    expect(closed.id).toBe(record.id)
    expect(closed.clockOut).not.toBeNull()
    expect(closed.status).toBe('clocked_out')
  })

  it('rejects a second clock-in while one is already open', async () => {
    const authContext = staffActorContext(location, member)
    await attendanceService.clockIn(authContext, member.staffId, location.locationId)

    await expect(attendanceService.clockIn(authContext, member.staffId, location.locationId)).rejects.toThrow(
      'staff member already has an open attendance record',
    )
  })

  it('rejects clocking out when there is no open attendance record', async () => {
    const authContext = staffActorContext(location, member)
    await expect(attendanceService.clockOut(authContext, member.staffId)).rejects.toThrow('no open attendance record found')
  })

  it('findByStaff returns the records for that staff member only', async () => {
    const authContext = staffActorContext(location, member)
    await attendanceService.clockIn(authContext, member.staffId, location.locationId)
    await attendanceService.clockOut(authContext, member.staffId)

    const other = await createStaffFixture(location, 'cashier')
    const otherContext = staffActorContext(location, other)
    await attendanceService.clockIn(otherContext, other.staffId, location.locationId)

    const records = await attendanceService.findByStaff(authContext, member.staffId)
    expect(records).toHaveLength(1)
    expect(records[0]?.staffId).toBe(member.staffId)

    await attendanceService.clockOut(otherContext, other.staffId)
    await deleteStaffFixture(other)
  })
})
