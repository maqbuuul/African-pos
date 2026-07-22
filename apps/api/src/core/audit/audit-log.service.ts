import { Inject, Injectable } from '@nestjs/common'
import type { Pool } from 'pg'
import { auditLogs, withTenantContext } from '@hospitality-os/database'

import { APP_POOL } from '../tenant/tenant.constants.js'
import type { ActorType } from '../tenant/tenant.types.js'

export interface AuditLogEntry {
  organizationId: string
  locationId?: string | null
  actorType: ActorType | 'system'
  actorId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
  deviceId?: string | null
  ipAddress?: string | null
}

// Writes to the immutable audit trail (see the shared_foundation migration:
// audit_logs has no UPDATE/DELETE policy and a trigger that rejects both
// outright). Every destructive or sensitive action — refunds, voids,
// discounts, price overrides, exports, role changes, auth events — must call
// this per Engineering Charter, no exceptions for "the admin did it".
@Injectable()
export class AuditLogService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  async record(entry: AuditLogEntry): Promise<void> {
    await withTenantContext(this.pool, entry.organizationId, async (db) => {
      await db.insert(auditLogs).values({
        organizationId: entry.organizationId,
        locationId: entry.locationId ?? null,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        reason: entry.reason ?? null,
        deviceId: entry.deviceId ?? null,
        ipAddress: entry.ipAddress ?? null,
      })
    })
  }
}
