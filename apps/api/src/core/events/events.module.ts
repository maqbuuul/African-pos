import { Global, Module } from '@nestjs/common'
import type { Pool } from 'pg'
import { createSystemPool } from '@hospitality-os/database'

import { SYSTEM_POOL } from '../tenant/tenant.constants.js'
import { EventBus } from './event-bus.js'
import { OutboxService } from './outbox.service.js'
import { OutboxWorker } from './outbox.worker.js'

@Global()
@Module({
  providers: [
    EventBus,
    OutboxService,
    OutboxWorker,
    {
      // The outbox worker relays events across every tenant, which is
      // exactly the administrative use case packages/database's
      // createSystemPool is for (RLS-bypassing) — never used to serve
      // request traffic, only this background relay.
      provide: SYSTEM_POOL,
      useFactory: (): Pool => {
        const connectionString = process.env['DATABASE_URL']
        if (!connectionString) {
          throw new Error('DATABASE_URL is required for the outbox worker to relay events across tenants.')
        }
        return createSystemPool(connectionString)
      },
    },
  ],
  exports: [EventBus, OutboxService],
})
export class EventsModule {}
