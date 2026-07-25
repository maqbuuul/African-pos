import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { paymentIntents, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createBillFixture, deleteBillFixture, type BillFixture } from '../../test/fixtures.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import { IdempotencyService } from './idempotency.service.js'

describe('IdempotencyService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let service: IdempotencyService
  let fixture: BillFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    service = moduleRef.get(IdempotencyService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    fixture = await createBillFixture()
  })

  afterEach(async () => {
    await deleteBillFixture(fixture)
  })

  it('returns null when no intent has been created for this key yet', async () => {
    const result = await withTenantContext(pool, fixture.organizationId, (db: Db) =>
      service.findExistingIntent(db, fixture.organizationId, randomUUID()),
    )
    expect(result).toBeNull()
  })

  it('finds a previously-created intent by the same idempotency key', async () => {
    const idempotencyKey = randomUUID()
    await withTenantContext(pool, fixture.organizationId, (db: Db) =>
      db.insert(paymentIntents).values({
        organizationId: fixture.organizationId,
        locationId: fixture.locationId,
        billId: fixture.billId,
        orderId: fixture.orderId,
        provider: 'mpesa_daraja',
        method: 'mpesa',
        amount: 1000,
        currency: 'KES',
        status: 'pending',
        idempotencyKey,
      }),
    )

    const result = await withTenantContext(pool, fixture.organizationId, (db: Db) =>
      service.findExistingIntent(db, fixture.organizationId, idempotencyKey),
    )
    expect(result).not.toBeNull()
    expect(result?.idempotencyKey).toBe(idempotencyKey)
  })

  it('never matches an idempotency key scoped to a different organization', async () => {
    const idempotencyKey = randomUUID()
    await withTenantContext(pool, fixture.organizationId, (db: Db) =>
      db.insert(paymentIntents).values({
        organizationId: fixture.organizationId,
        locationId: fixture.locationId,
        billId: fixture.billId,
        orderId: fixture.orderId,
        provider: 'mpesa_daraja',
        method: 'mpesa',
        amount: 1000,
        currency: 'KES',
        status: 'pending',
        idempotencyKey,
      }),
    )

    const otherFixture = await createBillFixture()
    const result = await withTenantContext(pool, otherFixture.organizationId, (db: Db) =>
      service.findExistingIntent(db, otherFixture.organizationId, idempotencyKey),
    )
    expect(result).toBeNull()
    await deleteBillFixture(otherFixture)
  })
})
