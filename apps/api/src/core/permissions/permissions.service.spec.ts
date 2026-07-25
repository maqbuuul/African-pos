import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createLocationFixture,
  createStaffFixture,
  deleteLocationFixture,
  deleteStaffFixture,
  testActorContext,
  type LocationFixture,
  type StaffFixture,
} from '../../test/fixtures.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import { ApprovalsService } from './approvals.service.js'
import { PermissionsService } from './permissions.service.js'

describe('PermissionsService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let permissionsService: PermissionsService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    permissionsService = moduleRef.get(PermissionsService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(location)
  })

  it("a 'user' actor gets the global owner role's full permission set regardless of actorId", async () => {
    const granted = await withTenantContext(pool, location.organizationId, (db: Db) =>
      permissionsService.listGrantedPermissions(db, testActorContext(location)),
    )
    expect(granted).toContain('payments:refund')
    expect(granted).toContain('orders:create')
    expect(granted.length).toBeGreaterThan(10)
  })

  it("a 'staff' actor only gets permissions from roles actually granted via staff_roles", async () => {
    const chef = await createStaffFixture(location, 'chef')
    const granted = await withTenantContext(pool, location.organizationId, (db: Db) =>
      permissionsService.listGrantedPermissions(db, {
        actorType: 'staff',
        actorId: chef.staffId,
        organizationId: location.organizationId,
        locationId: location.locationId,
      }),
    )
    expect(granted).toContain('kds:bump_own_station')
    expect(granted).not.toContain('payments:refund')
    await deleteStaffFixture(chef)
  })

  it('a staff actor with no role grant at all gets an empty permission set, not an error', async () => {
    const granted = await withTenantContext(pool, location.organizationId, (db: Db) =>
      permissionsService.listGrantedPermissions(db, {
        actorType: 'staff',
        actorId: randomUUID(),
        organizationId: location.organizationId,
        locationId: location.locationId,
      }),
    )
    expect(granted).toEqual([])
  })

  it('two roles granting the same permission de-duplicate rather than double-counting', async () => {
    const cashier = await createStaffFixture(location, 'cashier')
    const granted = await withTenantContext(pool, location.organizationId, (db: Db) =>
      permissionsService.listGrantedPermissions(db, {
        actorType: 'staff',
        actorId: cashier.staffId,
        organizationId: location.organizationId,
        locationId: location.locationId,
      }),
    )
    expect(new Set(granted).size).toBe(granted.length)
    await deleteStaffFixture(cashier)
  })
})

describe('ApprovalsService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let approvalsService: ApprovalsService
  let location: LocationFixture
  let requester: StaffFixture
  let manager: StaffFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    approvalsService = moduleRef.get(ApprovalsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    requester = await createStaffFixture(location, 'waiter')
    manager = await createStaffFixture(location, 'branch_manager')
  })

  afterEach(async () => {
    await deleteStaffFixture(requester)
    await deleteStaffFixture(manager)
    await deleteLocationFixture(location)
  })

  it('a pending request can be approved by a different actor, then consumed exactly once', async () => {
    const approval = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.create(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        requestedByActorId: requester.staffId,
        action: 'orders:apply_large_discount',
      }),
    )
    expect(approval.status).toBe('pending')

    const approved = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.approve(db, {
        id: approval.id,
        organizationId: location.organizationId,
        approverActorId: manager.staffId,
      }),
    )
    expect(approved.status).toBe('approved')

    const consumedFirst = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.tryConsume(db, {
        id: approval.id,
        organizationId: location.organizationId,
        requestedByActorId: requester.staffId,
        action: 'orders:apply_large_discount',
      }),
    )
    expect(consumedFirst).not.toBeNull()

    // Same approval, retried — must not be spendable twice (PermissionsGuard's
    // "one approval, one retry" invariant).
    const consumedSecond = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.tryConsume(db, {
        id: approval.id,
        organizationId: location.organizationId,
        requestedByActorId: requester.staffId,
        action: 'orders:apply_large_discount',
      }),
    )
    expect(consumedSecond).toBeNull()
  })

  it('a requester cannot approve their own request', async () => {
    const approval = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.create(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        requestedByActorId: requester.staffId,
        action: 'orders:apply_large_discount',
      }),
    )

    await expect(
      withTenantContext(pool, location.organizationId, (db: Db) =>
        approvalsService.approve(db, {
          id: approval.id,
          organizationId: location.organizationId,
          approverActorId: requester.staffId,
        }),
      ),
    ).rejects.toThrow('cannot resolve your own approval request')
  })

  it('an already-resolved request cannot be resolved a second time', async () => {
    const approval = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.create(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        requestedByActorId: requester.staffId,
        action: 'orders:apply_large_discount',
      }),
    )
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.reject(db, {
        id: approval.id,
        organizationId: location.organizationId,
        approverActorId: manager.staffId,
      }),
    )

    await expect(
      withTenantContext(pool, location.organizationId, (db: Db) =>
        approvalsService.approve(db, {
          id: approval.id,
          organizationId: location.organizationId,
          approverActorId: manager.staffId,
        }),
      ),
    ).rejects.toThrow('approval request is already rejected')
  })

  it('tryConsume never matches a different action than the one it was approved for', async () => {
    const approval = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.create(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        requestedByActorId: requester.staffId,
        action: 'orders:apply_large_discount',
      }),
    )
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.approve(db, {
        id: approval.id,
        organizationId: location.organizationId,
        approverActorId: manager.staffId,
      }),
    )

    const consumed = await withTenantContext(pool, location.organizationId, (db: Db) =>
      approvalsService.tryConsume(db, {
        id: approval.id,
        organizationId: location.organizationId,
        requestedByActorId: requester.staffId,
        action: 'payments:refund',
      }),
    )
    expect(consumed).toBeNull()
  })
})
