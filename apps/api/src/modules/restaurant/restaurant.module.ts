import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { FloorPlansController } from './floor-plans.controller.js'
import { FloorPlansService } from './floor-plans.service.js'
import { KdsController } from './kds.controller.js'
import { KdsService } from './kds.service.js'
import { TablesController } from './tables.controller.js'
import { TablesService } from './tables.service.js'

export const restaurantModule = {
  name: 'restaurant',
  phase: 'restaurant-mvp',
  owns: ['floor_plans', 'restaurant_tables', 'table_merges', 'kds_stations', 'kitchen_tickets', 'kitchen_ticket_items'],
} as const

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [FloorPlansController, TablesController, KdsController],
  providers: [FloorPlansService, TablesService, KdsService],
  exports: [KdsService],
})
export class RestaurantModule {}
