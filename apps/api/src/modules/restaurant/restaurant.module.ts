import { Module, forwardRef } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { StaffModule } from '../../core/staff/staff.module.js'
import { NotificationsModule } from '../notifications/index.js'
import { ProductsModule } from '../products/products.module.js'
import { OrdersModule } from '../orders/orders.module.js'
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

// forwardRef: KdsService needs OrdersService for kitchen-initiated writes
// to order_items/orders (see kds.service.ts) — OrdersModule already imports
// this module (forwardRef too) for KdsService/TablesService, so this is a
// genuine two-way module dependency, not an accident.
@Module({
  imports: [AuditModule, PermissionsModule, ProductsModule, StaffModule, NotificationsModule, forwardRef(() => OrdersModule)],
  controllers: [FloorPlansController, TablesController, KdsController],
  providers: [FloorPlansService, TablesService, KdsService],
  exports: [KdsService, TablesService],
})
export class RestaurantModule {}
