import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  cashDrawerAdjustments,
  cashDrawerSessions,
  orders,
  paymentIntents,
  payments,
  refunds,
  shifts,
  syncOperations,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import {
  SHIFT_STATUS_TRANSITIONS,
  type ShiftStatus,
} from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { StaffNotificationsService } from '../notifications/staff-notifications.service.js'
import type { AdjustDrawerDto } from './dto/adjust-drawer.dto.js'
import type { CloseShiftDto } from './dto/close-shift.dto.js'
import type { OpenShiftDto } from './dto/open-shift.dto.js'

const VARIANCE_THRESHOLD_KEY = 'cash_variance_threshold'

@Injectable()
export class ShiftsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(StaffNotificationsService) private readonly staffNotifications: StaffNotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Open a shift — creates shift + cash_drawer_session.
  // PRD 08: one active shift per device at a time. A staff member can open a
  // shift on a device only if no open shift exists for that device+org.
  // ---------------------------------------------------------------------------
  async open(authContext: AuthContext, dto: OpenShiftDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      if (dto.deviceId) {
        const [openShift] = await db
          .select()
          .from(shifts)
          .where(
            and(
              eq(shifts.organizationId, authContext.organizationId),
              eq(shifts.deviceId, dto.deviceId),
              eq(shifts.status, 'open'),
            ),
          )
        if (openShift) {
          throw new BadRequestException({
            code: 'shift_already_open',
            message: 'A shift is already open on this device',
          })
        }
      }

      const [shift] = await db
        .insert(shifts)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          deviceId: dto.deviceId ?? null,
          openedByStaffId: authContext.actorId,
          startingCashAmount: dto.startingCashAmount,
          currency: dto.currency,
        })
        .returning()
      if (!shift) throw new Error('failed to create shift')

      const [session] = await db
        .insert(cashDrawerSessions)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          shiftId: shift.id,
          startingAmount: dto.startingCashAmount,
          currency: dto.currency,
        })
        .returning()
      if (!session) throw new Error('failed to create cash drawer session')

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: dto.locationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'shift.opened',
        entityType: 'shift',
        entityId: shift.id,
        newValue: { startingCashAmount: dto.startingCashAmount, deviceId: dto.deviceId ?? null },
      })

      return { shift, session }
    })
  }

  // ---------------------------------------------------------------------------
  // Close a shift — count drawer, compute variance, variance > threshold
  // requires reason (PRD 08). Generates and stores close_report snapshot.
  // ---------------------------------------------------------------------------
  async close(authContext: AuthContext, shiftId: string, dto: CloseShiftDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const shift = await this.loadShift(db, authContext.organizationId, shiftId)
      if (shift.status !== 'open') {
        throw new BadRequestException({
          code: 'shift_not_open',
          message: `Cannot close a shift in status "${shift.status}"`,
        })
      }

      const allowed = SHIFT_STATUS_TRANSITIONS[shift.status as ShiftStatus]
      if (!allowed.includes('closing')) {
        throw new BadRequestException({
          code: 'illegal_shift_transition',
          message: `Cannot transition shift from "${shift.status}" to closing`,
        })
      }

      if (!dto.force) {
        const blocking: string[] = []

        const openOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.locationId, shift.locationId),
              eq(orders.organizationId, authContext.organizationId),
              ne(orders.status, 'paid'),
              ne(orders.status, 'voided'),
              ne(orders.status, 'refunded'),
            ),
          )
          .limit(1)
        if (openOrders.length > 0) blocking.push('open_orders')

        const pendingPayments = await db
          .select({ id: paymentIntents.id })
          .from(paymentIntents)
          .where(
            and(
              eq(paymentIntents.locationId, shift.locationId),
              eq(paymentIntents.organizationId, authContext.organizationId),
              inArray(paymentIntents.status, ['pending', 'processing']),
            ),
          )
          .limit(1)
        if (pendingPayments.length > 0) blocking.push('pending_payments')

        const [session] = await db
          .select()
          .from(cashDrawerSessions)
          .where(
            and(
              eq(cashDrawerSessions.shiftId, shiftId),
              eq(cashDrawerSessions.organizationId, authContext.organizationId),
            ),
          )
        if (session && session.countedAmount === null) blocking.push('uncounted_drawer')

        const unsynced = await db
          .select({ id: syncOperations.id })
          .from(syncOperations)
          .where(
            and(
              eq(syncOperations.organizationId, authContext.organizationId),
              eq(syncOperations.status, 'pending'),
            ),
          )
          .limit(1)
        if (unsynced.length > 0) blocking.push('unsynced_events')

        if (blocking.length > 0) {
          throw new BadRequestException({
            code: 'shift_close_blocked',
            message: `Cannot close shift: ${blocking.join(', ')}. Use force=true to override.`,
            blocking,
          })
        }
      }

      await db
        .update(shifts)
        .set({ status: 'closing', updatedAt: sql`now()` })
        .where(eq(shifts.id, shiftId))

      const cashMetrics = await this.computeCashMetrics(db, authContext.organizationId, shiftId)
      const expectedAmount = cashMetrics.expectedCash
      const countedAmount = dto.countedAmount
      const variance = countedAmount - expectedAmount

      const threshold = await this.getVarianceThreshold(
        db,
        authContext.organizationId,
        shift.locationId,
      )
      const exceedsThreshold = Math.abs(variance) > threshold

      if (exceedsThreshold && !dto.varianceReason) {
        throw new BadRequestException({
          code: 'variance_requires_reason',
          message: `Cash variance of ${variance} ${shift.currency} exceeds threshold of ${threshold}. Provide a variance reason to close.`,
        })
      }

      const paymentBreakdown = await this.computePaymentBreakdown(
        db,
        authContext.organizationId,
        shiftId,
      )

      const closeReport = {
        ...cashMetrics,
        variance,
        varianceThreshold: threshold,
        paymentBreakdown,
        closedAt: new Date().toISOString(),
        closedBy: authContext.actorId,
      }

      await db
        .update(shifts)
        .set({
          status: 'closed',
          closedAt: sql`now()`,
          closedByActorId: authContext.actorId,
          closeReport,
          varianceReason: dto.varianceReason ?? null,
          varianceAcknowledgedByActorId:
            exceedsThreshold && dto.varianceReason ? authContext.actorId : null,
          updatedAt: sql`now()`,
        })
        .where(eq(shifts.id, shiftId))

      await db
        .update(cashDrawerSessions)
        .set({
          countedAmount,
          denominationCount: dto.denominationCount ?? null,
          status: 'closed',
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(cashDrawerSessions.shiftId, shiftId),
            eq(cashDrawerSessions.organizationId, authContext.organizationId),
          ),
        )

      const [drawerSession] = await db
        .select()
        .from(cashDrawerSessions)
        .where(
          and(
            eq(cashDrawerSessions.shiftId, shiftId),
            eq(cashDrawerSessions.organizationId, authContext.organizationId),
          ),
        )

      const changeErrorAlert = drawerSession != null && drawerSession.changeErrorCount >= 3
      if (changeErrorAlert) {
        await this.staffNotifications.create(db, {
          organizationId: authContext.organizationId,
          locationId: shift.locationId,
          notificationType: 'change_error_alert',
          message: `Cashier made ${drawerSession.changeErrorCount} change-calculation errors this shift (shift ${shiftId}). Manager review recommended.`,
        })
      }

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: shift.locationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'shift.closed',
        entityType: 'shift',
        entityId: shiftId,
        newValue: {
          expectedAmount,
          countedAmount,
          variance,
          exceedsThreshold,
          varianceReason: dto.varianceReason ?? null,
          changeErrorCount: drawerSession?.changeErrorCount ?? 0,
          changeErrorAlert,
        },
      })

      return { shift: { ...shift, status: 'closed', closeReport }, variance, changeErrorAlert }
    })
  }

  // ---------------------------------------------------------------------------
  // Get the active (open) shift for a device — returns null if none.
  // ---------------------------------------------------------------------------
  async getActive(authContext: AuthContext, locationId: string, deviceId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const conditions = [
        eq(shifts.organizationId, authContext.organizationId),
        eq(shifts.locationId, locationId),
        eq(shifts.status, 'open'),
      ]
      if (deviceId) {
        conditions.push(eq(shifts.deviceId, deviceId))
      }

      const [shift] = await db
        .select()
        .from(shifts)
        .where(and(...conditions))
        .orderBy(sql`${shifts.openedAt} DESC`)

      if (!shift) return null

      const [session] = await db
        .select()
        .from(cashDrawerSessions)
        .where(
          and(
            eq(cashDrawerSessions.shiftId, shift.id),
            eq(cashDrawerSessions.organizationId, authContext.organizationId),
          ),
        )

      return { shift, session: session ?? null }
    })
  }

  // ---------------------------------------------------------------------------
  // List shifts for a location (paginated, newest first).
  // ---------------------------------------------------------------------------
  async list(authContext: AuthContext, locationId: string, limit = 50, offset = 0) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return db
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.organizationId, authContext.organizationId),
            eq(shifts.locationId, locationId),
          ),
        )
        .orderBy(sql`${shifts.openedAt} DESC`)
        .limit(limit)
        .offset(offset)
    })
  }

  // ---------------------------------------------------------------------------
  // Get a specific shift by ID.
  // ---------------------------------------------------------------------------
  async getById(authContext: AuthContext, shiftId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return this.loadShift(db, authContext.organizationId, shiftId)
    })
  }

  // ---------------------------------------------------------------------------
  // Live P&L — computed fresh from ledger, never cached/stale.
  // Returns revenue, cash/non-cash split, totals for the shift so far.
  // ---------------------------------------------------------------------------
  async getLivePnl(authContext: AuthContext, shiftId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const shift = await this.loadShift(db, authContext.organizationId, shiftId)

      const cashMetrics = await this.computeCashMetrics(db, authContext.organizationId, shiftId)
      const paymentBreakdown = await this.computePaymentBreakdown(
        db,
        authContext.organizationId,
        shiftId,
      )

      return {
        shiftId: shift.id,
        locationId: shift.locationId,
        status: shift.status,
        openedAt: shift.openedAt,
        currency: shift.currency,
        ...cashMetrics,
        paymentBreakdown,
        computedAt: new Date().toISOString(),
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Close report — returns the stored snapshot for a closed shift.
  // ---------------------------------------------------------------------------
  async getCloseReport(authContext: AuthContext, shiftId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const shift = await this.loadShift(db, authContext.organizationId, shiftId)

      if (!shift.closeReport) {
        throw new BadRequestException({
          code: 'shift_not_closed',
          message: 'Close report is not available until the shift is closed',
        })
      }

      return {
        shift,
        closeReport: shift.closeReport,
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Mid-shift cash drawer adjustment (cash_drawer:adjust permission).
  // Recorded as its own entry — affects expected_cash going forward.
  // ---------------------------------------------------------------------------
  async adjustDrawer(authContext: AuthContext, shiftId: string, dto: AdjustDrawerDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const shift = await this.loadShift(db, authContext.organizationId, shiftId)
      if (shift.status !== 'open') {
        throw new BadRequestException({
          code: 'shift_not_open',
          message: 'Cannot adjust drawer on a shift that is not open',
        })
      }

      const [session] = await db
        .select()
        .from(cashDrawerSessions)
        .where(
          and(
            eq(cashDrawerSessions.shiftId, shiftId),
            eq(cashDrawerSessions.organizationId, authContext.organizationId),
          ),
        )
      if (!session) {
        throw new NotFoundException({
          code: 'cash_drawer_session_not_found',
          message: 'Cash drawer session not found for this shift',
        })
      }

      const [adjustment] = await db
        .insert(cashDrawerAdjustments)
        .values({
          organizationId: authContext.organizationId,
          locationId: shift.locationId,
          shiftId,
          sessionId: session.id,
          direction: dto.direction,
          amount: dto.amount,
          currency: dto.currency,
          reason: dto.reason,
          adjustedByActorId: authContext.actorId,
          approvedByActorId: authContext.actorId,
        })
        .returning()
      if (!adjustment) throw new Error('failed to create cash drawer adjustment')

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: shift.locationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'cash_drawer.adjusted',
        entityType: 'cash_drawer_adjustment',
        entityId: adjustment.id,
        newValue: {
          shiftId,
          direction: dto.direction,
          amount: dto.amount,
          reason: dto.reason,
        },
      })

      return adjustment
    })
  }

  // ---------------------------------------------------------------------------
  // Reopen a closed shift (manager-only, audited).
  // ---------------------------------------------------------------------------
  async reopen(authContext: AuthContext, shiftId: string, reason: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const shift = await this.loadShift(db, authContext.organizationId, shiftId)

      const allowed = SHIFT_STATUS_TRANSITIONS[shift.status as ShiftStatus]
      if (!allowed.includes('open')) {
        throw new BadRequestException({
          code: 'illegal_shift_transition',
          message: `Cannot reopen a shift in status "${shift.status}"`,
        })
      }

      const [updated] = await db
        .update(shifts)
        .set({
          status: 'open',
          closedAt: null,
          closedByActorId: null,
          closeReport: null,
          varianceReason: null,
          varianceAcknowledgedByActorId: null,
          updatedAt: sql`now()`,
        })
        .where(eq(shifts.id, shiftId))
        .returning()
      if (!updated) throw new Error('failed to reopen shift')

      await db
        .update(cashDrawerSessions)
        .set({
          countedAmount: null,
          denominationCount: null,
          status: 'open',
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(cashDrawerSessions.shiftId, shiftId),
            eq(cashDrawerSessions.organizationId, authContext.organizationId),
          ),
        )

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: shift.locationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'shift.reopened',
        entityType: 'shift',
        entityId: shiftId,
        reason,
      })

      return updated
    })
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async loadShift(db: Db, organizationId: string, shiftId: string) {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.organizationId, organizationId)))
    if (!shift) {
      throw new NotFoundException({ code: 'shift_not_found', message: 'Shift not found' })
    }
    return shift
  }

  private async computeCashMetrics(
    db: Db,
    organizationId: string,
    shiftId: string,
  ): Promise<{
    startingCash: number
    cashPayments: number
    cashRefunds: number
    cashAdjustmentsIn: number
    cashAdjustmentsOut: number
    expectedCash: number
    totalRevenue: number
    nonCashRevenue: number
  }> {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.organizationId, organizationId)))
    if (!shift) throw new Error('shift not found')

    const startingCash = shift.startingCashAmount

    const closedAt = shift.closedAt
    const closedAtFilter = closedAt
      ? sql`${orders.createdAt} <= ${closedAt}`
      : undefined

    const orderFilters = [eq(orders.organizationId, organizationId), sql`${orders.createdAt} >= ${shift.openedAt}`]
    if (closedAtFilter) orderFilters.push(closedAtFilter)

    const shiftOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(...orderFilters))
    const orderIds = shiftOrders.map((o) => o.id)

    let cashPayments = 0
    let nonCashRevenue = 0
    if (orderIds.length > 0) {
      const confirmedPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.status, 'confirmed'),
            inArray(payments.orderId, orderIds),
            eq(payments.organizationId, organizationId),
          ),
        )

      for (const p of confirmedPayments) {
        if (p.method === 'cash') {
          cashPayments += p.amount
        }
        nonCashRevenue += p.amount
      }

      const shiftRefunds = await db
        .select()
        .from(refunds)
        .where(
          and(
            eq(refunds.organizationId, organizationId),
            inArray(refunds.paymentId, confirmedPayments.map((p) => p.id)),
            inArray(refunds.status, ['confirmed', 'requires_manual_settlement']),
          ),
        )

      cashPayments -= shiftRefunds
        .filter((r) => r.method === 'cash')
        .reduce((sum, r) => sum + r.amount, 0)
    }

    const adjustments = await db
      .select()
      .from(cashDrawerAdjustments)
      .where(
        and(
          eq(cashDrawerAdjustments.shiftId, shiftId),
          eq(cashDrawerAdjustments.organizationId, organizationId),
        ),
      )

    let cashAdjustmentsIn = 0
    let cashAdjustmentsOut = 0
    for (const adj of adjustments) {
      if (adj.direction === 'in') {
        cashAdjustmentsIn += adj.amount
      } else {
        cashAdjustmentsOut += adj.amount
      }
    }

    const expectedCash =
      startingCash + cashPayments + cashAdjustmentsIn - cashAdjustmentsOut

    return {
      startingCash,
      cashPayments,
      cashRefunds: 0,
      cashAdjustmentsIn,
      cashAdjustmentsOut,
      expectedCash: Math.max(0, expectedCash),
      totalRevenue: nonCashRevenue,
      nonCashRevenue: nonCashRevenue - cashPayments,
    }
  }

  private async computePaymentBreakdown(
    db: Db,
    organizationId: string,
    shiftId: string,
  ): Promise<Record<string, { count: number; total: number }>> {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.organizationId, organizationId)))
    if (!shift) return {}

    const closedAt = shift.closedAt
    const closedAtFilter = closedAt
      ? sql`${orders.createdAt} <= ${closedAt}`
      : undefined

    const orderFilters = [eq(orders.organizationId, organizationId), sql`${orders.createdAt} >= ${shift.openedAt}`]
    if (closedAtFilter) orderFilters.push(closedAtFilter)

    const shiftOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(...orderFilters))
    const orderIds = shiftOrders.map((o) => o.id)

    if (orderIds.length === 0) return {}

    const confirmedPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'confirmed'),
          inArray(payments.orderId, orderIds),
          eq(payments.organizationId, organizationId),
        ),
      )

    const breakdown: Record<string, { count: number; total: number }> = {}
    for (const p of confirmedPayments) {
      let entry = breakdown[p.method]
      if (!entry) {
        entry = { count: 0, total: 0 }
        breakdown[p.method] = entry
      }
      entry.count++
      entry.total += p.amount
    }

    return breakdown
  }

  private async getVarianceThreshold(
    db: Db,
    organizationId: string,
    locationId: string,
  ): Promise<number> {
    const { TenantSettingsService } = await import(
      '../../core/tenant/tenant-settings.service.js'
    )
    const settingsService = new TenantSettingsService()
    const raw = await settingsService.get<string>(
      db,
      organizationId,
      VARIANCE_THRESHOLD_KEY,
      '{"amount":500,"currency":"KES"}',
      locationId,
    )
    const parsed = JSON.parse(raw) as { amount?: number }
    return parsed?.amount ?? 500
  }
}
