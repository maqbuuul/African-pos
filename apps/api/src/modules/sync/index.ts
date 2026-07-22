import { Module } from '@nestjs/common'

export const syncModule = {
  name: 'sync',
  phase: 'restaurant-mvp',
  owns: ['sync_operations', 'sync_cursors', 'sync_conflicts'],
} as const

@Module({})
export class SyncModule {}
