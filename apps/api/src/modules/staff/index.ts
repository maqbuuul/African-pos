import { Module } from '@nestjs/common'

import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { ReportsModule } from '../reports/index.js'
import { StaffReportController } from './staff-report.controller.js'
import { StaffReportService } from './staff-report.service.js'

export const staffModule = {
  name: 'staff',
  phase: 'foundation',
  owns: ['staff', 'roles', 'permissions', 'role_permissions', 'staff_roles', 'auth_sessions'],
} as const

@Module({
  imports: [PermissionsModule, ReportsModule],
  controllers: [StaffReportController],
  providers: [StaffReportService],
})
export class StaffModule {}
