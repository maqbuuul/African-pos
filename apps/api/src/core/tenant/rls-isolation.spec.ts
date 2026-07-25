import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { locations, orders, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createLocationFixture,
  deleteLocationFixture,
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
})
