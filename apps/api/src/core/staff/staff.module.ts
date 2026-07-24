import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module.js'
import { AttendanceController } from './attendance.controller.js'
import { AttendanceService } from './attendance.service.js'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'

@Module({
  imports: [AuditModule],
  controllers: [StaffController, AttendanceController],
  providers: [StaffService, AttendanceService],
  exports: [StaffService],
})
export class StaffModule {}
