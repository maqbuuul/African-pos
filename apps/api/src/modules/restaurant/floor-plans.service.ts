import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { floorPlans, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateFloorPlanDto } from './dto/create-floor-plan.dto.js'
import type { UpdateFloorPlanDto } from './dto/update-floor-plan.dto.js'

@Injectable()
export class FloorPlansService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async list(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => {
      const where = locationId
        ? and(eq(floorPlans.organizationId, authContext.organizationId), eq(floorPlans.locationId, locationId))
        : eq(floorPlans.organizationId, authContext.organizationId)
      return db.select().from(floorPlans).where(where)
    })
  }

  async create(authContext: AuthContext, dto: CreateFloorPlanDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [created] = await db
        .insert(floorPlans)
        .values({ organizationId: authContext.organizationId, locationId: dto.locationId, name: dto.name })
        .returning()
      if (!created) throw new Error('failed to create floor plan')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'floor_plan.created',
      entityType: 'floor_plan',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // Layout edits apply immediately, no publish step (PRD 04: "this isn't a
  // high-risk change needing a review gate").
  async update(authContext: AuthContext, id: string, dto: UpdateFloorPlanDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(floorPlans)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(and(eq(floorPlans.id, id), eq(floorPlans.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('floor plan not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'floor_plan.updated',
      entityType: 'floor_plan',
      entityId: row.id,
      newValue: row,
    })

    return row
  }
}
