import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  floorPlans,
  restaurantTables,
  tableMerges,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import { TABLE_REOPEN_TRANSITIONS, TABLE_STATE_TRANSITIONS, type TableStatus } from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { StaffService } from '../../core/staff/staff.service.js'
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
    @Inject(StaffService) private readonly staffService: StaffService,
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

      // staff is staff-owned. Also now scopes to the table's own location
      // (previously unscoped by org/location) — a table's assigned server
      // belonging to a different location than the table itself isn't a
      // valid state, so this tightens a real gap rather than changing
      // intended behavior.
      await this.staffService.getActiveMember(db, authContext.organizationId, table.locationId, dto.toStaffId)

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

  async delete(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [existing] = await db
        .select()
        .from(restaurantTables)
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.organizationId, authContext.organizationId)))
      if (!existing) throw new NotFoundException('table not found')

      await db.delete(restaurantTables).where(eq(restaurantTables.id, id))
    })
  }

  private async loadTable(db: Db, organizationId: string, id: string) {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, id), eq(restaurantTables.organizationId, organizationId)))
    if (!table) throw new NotFoundException('table not found')
    return table
  }

  // ---------------------------------------------------------------------------
  // db-first: callable from another module's already-open transaction (e.g.
  // OrdersService/KdsService cascading a table's status/assignment as a
  // side effect of an order event), never opens its own withTenantContext.
  // ---------------------------------------------------------------------------

  async getByIdInTx(db: Db, organizationId: string, id: string) {
    return this.loadTable(db, organizationId, id)
  }

  // Best-effort: silently leaves the table alone when its current status
  // doesn't legally allow `status` (matches the pre-existing inline
  // behavior at orders.service.ts's fire/split call sites — a second course
  // fired after the table is already 'ordered' shouldn't error).
  async setStatusInTx(db: Db, organizationId: string, tableId: string, status: TableStatus) {
    const [table] = await db
      .select()
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.organizationId, organizationId)))
    if (!table || !TABLE_STATE_TRANSITIONS[table.status as TableStatus]?.includes(status)) return table
    const [updated] = await db.update(restaurantTables).set({ status }).where(eq(restaurantTables.id, tableId)).returning()
    return updated
  }

  async assignOrder(db: Db, organizationId: string, tableId: string, orderId: string | null) {
    await db
      .update(restaurantTables)
      .set({ orderId })
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.organizationId, organizationId)))
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

  // ---------------------------------------------------------------------------
  // db-first — cross-module helpers for QrOrderService, which owns no tables
  // of its own (see qr-order.module.ts's `owns: []`). restaurant_tables is
  // restaurant-owned.
  // ---------------------------------------------------------------------------

  // Deliberately org-less: a QR scan only has the slug, and the organization
  // isn't known until the table is found — mirrors the pre-existing
  // org-less withTenantContext qr-order.service.ts already opened for this.
  async findByQrSlug(db: Db, qrSlug: string): Promise<TableRow | null> {
    const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.qrSlug, qrSlug)).limit(1)
    return table ?? null
  }

  async utilizationReport(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [statusBreakdown, occupancyStats] = await Promise.all([
        db
          .select({
            status: restaurantTables.status,
            section: restaurantTables.section,
            count: sql<number>`COUNT(*)`,
            totalCapacity: sql<number>`SUM(${restaurantTables.capacity})`,
            occupiedCapacity: sql<number>`COALESCE(SUM(${restaurantTables.partySize}), 0)`,
          })
          .from(restaurantTables)
          .where(and(eq(restaurantTables.organizationId, authContext.organizationId), eq(restaurantTables.locationId, locationId)))
          .groupBy(restaurantTables.status, restaurantTables.section)
          .orderBy(restaurantTables.status, restaurantTables.section),
        db
          .select({
            section: restaurantTables.section,
            totalTables: sql<number>`COUNT(*)`,
            occupiedTables: sql<number>`COUNT(*) FILTER (WHERE ${restaurantTables.status} = 'occupied')`,
            availableTables: sql<number>`COUNT(*) FILTER (WHERE ${restaurantTables.status} = 'available')`,
            reservedTables: sql<number>`COUNT(*) FILTER (WHERE ${restaurantTables.status} = 'reserved')`,
            totalCapacity: sql<number>`SUM(${restaurantTables.capacity})`,
            currentGuests: sql<number>`COALESCE(SUM(${restaurantTables.partySize}), 0)`,
          })
          .from(restaurantTables)
          .where(and(eq(restaurantTables.organizationId, authContext.organizationId), eq(restaurantTables.locationId, locationId)))
          .groupBy(restaurantTables.section),
      ])
      return { statusBreakdown, occupancyStats }
    })
  }
}
