import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, testActorContext, type LocationFixture } from '../../test/fixtures.js'
import { OrganizationService } from './organization.service.js'

describe('OrganizationService (integration)', () => {
  let moduleRef: TestingModule
  let organizationService: OrganizationService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    organizationService = moduleRef.get(OrganizationService)
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

  describe('create', () => {
    it('creates a new organization even when the caller has no prior tenant context (onboarding case)', async () => {
      const authContext = testActorContext(location) // organizationId here is arbitrary at this point in a real signup flow
      const created = await organizationService.create(authContext, {
        name: 'New Restaurant Co',
        country: 'KE',
        defaultCurrency: 'KES',
        timezone: 'Africa/Nairobi',
      })
      expect(created.name).toBe('New Restaurant Co')
      expect(created.status).toBe('active')

      // create() writes an 'organization.created' audit log row against the
      // new org (audit_logs.organization_id is onDelete:'restrict' and
      // immutable — see AuditLogService) — this org can never be deleted
      // afterward, same accepted-orphan cost as every other org fixture.
    })
  })

  describe('update', () => {
    it('applies a partial patch without touching unspecified fields', async () => {
      const authContext = testActorContext(location)
      const updated = await organizationService.update(authContext, location.organizationId, { legalName: 'New Restaurant Co Ltd' })
      expect(updated.legalName).toBe('New Restaurant Co Ltd')
      expect(updated.defaultCurrency).toBe('KES')
    })

    it('rejects updating an organization that does not exist', async () => {
      const authContext = testActorContext(location)
      await expect(organizationService.update(authContext, randomUUID(), { legalName: 'x' })).rejects.toThrow('organization not found')
    })
  })

  describe('getById / list', () => {
    it('getById 404s for an unknown id', async () => {
      const authContext = testActorContext(location)
      await expect(organizationService.getById(authContext, randomUUID())).rejects.toThrow('organization not found')
    })

    it("list only ever returns the caller's own organization, never any other tenant's", async () => {
      const authContext = testActorContext(location)
      const other = await createLocationFixture()

      const result = await organizationService.list(authContext)
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe(location.organizationId)
      expect(result.map((o) => o.id)).not.toContain(other.organizationId)

      await deleteLocationFixture(other)
    })
  })
})
