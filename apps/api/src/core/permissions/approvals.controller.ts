import { Controller, ForbiddenException, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { AuditLogService } from '../audit/audit-log.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { TenantDbService } from '../tenant/tenant-db.service.js'
import { ApprovalsService } from './approvals.service.js'
import { PermissionsService } from './permissions.service.js'

// Manager-facing side of the override flow PermissionsGuard starts. Approve
// and reject both require the resolver to already hold the permission the
// original request was missing — the point of a manager override is that a
// manager already has the authority the requester lacks, not that anyone
// logged in can wave through anything.
@Controller('api/v1/approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(TenantDbService) private readonly tenantDb: TenantDbService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    const authContext = req.authContext!
    return this.tenantDb.run((db) => this.approvalsService.listPending(db, authContext.organizationId))
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @Req() req: Request) {
    return this.resolve(id, req, 'approve')
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Req() req: Request) {
    return this.resolve(id, req, 'reject')
  }

  private async resolve(id: string, req: Request, outcome: 'approve' | 'reject') {
    const authContext = req.authContext!

    // AuditLogService.record opens its own transaction, so — same reason as
    // AuthService.activateDevice and StaffService.setStatus — it runs after
    // this one commits, not nested inside tenantDb.run's callback.
    const { existing, resolved } = await this.tenantDb.run(async (db) => {
      const found = await this.approvalsService.getById(db, authContext.organizationId, id)

      const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
      if (!granted.includes(found.action)) {
        throw new ForbiddenException({
          code: 'permission_denied',
          message: `resolving this approval requires permission: ${found.action}`,
        })
      }

      const result =
        outcome === 'approve'
          ? await this.approvalsService.approve(db, {
              id,
              organizationId: authContext.organizationId,
              approverActorId: authContext.actorId,
            })
          : await this.approvalsService.reject(db, {
              id,
              organizationId: authContext.organizationId,
              approverActorId: authContext.actorId,
            })

      return { existing: found, resolved: result }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: authContext.locationId ?? null,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: outcome === 'approve' ? 'approvals.approved' : 'approvals.rejected',
      entityType: existing.entityType,
      entityId: existing.id,
      reason: existing.action,
    })

    return resolved
  }
}
