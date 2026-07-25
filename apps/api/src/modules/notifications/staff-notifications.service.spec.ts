import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, type LocationFixture } from '../../test/fixtures.js'
import { StaffNotificationsService } from './staff-notifications.service.js'

describe('StaffNotificationsService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let service: StaffNotificationsService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    service = moduleRef.get(StaffNotificationsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(location)
  })

  it('creates a notification defaulting to status=pending', async () => {
    const created = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.create(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        notificationType: 'kds_delay_alert',
        message: 'Order running behind',
        reason: 'ticket-item-123',
      }),
    )
    expect(created.status).toBe('pending')
  })

  it('hasPending is true only while a matching pending notification exists for that exact (type, reason) pair', async () => {
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.create(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        notificationType: 'kds_delay_alert',
        reason: 'ticket-item-abc',
      }),
    )

    const matching = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.hasPending(db, location.organizationId, 'kds_delay_alert', 'ticket-item-abc'),
    )
    expect(matching).toBe(true)

    const differentReason = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.hasPending(db, location.organizationId, 'kds_delay_alert', 'ticket-item-xyz'),
    )
    expect(differentReason).toBe(false)

    const differentType = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.hasPending(db, location.organizationId, 'supplier_credit_reminder', 'ticket-item-abc'),
    )
    expect(differentType).toBe(false)
  })
})
