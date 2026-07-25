import { forwardRef, Module } from '@nestjs/common'

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

// Payments -> Orders has no direct service-level cycle (Orders never needs
// Payments), but OrdersModule is still forwardRef'd below: Payments ->
// Orders -> Restaurant -> Notifications -> Payments is a real (longer)
// ES-module import cycle now that Notifications imports both Orders and
// Payments. Every edge in a cycle needs forwardRef, not just the one with
// a direct service-to-service dependency, or whichever module happens to
// load first hits a "Cannot access before initialization" TDZ error.
//
// Payments<->Notifications IS a direct two-way service dependency:
// PaymentsService injects ReceiptsService (post-payment receipt generation)
// and ReceiptsService now injects PaymentsService back (reading confirmed
// payments for a bill) — same forwardRef-on-both-sides pattern as the
// existing Orders<->Restaurant edge.
@Module({
  imports: [AuditModule, IdempotencyModule, PermissionsModule, forwardRef(() => NotificationsModule), forwardRef(() => OrdersModule), ProductsModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
