import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { OrdersController } from './orders.controller.js'
import { OrdersService } from './orders.service.js'

export const ordersModule = {
  name: 'orders',
  phase: 'restaurant-mvp',
  owns: ['orders', 'order_items', 'order_item_modifiers', 'order_discounts', 'bills', 'bill_items'],
} as const

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
