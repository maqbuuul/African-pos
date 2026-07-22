import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'

import { AuditModule } from '../audit/audit.module.js'
import { ApprovalsController } from './approvals.controller.js'
import { ApprovalsService } from './approvals.service.js'
import { PermissionsGuard } from './permissions.guard.js'
import { PermissionsService } from './permissions.service.js'

// Global guard, but a no-op unless a handler carries @RequirePermission(...)
// — routes opt in explicitly rather than this locking down every existing
// endpoint (health check, /auth/* itself) by default.
@Module({
  imports: [AuditModule],
  controllers: [ApprovalsController],
  providers: [PermissionsService, ApprovalsService, { provide: APP_GUARD, useClass: PermissionsGuard }],
  exports: [PermissionsService, ApprovalsService],
})
export class PermissionsModule {}
