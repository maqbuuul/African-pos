import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { FloorPlansController } from './floor-plans.controller.js'
import { FloorPlansService } from './floor-plans.service.js'
import { TablesController } from './tables.controller.js'
import { TablesService } from './tables.service.js'

export const restaurantModule = {
  name: 'restaurant',
  phase: 'restaurant-mvp',
  owns: ['floor_plans', 'restaurant_tables', 'table_merges'],
} as const

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [FloorPlansController, TablesController],
  providers: [FloorPlansService, TablesService],
})
export class RestaurantModule {}
