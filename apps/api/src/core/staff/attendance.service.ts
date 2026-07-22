import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { Pool } from 'pg'
import { staffAttendance, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../audit/audit-log.service.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import type { AuthContext } from '../tenant/tenant.types.js'

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async clockIn(authContext: AuthContext, staffId: string, locationId: string) {
    const record = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const open = await db
        .select()
        .from(staffAttendance)
        .where(
          and(
            eq(staffAttendance.staffId, staffId),
            eq(staffAttendance.organizationId, authContext.organizationId),
            isNull(staffAttendance.clockOut),
          ),
        )
        .limit(1)
      if (open.length > 0) {
        throw new Error('staff member already has an open attendance record')
      }
      const [inserted] = await db
        .insert(staffAttendance)
        .values({
          organizationId: authContext.organizationId,
          locationId,
          staffId,
          recordedByActorId: authContext.actorId,
        })
        .returning()
      if (!inserted) throw new Error('failed to clock in')
      return inserted
    })
    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'attendance.clock_in',
      entityType: 'staff_attendance',
      entityId: record.id,
    })
    return record
  }

  async clockOut(authContext: AuthContext, staffId: string) {
    const record = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const open = await db
        .select()
        .from(staffAttendance)
        .where(
          and(
            eq(staffAttendance.staffId, staffId),
            eq(staffAttendance.organizationId, authContext.organizationId),
            isNull(staffAttendance.clockOut),
          ),
        )
        .limit(1)
      if (open.length === 0 || !open[0]) {
        throw new NotFoundException('no open attendance record found')
      }
      const current = open[0]
      const [updated] = await db
        .update(staffAttendance)
        .set({ clockOut: new Date(), status: 'clocked_out' })
        .where(eq(staffAttendance.id, current.id))
        .returning()
      if (!updated) throw new Error('failed to clock out')
      return updated
    })
    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: record.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'attendance.clock_out',
      entityType: 'staff_attendance',
      entityId: record.id,
    })
    return record
  }

  async findByStaff(authContext: AuthContext, staffId: string, limit = 20) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return db
        .select()
        .from(staffAttendance)
        .where(
          and(
            eq(staffAttendance.staffId, staffId),
            eq(staffAttendance.organizationId, authContext.organizationId),
          ),
        )
        .orderBy(staffAttendance.clockIn)
        .limit(limit)
    })
  }

  async findByLocation(authContext: AuthContext, locationId: string, limit = 50) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return db
        .select()
        .from(staffAttendance)
        .where(
          and(
            eq(staffAttendance.locationId, locationId),
            eq(staffAttendance.organizationId, authContext.organizationId),
          ),
        )
        .orderBy(staffAttendance.clockIn)
        .limit(limit)
    })
  }
}
