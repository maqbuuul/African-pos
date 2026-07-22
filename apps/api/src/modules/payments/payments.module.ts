import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { IdempotencyModule } from '../../core/idempotency/idempotency.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { PaymentsController, PaymentsWebhookController } from './payments.controller.js'
import { PaymentsService } from './payments.service.js'

export const paymentsModule = {
  name: 'payments',
  phase: 'restaurant-mvp',
  owns: ['payment_intents', 'payments', 'refunds', 'tips', 'integration_connections'],
} as const

@Module({
  imports: [AuditModule, IdempotencyModule, PermissionsModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
