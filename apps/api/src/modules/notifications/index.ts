import { forwardRef, Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { OrganizationModule } from '../organization/index.js'
import { OrdersModule } from '../orders/orders.module.js'
import { PaymentsModule } from '../payments/payments.module.js'
import { ReceiptsController } from './receipts.controller.js'
import { ReceiptsService } from './receipts.service.js'
import { StaffNotificationsService } from './staff-notifications.service.js'

export const notificationsModule = {
  name: 'notifications',
  phase: 'restaurant-operations',
  owns: [
    'receipts',
    'tax_compliance_submissions',
    'notification_preferences',
    'staff_notifications',
  ],
} as const

@Module({
  // forwardRef: PaymentsModule already imports NotificationsModule
  // (post-payment receipt generation) — ReceiptsService now also needs
  // PaymentsService (to read confirmed payments for a bill), a genuine
  // two-way dependency. Same pattern as the existing Orders<->Restaurant
  // cycle (see orders.module.ts).
  //
  // OrdersModule is also forwardRef'd: Notifications -> Orders ->
  // Restaurant -> Notifications is now a real (longer) ES-module import
  // cycle (Restaurant already imports Notifications for StaffNotifications;
  // Orders<->Restaurant was already forwardRef'd on both sides). Every edge
  // in a cycle needs forwardRef, not just the one with a direct
  // service-to-service dependency.
  imports: [AuditModule, forwardRef(() => OrdersModule), OrganizationModule, forwardRef(() => PaymentsModule)],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, StaffNotificationsService],
  exports: [ReceiptsService, StaffNotificationsService],
})
export class NotificationsModule {}
