import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, type LocationFixture } from '../../test/fixtures.js'
import { APP_POOL } from './tenant.constants.js'
import { TenantSettingsService } from './tenant-settings.service.js'

describe('TenantSettingsService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let service: TenantSettingsService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    service = moduleRef.get(TenantSettingsService)
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

  it('returns the caller-supplied fallback when no row exists at all', async () => {
    const value = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.get(db, location.organizationId, 'cash_variance_threshold', 500),
    )
    expect(value).toBe(500)
  })

  it('a location-scoped override wins over the org-wide default when both exist', async () => {
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.set(db, location.organizationId, 'price_change_approval_threshold_pct', 20),
    )
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.set(db, location.organizationId, 'price_change_approval_threshold_pct', 5, { locationId: location.locationId }),
    )

    const scoped = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.get(db, location.organizationId, 'price_change_approval_threshold_pct', 999, location.locationId),
    )
    expect(scoped).toBe(5)
  })

  it('falls back to the org-wide default when a location has no override of its own', async () => {
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.set(db, location.organizationId, 'price_change_approval_threshold_pct', 20),
    )

    const other = await createLocationFixture()
    // other's location has no override row of its own, but shares the org.
    const value = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.get(db, location.organizationId, 'price_change_approval_threshold_pct', 999, other.locationId),
    )
    expect(value).toBe(20)
    await deleteLocationFixture(other)
  })

  it('set() upserts: calling it twice for the same key updates the value in place, not a second row', async () => {
    await withTenantContext(pool, location.organizationId, (db: Db) => service.set(db, location.organizationId, 'test_key', 'first'))
    await withTenantContext(pool, location.organizationId, (db: Db) => service.set(db, location.organizationId, 'test_key', 'second'))

    const value = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.get(db, location.organizationId, 'test_key', 'fallback'),
    )
    expect(value).toBe('second')
  })

  it('listByKeyPrefix returns only keys matching the given prefix', async () => {
    await withTenantContext(pool, location.organizationId, (db: Db) => service.set(db, location.organizationId, 'report_schedule_daily', { hour: 6 }))
    await withTenantContext(pool, location.organizationId, (db: Db) => service.set(db, location.organizationId, 'report_schedule_weekly', { day: 1 }))
    await withTenantContext(pool, location.organizationId, (db: Db) => service.set(db, location.organizationId, 'unrelated_key', 'x'))

    const rows = await withTenantContext(pool, location.organizationId, (db: Db) =>
      service.listByKeyPrefix(db, location.organizationId, 'report_schedule_'),
    )
    expect(rows.map((r) => r.key).sort()).toEqual(['report_schedule_daily', 'report_schedule_weekly'])
  })
})
