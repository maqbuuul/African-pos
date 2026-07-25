import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { auditLogs, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, systemDb, type LocationFixture } from '../../test/fixtures.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import { AuditLogService } from './audit-log.service.js'

describe('AuditLogService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let service: AuditLogService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    service = moduleRef.get(AuditLogService)
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

  it('writes a row visible to a query under the same tenant context', async () => {
    await service.record({
      organizationId: location.organizationId,
      actorType: 'system',
      action: 'test.event',
      entityType: 'test_entity',
    })

    const rows = await withTenantContext(pool, location.organizationId, (db: Db) =>
      db.select().from(auditLogs).where(eq(auditLogs.action, 'test.event')),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.organizationId).toBe(location.organizationId)
  })

  it('the RLS-scoped app connection cannot update a row at all (no UPDATE policy — a no-op, not a leak)', async () => {
    await service.record({ organizationId: location.organizationId, actorType: 'system', action: 'test.immutable' })
    const [row] = await withTenantContext(pool, location.organizationId, (db: Db) =>
      db.select().from(auditLogs).where(eq(auditLogs.action, 'test.immutable')),
    )
    expect(row).toBeDefined()

    const result = await withTenantContext(pool, location.organizationId, (db: Db) =>
      db.update(auditLogs).set({ reason: 'tampered' }).where(eq(auditLogs.id, row!.id)),
    )
    expect(result.rowCount).toBe(0)

    const [unchanged] = await withTenantContext(pool, location.organizationId, (db: Db) =>
      db.select().from(auditLogs).where(eq(auditLogs.id, row!.id)),
    )
    expect(unchanged?.reason).toBeNull()
  })

  it('even the privileged system connection (RLS-bypassing) is rejected by the append-only trigger itself', async () => {
    await service.record({ organizationId: location.organizationId, actorType: 'system', action: 'test.trigger_check' })
    const [row] = await systemDb.select().from(auditLogs).where(eq(auditLogs.action, 'test.trigger_check'))
    expect(row).toBeDefined()

    await expect(
      systemDb.update(auditLogs).set({ reason: 'tampered' }).where(eq(auditLogs.id, row!.id)),
    ).rejects.toThrow(/audit_logs rows are immutable/i)

    await expect(systemDb.delete(auditLogs).where(eq(auditLogs.id, row!.id))).rejects.toThrow(/audit_logs rows are immutable/i)
  })

  it('a row written under org A is invisible to a query scoped to org B', async () => {
    await service.record({ organizationId: location.organizationId, actorType: 'system', action: 'test.isolated' })

    const otherLocation = await createLocationFixture()
    const rows = await withTenantContext(pool, otherLocation.organizationId, (db: Db) =>
      db.select().from(auditLogs).where(eq(auditLogs.action, 'test.isolated')),
    )
    expect(rows).toHaveLength(0)
    await deleteLocationFixture(otherLocation)
  })
})
