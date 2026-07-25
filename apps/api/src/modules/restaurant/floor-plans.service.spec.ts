import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createLocationFixture,
  deleteLocationFixture,
  testActorContext,
  type LocationFixture,
} from '../../test/fixtures.js'
import { FloorPlansService } from './floor-plans.service.js'

describe('FloorPlansService (integration)', () => {
  let moduleRef: TestingModule
  let service: FloorPlansService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    service = moduleRef.get(FloorPlansService)
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

  it('creates a floor plan and can fetch it back by id', async () => {
    const authContext = testActorContext(location)
    const created = await service.create(authContext, { locationId: location.locationId, name: 'Main Dining Room' })
    expect(created.status).toBe('active')

    const fetched = await service.getById(authContext, created.id)
    expect(fetched.name).toBe('Main Dining Room')
  })

  it('update applies a partial patch without clobbering unspecified fields', async () => {
    const authContext = testActorContext(location)
    const created = await service.create(authContext, { locationId: location.locationId, name: 'Patio' })

    const updated = await service.update(authContext, created.id, { status: 'inactive' })
    expect(updated.status).toBe('inactive')
    expect(updated.name).toBe('Patio')
  })

  it('list only returns floor plans for the caller\'s own organization', async () => {
    const authContext = testActorContext(location)
    await service.create(authContext, { locationId: location.locationId, name: 'Rooftop' })

    const other = await createLocationFixture()
    const otherContext = testActorContext(other)
    await service.create(otherContext, { locationId: other.locationId, name: "Other Org's Plan" })

    const results = await service.list(authContext)
    expect(results.every((p) => p.organizationId === location.organizationId)).toBe(true)
    expect(results.map((p) => p.name)).not.toContain("Other Org's Plan")

    await deleteLocationFixture(other)
  })

  it('delete removes the floor plan; a second get 404s', async () => {
    const authContext = testActorContext(location)
    const created = await service.create(authContext, { locationId: location.locationId, name: 'Temp' })
    await service.delete(authContext, created.id)

    await expect(service.getById(authContext, created.id)).rejects.toThrow('floor plan not found')
  })
})
