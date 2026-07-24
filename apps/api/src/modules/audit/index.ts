import { Module } from '@nestjs/common'

import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { AuditController } from './audit.controller.js'
import { AuditService } from './audit.service.js'

export const auditModule = {
  name: 'audit',
  phase: 'foundation',
  owns: ['audit_logs', 'approval_requests'],
} as const

@Module({
  imports: [PermissionsModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
