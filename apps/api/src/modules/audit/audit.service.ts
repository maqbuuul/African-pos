import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { auditLogs, withTenantContext } from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'

export interface AuditListOptions {
  page: number
  limit: number
  entityType?: string
  action?: string
  actorId?: string
}

@Injectable()
export class AuditService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  async list(authContext: AuthContext, options: AuditListOptions) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const conditions = [eq(auditLogs.organizationId, authContext.organizationId)]

      if (options.entityType) conditions.push(eq(auditLogs.entityType, options.entityType))
      if (options.action) conditions.push(eq(auditLogs.action, options.action))
      if (options.actorId) conditions.push(eq(auditLogs.actorId, options.actorId))

      const offset = (options.page - 1) * options.limit

      const rows = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(options.limit)
        .offset(offset)

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(and(...conditions))

      return {
        data: rows,
        total: Number(countResult!.count),
        page: options.page,
        limit: options.limit,
      }
    })
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [log] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.id, id), eq(auditLogs.organizationId, authContext.organizationId)))
      if (!log) throw new NotFoundException('audit log not found')
      return log
    })
  }
}
