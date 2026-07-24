import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { createSystemDb, events } from '@hospitality-os/database'

import { SYSTEM_POOL } from '../tenant/tenant.constants.js'
import { EventBus, type DomainEvent } from './event-bus.js'

@Injectable()
export class OutboxWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name)
  private active = false
  private polling = false
  private intervalHandle: ReturnType<typeof setInterval> | null = null

  private static readonly POLL_INTERVAL_MS = 5_000
  private static readonly BATCH_SIZE = 50

  constructor(
    @Inject(SYSTEM_POOL) private readonly systemPool: Pool,
    @Inject(EventBus) private readonly eventBus: EventBus,
  ) {}

  onModuleInit(): void {
    this.start()
  }

  onApplicationShutdown(): void {
    this.stop()
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.intervalHandle = setInterval(() => void this.poll(), OutboxWorker.POLL_INTERVAL_MS)
  }

  stop(): void {
    this.active = false
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  private async poll(): Promise<void> {
    // Re-entrancy guard: a slow batch must not overlap the next timer tick.
    if (this.polling) return
    this.polling = true
    try {
      // System pool (bypasses RLS) — this relay legitimately spans every
      // tenant, unlike every other query in this app which is scoped via
      // withTenantContext to exactly one organization.
      const db = createSystemDb(this.systemPool)
      const rows = await db
        .select()
        .from(events)
        .where(isNull(events.processedAt))
        .orderBy(events.occurredAt)
        .limit(OutboxWorker.BATCH_SIZE)

      for (const row of rows) {
        const domainEvent: DomainEvent = {
          eventType: row.eventType,
          organizationId: row.organizationId,
          locationId: row.locationId ?? undefined,
          entityType: row.entityType,
          entityId: row.entityId,
          data: (row.data ?? {}) as Record<string, unknown>,
          occurredAt: row.occurredAt,
        }
        try {
          await this.eventBus.emitAsync(domainEvent)
          await db
            .update(events)
            .set({ processedAt: sql`now()` })
            .where(and(eq(events.id, row.id), isNull(events.processedAt)))
        } catch (error) {
          // Leave unprocessed — retried on the next poll. A handler that
          // always throws would otherwise block the whole batch forever.
          this.logger.error(`Outbox event ${row.id} (${row.eventType}) failed to relay`, error)
        }
      }
    } catch (error) {
      this.logger.error('Outbox poll failed', error)
    } finally {
      this.polling = false
    }
  }
}
