import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { NotificationsModule } from '../notifications/index.js'
import { ShiftsController } from './shifts.controller.js'
import { ShiftsService } from './shifts.service.js'

@Module({
  imports: [AuditModule, PermissionsModule, NotificationsModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
