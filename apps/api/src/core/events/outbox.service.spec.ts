import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { events, withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { closeFixturePool, createLocationFixture, deleteLocationFixture, type LocationFixture } from '../../test/fixtures.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import { EventBus, type DomainEvent } from './event-bus.js'
import { OutboxService } from './outbox.service.js'

describe('OutboxService (integration)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let outboxService: OutboxService
  let eventBus: EventBus
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    outboxService = moduleRef.get(OutboxService)
    eventBus = moduleRef.get(EventBus)
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

  it('persists an events row joined to the transaction it was called from', async () => {
    const entityId = randomUUID()
    await withTenantContext(pool, location.organizationId, (db: Db) =>
      outboxService.persistAndEmit(db, {
        organizationId: location.organizationId,
        locationId: location.locationId,
        eventType: 'test.event',
        entityType: 'test_entity',
        entityId,
        occurredAt: new Date(),
      }),
    )

    const rows = await withTenantContext(pool, location.organizationId, (db: Db) =>
      db.select().from(events).where(eq(events.entityId, entityId)),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.eventType).toBe('test.event')
    expect(rows[0]?.processedAt).toBeNull()
  })

  it("rolls back with the caller's transaction — an outbox row never survives a rollback of the change it describes", async () => {
    const entityId = randomUUID()

    await expect(
      withTenantContext(pool, location.organizationId, async (db: Db) => {
        await outboxService.persistAndEmit(db, {
          organizationId: location.organizationId,
          locationId: location.locationId,
          eventType: 'test.rolled_back',
          entityType: 'test_entity',
          entityId,
          occurredAt: new Date(),
        })
        throw new Error('simulated failure after the business write')
      }),
    ).rejects.toThrow('simulated failure')

    const rows = await withTenantContext(pool, location.organizationId, (db: Db) =>
      db.select().from(events).where(eq(events.entityId, entityId)),
    )
    expect(rows).toHaveLength(0)
  })

  it('synchronously notifies EventBus listeners registered for the event type', async () => {
    const entityId = randomUUID()
    const received: DomainEvent[] = []
    const handler = (event: DomainEvent) => {
      received.push(event)
    }
    eventBus.on('test.listener_check', handler)

    try {
      await withTenantContext(pool, location.organizationId, (db: Db) =>
        outboxService.persistAndEmit(db, {
          organizationId: location.organizationId,
          locationId: location.locationId,
          eventType: 'test.listener_check',
          entityType: 'test_entity',
          entityId,
          occurredAt: new Date(),
        }),
      )
      expect(received).toHaveLength(1)
      expect(received[0]?.entityId).toBe(entityId)
    } finally {
      eventBus.off('test.listener_check', handler)
    }
  })
})
