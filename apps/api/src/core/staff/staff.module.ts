import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module.js'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'

@Module({
  imports: [AuditModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
