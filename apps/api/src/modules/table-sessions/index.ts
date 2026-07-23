import { Module } from '@nestjs/common'

import { TableSessionsController } from './table-sessions.controller.js'
import { TableSessionsService } from './table-sessions.service.js'

export const tableSessionsModule = {
  name: 'table-sessions',
  phase: 'restaurant-mvp',
  owns: [],
} as const

@Module({
  controllers: [TableSessionsController],
  providers: [TableSessionsService],
})
export class TableSessionsModule {}
