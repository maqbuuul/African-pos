import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { OrganizationController } from './organization.controller.js'
import { OrganizationService } from './organization.service.js'

export const organizationModule = {
  name: 'organization',
  phase: 'foundation',
  owns: ['organizations', 'businesses', 'locations', 'devices', 'users', 'tenant_settings'],
} as const

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
