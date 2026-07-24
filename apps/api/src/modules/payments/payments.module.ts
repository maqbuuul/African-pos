import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { IdempotencyModule } from '../../core/idempotency/idempotency.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { NotificationsModule } from '../notifications/index.js'
import { OrdersModule } from '../orders/orders.module.js'
import { ProductsModule } from '../products/products.module.js'
import { PaymentsController, PaymentsWebhookController } from './payments.controller.js'
import { PaymentsService } from './payments.service.js'

export const paymentsModule = {
  name: 'payments',
  phase: 'restaurant-mvp',
  owns: ['payment_intents', 'payments', 'refunds', 'tips', 'integration_connections'],
} as const

// Payments -> Orders is one-directional (Orders never needs Payments) —
// no forwardRef needed here, unlike the Orders<->Restaurant edge.
@Module({
  imports: [AuditModule, IdempotencyModule, PermissionsModule, NotificationsModule, OrdersModule, ProductsModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
