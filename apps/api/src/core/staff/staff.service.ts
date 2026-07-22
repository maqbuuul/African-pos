import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { staff, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../audit/audit-log.service.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import type { AuthContext } from '../tenant/tenant.types.js'

@Injectable()
export class StaffService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async deactivate(authContext: AuthContext, staffId: string) {
    return this.setStatus(authContext, staffId, 'deactivated', 'staff.deactivated')
  }

  async reactivate(authContext: AuthContext, staffId: string) {
    return this.setStatus(authContext, staffId, 'active', 'staff.reactivated')
  }

  private async setStatus(
    authContext: AuthContext,
    staffId: string,
    status: 'active' | 'deactivated',
    auditAction: string,
  ) {
    // AuditLogService.record runs its own transaction — must happen after
    // this one commits, not nested inside it (see the same note on
    // AuthService.activateDevice).
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(staff)
        .set({ status })
        .where(and(eq(staff.id, staffId), eq(staff.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('staff member not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: auditAction,
      entityType: 'staff',
      entityId: row.id,
    })

    return row
  }
}
