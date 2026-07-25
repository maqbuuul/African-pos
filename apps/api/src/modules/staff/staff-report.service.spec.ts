import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, testActorContext, type LocationFixture } from '../../test/fixtures.js'
import { StaffReportService } from './staff-report.service.js'

describe('StaffReportService (integration)', () => {
  let moduleRef: TestingModule
  let staffReportService: StaffReportService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    staffReportService = moduleRef.get(StaffReportService)
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

  it('delegates to ReportsService.staffPerformanceReport and returns an empty list when no metrics exist yet', async () => {
    const authContext = testActorContext(location)
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const to = new Date()

    const result = await staffReportService.performance(authContext, location.locationId, from, to)
    expect(result).toEqual([])
  })
})
