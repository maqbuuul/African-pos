import { Module } from '@nestjs/common'

import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { StaffReportController } from './staff-report.controller.js'
import { StaffReportService } from './staff-report.service.js'

export const staffModule = {
  name: 'staff',
  phase: 'foundation',
  owns: ['staff', 'roles', 'permissions', 'staff_sessions', 'attendance'],
} as const

@Module({
  imports: [PermissionsModule],
  controllers: [StaffReportController],
  providers: [StaffReportService],
})
export class StaffModule {}
