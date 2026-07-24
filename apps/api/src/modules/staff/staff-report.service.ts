import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { Pool } from 'pg'
import { staffPerformanceMetrics, withTenantContext } from '@hospitality-os/database'

import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'

@Injectable()
export class StaffReportService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  async performance(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, (db) =>
      db
        .select()
        .from(staffPerformanceMetrics)
        .where(
          and(
            eq(staffPerformanceMetrics.organizationId, authContext.organizationId),
            eq(staffPerformanceMetrics.locationId, locationId),
            gte(staffPerformanceMetrics.date, from.toISOString().split('T')[0]!),
            lte(staffPerformanceMetrics.date, to.toISOString().split('T')[0]!),
          ),
        )
        .orderBy(desc(staffPerformanceMetrics.date)),
    )
  }
}
