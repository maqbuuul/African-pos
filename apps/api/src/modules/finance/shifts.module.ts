import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { NotificationsModule } from '../notifications/index.js'
import { OrdersModule } from '../orders/orders.module.js'
import { PaymentsModule } from '../payments/payments.module.js'
import { SyncModule } from '../sync/index.js'
import { ShiftsController } from './shifts.controller.js'
import { ShiftsService } from './shifts.service.js'

@Module({
  imports: [AuditModule, PermissionsModule, NotificationsModule, OrdersModule, PaymentsModule, SyncModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
