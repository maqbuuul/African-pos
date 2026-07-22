import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { Pool } from 'pg'
import { withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../audit/audit-log.service.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import { ApprovalRequiredException } from '../errors/approval-required.exception.js'
import { ApprovalsService } from './approvals.service.js'
import { PERMISSION_KEY, type RequiredPermission } from './require-permission.decorator.js'
import { PermissionsService } from './permissions.service.js'

// Header a client sends when retrying a request that previously came back
// 202 (approval pending), once a manager has approved it — see
// ApprovalsService.tryConsume for why this is safe to spend only once.
const APPROVAL_HEADER = 'x-approval-request-id'

@Injectable()
export class PermissionsGuard implements CanActivate {
  // Explicit @Inject rather than bare constructor-param inference: under
  // tsx/esbuild, emitDecoratorMetadata's `design:paramtypes` isn't reliably
  // emitted for undecorated params, and Nest silently injects `undefined`
  // instead of failing loudly.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission | undefined>(PERMISSION_KEY, context.getHandler())
    if (!required) return true

    const request = context.switchToHttp().getRequest<Request>()
    const authContext = request.authContext
    if (!authContext) throw new UnauthorizedException()

    const granted = await withTenantContext(this.pool, authContext.organizationId, (db) =>
      this.permissionsService.listGrantedPermissions(db, authContext),
    )

    if (granted.includes(required.permission)) return true

    // Actor lacks the permission outright. If a prior override for this
    // exact (staff, action) pair was approved and not yet spent, the
    // approval header lets the retry through — one approval, one retry.
    const approvalHeader = request.headers[APPROVAL_HEADER]
    const approvalRequestId = Array.isArray(approvalHeader) ? approvalHeader[0] : approvalHeader
    if (required.allowOverride && approvalRequestId) {
      const consumed = await withTenantContext(this.pool, authContext.organizationId, (db) =>
        this.approvalsService.tryConsume(db, {
          id: approvalRequestId,
          organizationId: authContext.organizationId,
          requestedByActorId: authContext.actorId,
          action: required.permission,
        }),
      )
      if (consumed) {
        await this.auditLog.record({
          organizationId: authContext.organizationId,
          locationId: authContext.locationId ?? null,
          actorType: authContext.actorType,
          actorId: authContext.actorId,
          action: 'permissions.override_consumed',
          entityType: required.entityType ?? null,
          entityId: consumed.id,
          reason: required.permission,
        })
        return true
      }
      // Header present but stale/foreign/already-spent — fall through to
      // the normal deny/override-request path below rather than trusting it.
    }

    if (required.allowOverride) {
      const entityId = typeof request.params?.['id'] === 'string' ? request.params['id'] : null
      const approval = await withTenantContext(this.pool, authContext.organizationId, (db) =>
        this.approvalsService.create(db, {
          organizationId: authContext.organizationId,
          locationId: authContext.locationId ?? null,
          requestedByActorId: authContext.actorId,
          action: required.permission,
          entityType: required.entityType ?? null,
          entityId,
        }),
      )
      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: authContext.locationId ?? null,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'permissions.override_requested',
        entityType: required.entityType ?? null,
        entityId,
        reason: required.permission,
      })
      throw new ApprovalRequiredException(approval.id)
    }

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: authContext.locationId ?? null,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'permissions.denied',
      reason: required.permission,
    })
    throw new ForbiddenException({
      code: 'permission_denied',
      message: `missing permission: ${required.permission}`,
    })
  }
}
