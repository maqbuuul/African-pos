import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { ReceiptsController } from './receipts.controller.js'
import { ReceiptsService } from './receipts.service.js'

export const notificationsModule = {
  name: 'notifications',
  phase: 'restaurant-operations',
  owns: [
    'notification_templates',
    'notification_deliveries',
    'receipts',
    'tax_compliance_submissions',
    'notification_preferences',
  ],
} as const

@Module({
  imports: [AuditModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class NotificationsModule {}
