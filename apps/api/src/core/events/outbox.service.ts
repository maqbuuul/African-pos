import { Inject, Injectable } from '@nestjs/common'
import { events, type Db } from '@hospitality-os/database'

import { EventBus, type DomainEvent } from './event-bus.js'

@Injectable()
export class OutboxService {
  constructor(@Inject(EventBus) private readonly eventBus: EventBus) {}

  // Takes the caller's own transaction handle (already inside its
  // withTenantContext block) so the outbox row commits atomically with the
  // business state change it describes — persisting it in a separate
  // transaction would let the event survive a rollback of the change it's
  // supposed to describe, or vice versa.
  async persistAndEmit(db: Db, event: DomainEvent): Promise<void> {
    await db.insert(events).values({
      organizationId: event.organizationId,
      locationId: event.locationId ?? event.organizationId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      data: (event.data ?? {}) as Record<string, unknown>,
    })
    // Fires before the caller's transaction commits — harmless today since
    // nothing subscribes in-process yet, but the first real listener must
    // not treat this as proof the event's data actually landed.
    this.eventBus.emit(event)
  }
}
