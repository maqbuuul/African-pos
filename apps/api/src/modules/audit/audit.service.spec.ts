import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, testActorContext, type LocationFixture } from '../../test/fixtures.js'
import { AuditService } from './audit.service.js'

describe('AuditService (integration)', () => {
  let moduleRef: TestingModule
  let auditService: AuditService
  let auditLog: AuditLogService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    auditService = moduleRef.get(AuditService)
    auditLog = moduleRef.get(AuditLogService)
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

  it('list paginates and filters by entityType/action', async () => {
    const authContext = testActorContext(location)
    for (let i = 0; i < 3; i++) {
      await auditLog.record({ organizationId: location.organizationId, actorType: 'system', action: 'test.event_a', entityType: 'widget' })
    }
    await auditLog.record({ organizationId: location.organizationId, actorType: 'system', action: 'test.event_b', entityType: 'gadget' })

    const filtered = await auditService.list(authContext, { page: 1, limit: 50, action: 'test.event_a' })
    expect(filtered.total).toBe(3)
    expect(filtered.data.every((row) => row.action === 'test.event_a')).toBe(true)

    const page1 = await auditService.list(authContext, { page: 1, limit: 2, action: 'test.event_a' })
    expect(page1.data).toHaveLength(2)
    const page2 = await auditService.list(authContext, { page: 2, limit: 2, action: 'test.event_a' })
    expect(page2.data).toHaveLength(1)
  })

  it('getById 404s for an unknown log id', async () => {
    const authContext = testActorContext(location)
    await expect(auditService.getById(authContext, '00000000-0000-0000-0000-000000000000')).rejects.toThrow('audit log not found')
  })

  it("never returns another organization's audit log rows", async () => {
    const other = await createLocationFixture()
    await auditLog.record({ organizationId: other.organizationId, actorType: 'system', action: 'test.cross_tenant' })

    const authContext = testActorContext(location)
    const result = await auditService.list(authContext, { page: 1, limit: 50, action: 'test.cross_tenant' })
    expect(result.total).toBe(0)

    await deleteLocationFixture(other)
  })
})
