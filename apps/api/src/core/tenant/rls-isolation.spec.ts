import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { events, locations, orders, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createLocationFixture,
  deleteLocationFixture,
  systemDb,
  type LocationFixture,
} from '../../test/fixtures.js'
import { APP_POOL } from './tenant.constants.js'

// Row-Level Security is the single control every other permission check in
// this codebase assumes is already holding — PermissionsGuard decides
// *whether* an actor may call an endpoint, but RLS is what stops a bug in
// that decision (or a missing WHERE organization_id = ... clause anywhere in
// application code) from actually leaking another tenant's rows. This is the
// one test in the suite that exercises the database policy directly, via the
// same APP_POOL/withTenantContext path every service uses — not a mock.
describe('Row-Level Security tenant isolation (APP_POOL)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let orgA: LocationFixture
  let orgB: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    orgA = await createLocationFixture()
    orgB = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(orgA)
    await deleteLocationFixture(orgB)
  })

  it("a connection scoped to org A cannot see org B's locations, even with no WHERE clause at all", async () => {
    const visibleToA = await withTenantContext(pool, orgA.organizationId, (db: Db) =>
      db.select().from(locations),
    )
    expect(visibleToA.map((l) => l.id)).toContain(orgA.locationId)
    expect(visibleToA.map((l) => l.id)).not.toContain(orgB.locationId)
  })

  it("an explicit query for org B's own location row, run under org A's tenant context, returns nothing (not a cross-tenant leak)", async () => {
    const result = await withTenantContext(pool, orgA.organizationId, (db: Db) =>
      db.select().from(locations).where(eq(locations.id, orgB.locationId)),
    )
    expect(result).toHaveLength(0)
  })

  it('an INSERT of a row claiming organization_id = A while connected under tenant context B is rejected by policy, not silently reassigned', async () => {
    await expect(
      withTenantContext(pool, orgB.organizationId, (db: Db) =>
        db.insert(orders).values({
          organizationId: orgA.organizationId,
          locationId: orgA.locationId,
          channel: 'pos',
          status: 'open',
          totalAmount: 0,
          currency: 'KES',
        }),
      ),
    ).rejects.toThrow()
  })

  it('a null organizationId (unauthenticated context) sees no tenant-scoped rows at all', async () => {
    const result = await withTenantContext(pool, null, (db: Db) => db.select().from(locations).where(eq(locations.id, orgA.locationId)))
    expect(result).toHaveLength(0)
  })

  // Regression test for the P14 Reports & BI tables (events, report_snapshots,
  // daily_location_metrics, product_sales_metrics, staff_performance_metrics),
  // which were created in migration 0015 with organization_id but no RLS
  // policy at all — the only tenant tables in the schema missing one, fixed
  // by migration 0028. Without it, org B's reporting data would be visible to
  // org A on any query missing an explicit WHERE organization_id clause.
  it("org A cannot see org B's analytics events, even with no WHERE clause at all", async () => {
    await withTenantContext(pool, orgB.organizationId, (db: Db) =>
      db.insert(events).values({
        organizationId: orgB.organizationId,
        locationId: orgB.locationId,
        eventType: 'test.event',
        entityType: 'test',
        entityId: orgB.locationId,
      }),
    )

    const visibleToA = await withTenantContext(pool, orgA.organizationId, (db: Db) => db.select().from(events))
    expect(visibleToA.every((e) => e.organizationId === orgA.organizationId)).toBe(true)

    const visibleToB = await withTenantContext(pool, orgB.organizationId, (db: Db) => db.select().from(events))
    expect(visibleToB.some((e) => e.organizationId === orgB.organizationId)).toBe(true)

    // events.location_id is onDelete:'restrict' — clear it before afterEach's
    // deleteLocationFixture(orgB) tries to delete orgB's location.
    await systemDb.delete(events).where(eq(events.organizationId, orgB.organizationId))
  })
})
