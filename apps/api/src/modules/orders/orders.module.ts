import { Module, forwardRef } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { InventoryModule } from '../inventory/index.js'
import { ProductsModule } from '../products/products.module.js'
import { RestaurantModule } from '../restaurant/restaurant.module.js'
import { OrdersController } from './orders.controller.js'
import { OrdersService } from './orders.service.js'

export const ordersModule = {
  name: 'orders',
  phase: 'restaurant-mvp',
  owns: ['orders', 'order_items', 'order_item_modifiers', 'order_discounts', 'bills', 'bill_items'],
} as const

// forwardRef: RestaurantModule's KdsService needs OrdersService for
// kitchen-initiated writes to order_items/orders — a genuine two-way
// module dependency (see kds.service.ts's OrdersService import for detail).
@Module({
  imports: [AuditModule, PermissionsModule, ProductsModule, InventoryModule, forwardRef(() => RestaurantModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
