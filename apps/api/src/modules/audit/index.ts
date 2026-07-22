import { Module } from '@nestjs/common'

export const auditModule = {
  name: 'audit',
  phase: 'foundation',
  owns: ['audit_logs', 'approval_requests'],
} as const

@Module({})
export class AuditModule {}
