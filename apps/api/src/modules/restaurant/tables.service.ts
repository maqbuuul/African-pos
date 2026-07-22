import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  floorPlans,
  restaurantTables,
  staff,
  tableMerges,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import { TABLE_REOPEN_TRANSITIONS, TABLE_STATE_TRANSITIONS, type TableStatus } from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateTableDto } from './dto/create-table.dto.js'
import type { MergeTablesDto } from './dto/merge-tables.dto.js'
import type { TransferTableDto } from './dto/transfer-table.dto.js'
import type { UpdateTableDto } from './dto/update-table.dto.js'
import type { UpdateTableStatusDto } from './dto/update-table-status.dto.js'

const MANAGE_ANY_SECTION = 'tables:manage_any_section'
const BLOCK_PERMISSION = 'tables:block'

export interface ListTablesQuery {
  locationId?: string | undefined
  floorPlanId?: string | undefined
  section?: string | undefined
  status?: string | undefined
}

type TableRow = typeof restaurantTables.$inferSelect

@Injectable()
export class TablesService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
  ) {}

  async list(authContext: AuthContext, query: ListTablesQuery) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => {
      const conditions = [eq(restaurantTables.organizationId, authContext.organizationId)]
      if (query.locationId) conditions.push(eq(restaurantTables.locationId, query.locationId))
      if (query.floorPlanId) conditions.push(eq(restaurantTables.floorPlanId, query.floorPlanId))
      if (query.section) conditions.push(eq(restaurantTables.section, query.section))
      if (query.status) conditions.push(eq(restaurantTables.status, query.status))
      return db.select().from(restaurantTables).where(and(...conditions))
    })
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => this.loadTable(db, authContext.organizationId, id))
  }

  async create(authContext: AuthContext, dto: CreateTableDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      // RLS-scoped SELECT — a foreign-tenant floorPlanId is simply invisible
      // on this connection, same pattern as CategoriesService/ProductsService.
      const [floorPlan] = await db.select().from(floorPlans).where(eq(floorPlans.id, dto.floorPlanId))
      if (!floorPlan) throw new NotFoundException('floor plan not found')

      const [created] = await db
        .insert(restaurantTables)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          floorPlanId: dto.floorPlanId,
          label: dto.label,
          section: dto.section ?? null,
          capacity: dto.capacity ?? 4,
          shape: dto.shape ?? 'square',
          positionX: dto.positionX ?? 0,
          positionY: dto.positionY ?? 0,
        })
        .returning()
      if (!created) throw new Error('failed to create table')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'table.created',
      entityType: 'restaurant_table',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // Layout-only edit (label/section/capacity/shape/position) — applies
  // immediately, no publish step (PRD 04 "Floor plan editor").
  async update(authContext: AuthContext, id: string, dto: UpdateTableDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(restaurantTables)
        .set({
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.section !== undefined && { section: dto.section }),
          ...(dto.capacity !== undefined && { capacity: dto.capacity }),
          ...(dto.shape !== undefined && { shape: dto.shape }),
          ...(dto.positionX !== undefined && { positionX: dto.positionX }),
          ...(dto.positionY !== undefined && { positionY: dto.positionY }),
        })
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('table not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'table.updated',
      entityType: 'restaurant_table',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // Core table state machine (PRD 04 "Table state machine" + edge cases).
  // Illegal transitions are a domain BadRequestException, never a 500 (P4
  // acceptance gate).
  async setStatus(authContext: AuthContext, id: string, dto: UpdateTableStatusDto) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const table = await this.loadTable(db, authContext.organizationId, id)
      const from = table.status as TableStatus
      const to = dto.status as TableStatus

      const legal = TABLE_STATE_TRANSITIONS[from]
      if (!legal.includes(to)) {
        throw new BadRequestException({
          code: 'illegal_table_transition',
          message: `cannot transition table from "${from}" to "${to}"`,
          from,
          to,
        })
      }

      const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
      // Blocking/unblocking is its own permission (PRD 04 "Block a table" —
      // waiter: No); every other transition follows own-section-or-manager.
      if (to === 'blocked' || from === 'blocked') {
        if (!granted.includes(BLOCK_PERMISSION)) {
          throw new ForbiddenException({ code: 'permission_denied', message: `missing permission: ${BLOCK_PERMISSION}` })
        }
      } else {
        this.assertOwnSectionOrManager(granted, table, authContext)
      }

      const reopenKey = `${from}->${to}`
      const isReopen = TABLE_REOPEN_TRANSITIONS.has(reopenKey)
      if (isReopen && !dto.reason) {
        throw new BadRequestException({
          code: 'reopen_reason_required',
          message: 'reopening a table from bill/payment back to active service requires a reason (manager-visible flag)',
        })
      }

      let overCapacity = false
      const patch: Partial<TableRow> = { status: to }

      if (to === 'seated') {
        if (!dto.partySize) throw new BadRequestException({ code: 'party_size_required', message: 'partySize is required to seat a table' })
        patch.partySize = dto.partySize
        overCapacity = dto.partySize > table.capacity
        // Seating an available table with no assigned server claims it for
        // whoever seats it (PRD 04 Transfer workflow assumes a table always
        // has an assigned server once in service).
        if (!table.assignedStaffId && authContext.actorType === 'staff') {
          patch.assignedStaffId = authContext.actorId
        }
      } else if (to === 'available') {
        patch.partySize = null
        patch.assignedStaffId = null
      }

      const [updated] = await db
        .update(restaurantTables)
        .set(patch)
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new Error('failed to update table status')

      return { updated, from, to, isReopen, overCapacity }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.updated.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: result.isReopen ? 'table.status_reopened' : 'table.status_changed',
      entityType: 'restaurant_table',
      entityId: result.updated.id,
      oldValue: { status: result.from },
      newValue: { status: result.to },
      reason: dto.reason ?? null,
    })

    return { ...result.updated, overCapacity: result.overCapacity }
  }

  // Combines two tables into one logical order session (PRD 04). Table
  // identity is preserved — only a table_merges row links them — so a
  // post-merge split-by-seat bill (P5) can still attribute items correctly.
  async merge(authContext: AuthContext, dto: MergeTablesDto) {
    if (dto.primaryTableId === dto.mergedTableId) {
      throw new BadRequestException({ code: 'cannot_merge_table_into_itself', message: 'a table cannot be merged into itself' })
    }

    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const primary = await this.loadTable(db, authContext.organizationId, dto.primaryTableId)
      const merged = await this.loadTable(db, authContext.organizationId, dto.mergedTableId)

      const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
      this.assertOwnSectionOrManager(granted, primary, authContext)
      this.assertOwnSectionOrManager(granted, merged, authContext)

      const [activeMerge] = await db
        .select()
        .from(tableMerges)
        .where(and(eq(tableMerges.mergedTableId, merged.id), isNull(tableMerges.unmergedAt)))
      if (activeMerge) throw new BadRequestException({ code: 'table_already_merged', message: 'table is already part of an active merge' })

      const [created] = await db
        .insert(tableMerges)
        .values({
          organizationId: authContext.organizationId,
          locationId: primary.locationId,
          primaryTableId: primary.id,
          mergedTableId: merged.id,
          mergedByActorId: authContext.actorId,
        })
        .returning()
      if (!created) throw new Error('failed to create table merge')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'table.merged',
      entityType: 'table_merge',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // "Split" at the table-entity level (BUILD_WORKFLOW.md P4) is ending an
  // active merge — splitting a combined *bill* is PRD 05's job once the
  // order engine exists (PRD 04 Non-Goals).
  async unmerge(authContext: AuthContext, mergedTableId: string) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [activeMerge] = await db
        .select()
        .from(tableMerges)
        .where(
          and(
            eq(tableMerges.organizationId, authContext.organizationId),
            eq(tableMerges.mergedTableId, mergedTableId),
            isNull(tableMerges.unmergedAt),
          ),
        )
      if (!activeMerge) throw new NotFoundException('no active merge found for this table')

      const primary = await this.loadTable(db, authContext.organizationId, activeMerge.primaryTableId)
      const merged = await this.loadTable(db, authContext.organizationId, activeMerge.mergedTableId)
      const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
      this.assertOwnSectionOrManager(granted, primary, authContext)
      this.assertOwnSectionOrManager(granted, merged, authContext)

      const [updated] = await db
        .update(tableMerges)
        .set({ unmergedAt: sql`now()`, unmergedByActorId: authContext.actorId })
        .where(eq(tableMerges.id, activeMerge.id))
        .returning()
      if (!updated) throw new Error('failed to unmerge table')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'table.unmerged',
      entityType: 'table_merge',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  // Reassigns a table's server (PRD 04 Transfer workflow) — no order/table
  // state change, only the assigned-staff reference. Self-initiated handoff
  // is allowed for any tables:manage holder; reassigning a table currently
  // assigned to someone *else* needs tables:manage_any_section.
  async transfer(authContext: AuthContext, id: string, dto: TransferTableDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const table = await this.loadTable(db, authContext.organizationId, id)

      if (table.assignedStaffId && table.assignedStaffId !== authContext.actorId) {
        const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
        if (!granted.includes(MANAGE_ANY_SECTION)) {
          throw new ForbiddenException({
            code: 'permission_denied',
            message: `table is assigned to another staff member — missing permission: ${MANAGE_ANY_SECTION}`,
          })
        }
      }

      const [toStaff] = await db.select().from(staff).where(eq(staff.id, dto.toStaffId))
      if (!toStaff) throw new NotFoundException('staff member not found')

      const [updated] = await db
        .update(restaurantTables)
        .set({ assignedStaffId: dto.toStaffId })
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new Error('failed to transfer table')
      return { updated, fromStaffId: table.assignedStaffId }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.updated.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'table.transferred',
      entityType: 'restaurant_table',
      entityId: row.updated.id,
      oldValue: { assignedStaffId: row.fromStaffId },
      newValue: { assignedStaffId: row.updated.assignedStaffId },
    })

    return row.updated
  }

  private async loadTable(db: Db, organizationId: string, id: string) {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, id), eq(restaurantTables.organizationId, organizationId)))
    if (!table) throw new NotFoundException('table not found')
    return table
  }

  private assertOwnSectionOrManager(granted: string[], table: TableRow, authContext: AuthContext) {
    if (granted.includes(MANAGE_ANY_SECTION)) return
    if (table.assignedStaffId && table.assignedStaffId !== authContext.actorId) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: `table is assigned to another staff member — missing permission: ${MANAGE_ANY_SECTION}`,
      })
    }
  }
}
