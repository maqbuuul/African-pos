import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenantContext, type Db } from '@hospitality-os/database'
import type { SyncEntityType, SyncOperationType } from '@hospitality-os/domain'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import {
  closeFixturePool,
  createLocationFixture,
  deleteLocationFixture,
  deleteOrgSyncData,
  testActorContext,
  type LocationFixture,
} from '../../test/fixtures.js'
import { SyncService } from './sync.service.js'

function makeOp(location: LocationFixture, overrides: Partial<{
  opId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperationType
  payload: Record<string, unknown>
  deviceId: string
  idempotencyKey: string
}> = {}) {
  return {
    opId: overrides.opId ?? randomUUID(),
    organizationId: location.organizationId,
    locationId: location.locationId,
    deviceId: overrides.deviceId ?? randomUUID(),
    actorId: randomUUID(),
    entityType: overrides.entityType ?? 'orders',
    entityId: overrides.entityId ?? randomUUID(),
    operation: overrides.operation ?? 'create',
    payload: overrides.payload ?? {},
    createdAt: new Date().toISOString(),
    ...(overrides.idempotencyKey !== undefined ? { idempotencyKey: overrides.idempotencyKey } : {}),
  }
}

describe('SyncService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let syncService: SyncService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    syncService = moduleRef.get(SyncService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteOrgSyncData(location.organizationId)
    await deleteLocationFixture(location)
  })

  describe('pushOperations', () => {
    it('accepts an order create (server_wins policy)', async () => {
      const authContext = testActorContext(location)
      const op = makeOp(location, { entityType: 'orders', operation: 'create' })

      const result = await syncService.pushOperations(authContext, { operations: [op] })
      expect(result.accepted).toHaveLength(1)
      expect(result.conflicts).toHaveLength(0)
    })

    it('a cash payment (payment_dependent policy) is accepted', async () => {
      const authContext = testActorContext(location)
      const op = makeOp(location, { entityType: 'payments', operation: 'create', payload: { method: 'cash' } })

      const result = await syncService.pushOperations(authContext, { operations: [op] })
      expect(result.accepted).toHaveLength(1)
    })

    it('a non-cash payment (payment_dependent policy) is rejected as a conflict requiring online confirmation', async () => {
      const authContext = testActorContext(location)
      const op = makeOp(location, { entityType: 'payments', operation: 'create', payload: { method: 'mpesa' } })

      const result = await syncService.pushOperations(authContext, { operations: [op] })
      expect(result.accepted).toHaveLength(0)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]?.message).toContain('online confirmation')
    })

    it('an entity/operation pair with no defined policy falls back to manual_review and is persisted as a real conflict', async () => {
      const authContext = testActorContext(location)
      const op = makeOp(location, { entityType: 'inventory_items', operation: 'delete' })

      const result = await syncService.pushOperations(authContext, { operations: [op] })
      expect(result.conflicts).toHaveLength(1)

      const conflicts = await syncService.listConflicts(authContext)
      expect(conflicts.find((c) => c.opId === op.opId)).toBeDefined()
    })

    it('retrying the same idempotencyKey returns the original result without reprocessing', async () => {
      const authContext = testActorContext(location)
      const idempotencyKey = randomUUID()
      const op = makeOp(location, { entityType: 'orders', operation: 'create', idempotencyKey })

      const first = await syncService.pushOperations(authContext, { operations: [op] })
      const second = await syncService.pushOperations(authContext, { operations: [{ ...op, opId: randomUUID() }] })

      expect(second.accepted[0]?.serverEntityId).toBe(first.accepted[0]?.serverEntityId)
    })

    it('an etims_submission is always recorded as synced, bypassing the conflict policy entirely', async () => {
      const authContext = testActorContext(location)
      const op = makeOp(location, { entityType: 'etims_submission', operation: 'create' })

      const result = await syncService.pushOperations(authContext, { operations: [op] })
      expect(result.accepted).toHaveLength(1)
      expect(result.conflicts).toHaveLength(0)
    })

    it('updates the device sync cursor for every device present in the pushed batch', async () => {
      const authContext = testActorContext(location)
      const deviceId = randomUUID()
      await syncService.pushOperations(authContext, { operations: [makeOp(location, { deviceId })] })

      const health = await syncService.getDeviceSyncHealth(authContext, deviceId)
      expect(health.syncStatus).toBe('syncing')
      expect(health.lastSyncedAt).not.toBeNull()
    })
  })

  describe('resolveConflict', () => {
    it('marks a conflict resolved and records who resolved it', async () => {
      const authContext = testActorContext(location)
      const op = makeOp(location, { entityType: 'refunds', operation: 'create' })
      await syncService.pushOperations(authContext, { operations: [op] })
      const [conflict] = await syncService.listConflicts(authContext)

      const resolved = await syncService.resolveConflict(authContext, {
        conflictId: conflict!.id,
        resolution: 'use_remote',
        reason: 'manager reviewed, server copy is correct',
      })
      expect(resolved.resolution).toBe('use_remote')
      expect(resolved.resolvedByActorId).toBe(authContext.actorId)
    })

    it('rejects resolving a conflict that does not exist', async () => {
      const authContext = testActorContext(location)
      await expect(
        syncService.resolveConflict(authContext, { conflictId: randomUUID(), resolution: 'use_remote', reason: 'n/a' }),
      ).rejects.toThrow('Conflict not found or already resolved')
    })
  })

  describe('device status', () => {
    it('updateDeviceStatus + getDeviceHealth round-trip battery/status info', async () => {
      const authContext = testActorContext(location)
      const deviceId = randomUUID()
      await syncService.pushOperations(authContext, { operations: [makeOp(location, { deviceId })] })

      await syncService.updateDeviceStatus(authContext, deviceId, 'offline', 42, true)
      const health = await syncService.getDeviceHealth(authContext, deviceId)
      expect(health[0]?.syncStatus).toBe('offline')
      expect(health[0]?.batteryLevel).toBe(42)
      expect(health[0]?.onBattery).toBe(true)
    })
  })

  describe('hasPendingSyncOperations (db-first, used by ShiftsService.close)', () => {
    it('is false when no sync operation is in status=pending', async () => {
      const authContext = testActorContext(location)
      await syncService.pushOperations(authContext, { operations: [makeOp(location)] }) // lands as 'synced', not 'pending'

      const pending = await withTenantContext(pool, location.organizationId, (db: Db) => syncService.hasPendingSyncOperations(db, location.organizationId))
      expect(pending).toBe(false)
    })

    it('is true once queueOfflineETimsSubmission queues a pending operation', async () => {
      const authContext = testActorContext(location)
      await syncService.queueOfflineETimsSubmission(authContext, randomUUID(), randomUUID())

      const pending = await withTenantContext(pool, location.organizationId, (db: Db) => syncService.hasPendingSyncOperations(db, location.organizationId))
      expect(pending).toBe(true)
    })
  })
})
