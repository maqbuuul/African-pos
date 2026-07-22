import { Global, Module } from '@nestjs/common'
import type { Pool } from 'pg'
import { createAppPool } from '@hospitality-os/database'

import { APP_POOL } from './tenant.constants.js'
import { TenantDbService } from './tenant-db.service.js'
import { TenantSettingsService } from './tenant-settings.service.js'

// Global so every feature module can inject TenantDbService without each one
// re-importing TenantModule.
@Global()
@Module({
  providers: [
    {
      provide: APP_POOL,
      useFactory: (): Pool => {
        const connectionString = process.env['APP_DATABASE_URL']
        if (!connectionString) {
          throw new Error(
            'APP_DATABASE_URL is required — the API must connect as the low-privilege ' +
              'pos_app role, not the superuser DATABASE_URL role, or Row-Level Security ' +
              'is not enforced. See infra/postgres/init.sql.',
          )
        }
        return createAppPool(connectionString)
      },
    },
    TenantDbService,
    TenantSettingsService,
  ],
  exports: [APP_POOL, TenantDbService, TenantSettingsService],
})
export class TenantModule {}
