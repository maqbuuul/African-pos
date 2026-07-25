import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { NotificationsModule } from '../notifications/index.js'
import { SyncController } from './sync.controller.js'
import { SyncService } from './sync.service.js'

export const syncModule = {
  name: 'sync',
  phase: 'restaurant-mvp',
  owns: ['sync_operations', 'sync_cursors', 'sync_conflicts'],
} as const

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
