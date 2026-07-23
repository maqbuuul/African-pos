import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  kitchenTicketItems,
  kitchenTickets,
  kdsStations,
  menuCategories,
  orderDiscounts,
  orderItems,
  orders,
  products,
  restaurantTables,
  staff,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import {
  KDS_TICKET_ITEM_STATUS_TRANSITIONS,
  ORDER_ITEM_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS,
  TABLE_STATE_TRANSITIONS,
  type KdsTicketItemStatus,
  type OrderItemStatus,
  type OrderStatus,
  type TableStatus,
} from '@hospitality-os/domain'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateKdsStationDto } from './dto/create-kds-station.dto.js'
import type { UpdateKdsStationDto } from './dto/update-kds-station.dto.js'

const VIEW_PERMISSION = 'kds:view'
const MANAGE_STATIONS_PERMISSION = 'kds:manage_stations'
const BUMP_OWN_PERMISSION = 'kds:bump_own_station'
const BUMP_ANY_PERMISSION = 'kds:bump_any_station'
const RECALL_OWN_PERMISSION = 'kds:recall_own_station'
const RECALL_ANY_PERMISSION = 'kds:recall_any_station'
const VIEW_ANALYTICS_PERMISSION = 'kds:view_analytics'

const ATTENTION_REGEX = /(allerg|no\s+nuts|nut\b|gluten|dairy|shellfish|egg\b|sesame|peanut)/i

type KdsStationRow = typeof kdsStations.$inferSelect
type KitchenTicketRow = typeof kitchenTickets.$inferSelect
type KitchenTicketItemRow = typeof kitchenTicketItems.$inferSelect
type OrderRow = typeof orders.$inferSelect
type OrderItemRow = typeof orderItems.$inferSelect

@Injectable()
export class KdsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
  ) {}

  async listStations(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, VIEW_PERMISSION)
      const effectiveLocationId = locationId ?? authContext.locationId
      const conditions = [eq(kdsStations.organizationId, authContext.organizationId)]
      if (effectiveLocationId) conditions.push(eq(kdsStations.locationId, effectiveLocationId))
      return db.select().from(kdsStations).where(and(...conditions))
    })
  }

  async createStation(authContext: AuthContext, dto: CreateKdsStationDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, MANAGE_STATIONS_PERMISSION)
      if (dto.assignedStaffId) await this.loadAssignableStaff(db, authContext.organizationId, dto.locationId, dto.assignedStaffId)

      const [created] = await db
        .insert(kdsStations)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          assignedStaffId: dto.assignedStaffId ?? null,
          isExpo: dto.isExpo ?? false,
          expectedPrepTimeSeconds: dto.expectedPrepTimeSeconds ?? 900,
          recallGraceSeconds: dto.recallGraceSeconds ?? 120,
          sortOrder: dto.sortOrder ?? 0,
        })
        .returning()
      if (!created) throw new Error('failed to create KDS station')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'kds.station_created',
      entityType: 'kds_station',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async updateStation(authContext: AuthContext, stationId: string, dto: UpdateKdsStationDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, MANAGE_STATIONS_PERMISSION)
      const station = await this.loadStation(db, authContext.organizationId, stationId)
      if (dto.assignedStaffId) {
        await this.loadAssignableStaff(db, authContext.organizationId, station.locationId, dto.assignedStaffId)
      }

      const [updated] = await db
        .update(kdsStations)
        .set({
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.assignedStaffId !== undefined && { assignedStaffId: dto.assignedStaffId }),
          ...(dto.isExpo !== undefined && { isExpo: dto.isExpo }),
          ...(dto.expectedPrepTimeSeconds !== undefined && { expectedPrepTimeSeconds: dto.expectedPrepTimeSeconds }),
          ...(dto.recallGraceSeconds !== undefined && { recallGraceSeconds: dto.recallGraceSeconds }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(eq(kdsStations.id, stationId))
        .returning()
      if (!updated) throw new Error('failed to update KDS station')
      return { before: station, after: updated }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.after.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'kds.station_updated',
      entityType: 'kds_station',
      entityId: row.after.id,
      oldValue: row.before,
      newValue: row.after,
    })

    return row.after
  }

  async listStationTickets(authContext: AuthContext, stationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const station = await this.loadStation(db, authContext.organizationId, stationId)
      await this.assertPermission(db, authContext, VIEW_PERMISSION)

      const tickets = await db
        .select()
        .from(kitchenTickets)
        .where(and(eq(kitchenTickets.stationId, stationId), ne(kitchenTickets.status, 'voided')))

      const ticketIds = tickets.map((ticket) => ticket.id)
      const items = ticketIds.length
        ? await db
            .select()
            .from(kitchenTicketItems)
            .where(inArray(kitchenTicketItems.ticketId, ticketIds))
        : []

      const ticketsWithItems = tickets
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((ticket) => {
          const ticketItems = items
            .filter((item) => item.ticketId === ticket.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((item) => this.serializeTicketItem(item))
          return {
            ...ticket,
            ageSeconds: this.ageSeconds(ticket.createdAt),
            readyItems: ticketItems.filter((item) => item.status === 'ready').length,
            totalItems: ticketItems.length,
            items: ticketItems,
          }
        })

      return {
        station,
        tickets: ticketsWithItems,
        batches: this.buildStationBatches(items),
      }
    })
  }

  async getPrintableTickets(authContext: AuthContext, stationId: string) {
    const queue = await this.listStationTickets(authContext, stationId)
    const printableLines = [
      `Station: ${queue.station.name} (${queue.station.code})`,
      `Generated: ${new Date().toISOString()}`,
      '',
      ...queue.tickets.flatMap((ticket, ticketIndex) => [
        `Ticket ${ticketIndex + 1} — order ${ticket.orderId}${ticket.tableId ? ` — table ${ticket.tableId}` : ''}`,
        `Age: ${ticket.ageSeconds}s | Status: ${ticket.status}`,
        ...ticket.items.map(
          (item) =>
            `- ${item.quantity}x ${item.nameSnapshot}${item.seatNumber !== null ? ` (seat ${item.seatNumber})` : ''}${item.course ? ` [${item.course}]` : ''}${item.kitchenNote ? ` :: ${item.kitchenNote}` : ''}`,
        ),
        '',
      ]),
    ]

    return {
      station: queue.station,
      tickets: queue.tickets,
      printableText: printableLines.join('\n').trim(),
    }
  }

  async getExpoView(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, VIEW_PERMISSION)
      const effectiveLocationId = locationId ?? authContext.locationId
      if (!effectiveLocationId) {
        throw new BadRequestException({ code: 'location_required', message: 'locationId is required for expo view' })
      }

      const tickets = await db
        .select()
        .from(kitchenTickets)
        .where(and(eq(kitchenTickets.organizationId, authContext.organizationId), eq(kitchenTickets.locationId, effectiveLocationId), ne(kitchenTickets.status, 'voided')))

      const ticketIds = tickets.map((ticket) => ticket.id)
      const stationIds = [...new Set(tickets.map((ticket) => ticket.stationId))]
      const tableIds = [...new Set(tickets.map((ticket) => ticket.tableId).filter((value): value is string => Boolean(value)))]
      const items = ticketIds.length
        ? await db.select().from(kitchenTicketItems).where(inArray(kitchenTicketItems.ticketId, ticketIds))
        : []
      const stations = stationIds.length ? await db.select().from(kdsStations).where(inArray(kdsStations.id, stationIds)) : []
      const tables = tableIds.length ? await db.select().from(restaurantTables).where(inArray(restaurantTables.id, tableIds)) : []

      const stationById = new Map(stations.map((row) => [row.id, row]))
      const tableById = new Map(tables.map((row) => [row.id, row]))
      const groups = new Map<string, {
        orderId: string
        tableId: string | null
        locationId: string
        oldestFiredAt: Date
        stationSummaries: Array<{
          stationId: string
          stationCode: string
          stationName: string
          ticketId: string
          status: string
          readyItems: number
          totalItems: number
        }>
      }>()

      for (const ticket of tickets) {
        const key = `${ticket.orderId}:${ticket.tableId ?? 'walkin'}`
        const station = stationById.get(ticket.stationId)
        if (!station) continue
        const ticketItems = items.filter((item) => item.ticketId === ticket.id)
        const readyItems = ticketItems.filter((item) => item.status === 'ready').length
        const entry = groups.get(key) ?? {
          orderId: ticket.orderId,
          tableId: ticket.tableId,
          locationId: ticket.locationId,
          oldestFiredAt: ticket.createdAt,
          stationSummaries: [],
        }
        if (ticket.createdAt < entry.oldestFiredAt) entry.oldestFiredAt = ticket.createdAt
        entry.stationSummaries.push({
          stationId: station.id,
          stationCode: station.code,
          stationName: station.name,
          ticketId: ticket.id,
          status: ticket.status,
          readyItems,
          totalItems: ticketItems.length,
        })
        groups.set(key, entry)
      }

      return [...groups.values()]
        .map((entry) => ({
          orderId: entry.orderId,
          tableId: entry.tableId,
          tableLabel: entry.tableId ? tableById.get(entry.tableId)?.label ?? null : null,
          oldestFiredAt: entry.oldestFiredAt,
          ageSeconds: this.ageSeconds(entry.oldestFiredAt),
          fullyReady: entry.stationSummaries.length > 0 && entry.stationSummaries.every((station) => station.status === 'ready'),
          stations: entry.stationSummaries.sort((a, b) => a.stationName.localeCompare(b.stationName)),
        }))
        .sort((a, b) => b.ageSeconds - a.ageSeconds)
    })
  }

  async acceptTicketItem(authContext: AuthContext, ticketItemId: string) {
    return this.transitionTicketItem(authContext, ticketItemId, 'accepted', 'kds.ticket_item_accepted')
  }

  async startTicketItem(authContext: AuthContext, ticketItemId: string) {
    return this.transitionTicketItem(authContext, ticketItemId, 'in_progress', 'kds.ticket_item_started')
  }

  async bumpTicketItem(authContext: AuthContext, ticketItemId: string) {
    return this.transitionTicketItem(authContext, ticketItemId, 'ready', 'kds.ticket_item_bumped')
  }

  async bumpTicket(authContext: AuthContext, ticketId: string) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const ticket = await this.loadTicket(db, authContext.organizationId, ticketId)
      const station = await this.loadStation(db, authContext.organizationId, ticket.stationId)
      await this.assertStationActionPermission(db, authContext, station, BUMP_OWN_PERMISSION, BUMP_ANY_PERMISSION)

      const items = await db
        .select()
        .from(kitchenTicketItems)
        .where(and(eq(kitchenTicketItems.ticketId, ticketId), ne(kitchenTicketItems.status, 'ready'), ne(kitchenTicketItems.status, 'voided')))
      if (items.length === 0) {
        throw new BadRequestException({ code: 'ticket_already_bumped', message: 'all active items on this ticket are already ready' })
      }

      for (const item of items) {
        this.assertLegalTicketItemTransition(item.status as KdsTicketItemStatus, 'ready')
        const orderItem = await this.loadOrderItem(db, authContext.organizationId, item.orderItemId)
        this.assertLegalOrderItemTransition(orderItem.status as OrderItemStatus, 'ready')
      }

      await db
        .update(kitchenTicketItems)
        .set({
          status: 'ready',
          startedAt: new Date(),
          readyAt: new Date(),
        })
        .where(and(eq(kitchenTicketItems.ticketId, ticketId), ne(kitchenTicketItems.status, 'ready'), ne(kitchenTicketItems.status, 'voided')))

      const refreshedItems = await db.select().from(kitchenTicketItems).where(eq(kitchenTicketItems.ticketId, ticketId))
      const orderItemIds = [...new Set(refreshedItems.map((item) => item.orderItemId))]
      for (const orderItemId of orderItemIds) {
        await this.syncOrderItemFromKitchen(db, orderItemId)
      }
      await this.refreshTicketOrderAndTableState(db, ticketId, ticket.orderId)
      return { ticket, readyCount: items.length }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.ticket.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'kds.ticket_bumped',
      entityType: 'kitchen_ticket',
      entityId: result.ticket.id,
      newValue: { readyCount: result.readyCount },
    })

    return { ticketId: result.ticket.id, readyCount: result.readyCount }
  }

  async recallTicketItem(authContext: AuthContext, ticketItemId: string) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const ticketItem = await this.loadTicketItem(db, authContext.organizationId, ticketItemId)
      const station = await this.loadStation(db, authContext.organizationId, ticketItem.stationId)
      await this.assertStationActionPermission(db, authContext, station, RECALL_OWN_PERMISSION, RECALL_ANY_PERMISSION)

      if (ticketItem.status !== 'ready') {
        throw new BadRequestException({ code: 'ticket_item_not_ready', message: 'only ready ticket items can be recalled' })
      }
      if (!ticketItem.readyAt) {
        throw new BadRequestException({ code: 'missing_ready_timestamp', message: 'ticket item has no ready timestamp to recall from' })
      }
      const elapsedSeconds = this.ageSeconds(ticketItem.readyAt)
      if (elapsedSeconds > station.recallGraceSeconds) {
        throw new BadRequestException({
          code: 'recall_window_expired',
          message: `recall window expired after ${station.recallGraceSeconds} seconds`,
        })
      }

      this.assertLegalTicketItemTransition('ready', 'in_progress')
      this.assertLegalOrderItemTransition('ready', 'in_progress')

      const [updated] = await db
        .update(kitchenTicketItems)
        .set({ status: 'in_progress', recalledAt: new Date(), readyAt: null })
        .where(eq(kitchenTicketItems.id, ticketItemId))
        .returning()
      if (!updated) throw new Error('failed to recall kitchen ticket item')

      await this.syncOrderItemFromKitchen(db, updated.orderItemId)
      await this.refreshTicketOrderAndTableState(db, updated.ticketId, updated.orderId)
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'kds.ticket_item_recalled',
      entityType: 'kitchen_ticket_item',
      entityId: result.id,
    })

    return this.serializeTicketItem(result)
  }

  async acknowledgeVoid(authContext: AuthContext, ticketItemId: string) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const ticketItem = await this.loadTicketItem(db, authContext.organizationId, ticketItemId)
      const station = await this.loadStation(db, authContext.organizationId, ticketItem.stationId)
      await this.assertStationActionPermission(db, authContext, station, BUMP_OWN_PERMISSION, BUMP_ANY_PERMISSION)

      if (ticketItem.status !== 'void_requested') {
        throw new BadRequestException({ code: 'void_not_pending', message: 'ticket item is not awaiting kitchen void acknowledgment' })
      }

      this.assertLegalTicketItemTransition('void_requested', 'voided')
      const [updated] = await db
        .update(kitchenTicketItems)
        .set({ status: 'voided', voidAcknowledgedAt: new Date() })
        .where(eq(kitchenTicketItems.id, ticketItemId))
        .returning()
      if (!updated) throw new Error('failed to acknowledge kitchen void')

      const syncedOrderItem = await this.syncOrderItemFromKitchen(db, updated.orderItemId, authContext.actorId)
      await this.recomputeOrderTotals(db, authContext.organizationId, updated.orderId)
      await this.refreshTicketOrderAndTableState(db, updated.ticketId, updated.orderId)
      return { updated, syncedOrderItem }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.updated.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'kds.ticket_item_void_acknowledged',
      entityType: 'kitchen_ticket_item',
      entityId: result.updated.id,
      reason: result.updated.voidReason ?? null,
    })

    return { ...this.serializeTicketItem(result.updated), orderItemStatus: result.syncedOrderItem.status }
  }

  async getCookTimeAnalytics(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, VIEW_ANALYTICS_PERMISSION)
      const effectiveLocationId = locationId ?? authContext.locationId
      if (!effectiveLocationId) {
        throw new BadRequestException({ code: 'location_required', message: 'locationId is required for cook-time analytics' })
      }

      const stations = await db
        .select()
        .from(kdsStations)
        .where(and(eq(kdsStations.organizationId, authContext.organizationId), eq(kdsStations.locationId, effectiveLocationId)))
      const stationIds = stations.map((station) => station.id)
      const items = stationIds.length
        ? await db.select().from(kitchenTicketItems).where(inArray(kitchenTicketItems.stationId, stationIds))
        : []

      const analytics = stations.map((station) => {
        const stationItems = items.filter((item) => item.stationId === station.id)
        const completed = stationItems.filter((item) => item.readyAt)
        const active = stationItems.filter((item) => !['ready', 'voided'].includes(item.status))
        const averageCompletedSeconds = completed.length
          ? Math.round(
              completed.reduce((sum, item) => sum + (new Date(item.readyAt!).getTime() - new Date(item.createdAt).getTime()) / 1000, 0) /
                completed.length,
            )
          : station.expectedPrepTimeSeconds
        const averageActiveAgeSeconds = active.length
          ? Math.round(active.reduce((sum, item) => sum + this.ageSeconds(item.createdAt), 0) / active.length)
          : 0
        return {
          stationId: station.id,
          stationCode: station.code,
          stationName: station.name,
          expectedPrepTimeSeconds: station.expectedPrepTimeSeconds,
          averageCompletedSeconds,
          averageActiveAgeSeconds,
          activeTicketItems: active.length,
          completedTicketItems: completed.length,
        }
      })

      const alerts = analytics.flatMap((station) => {
        if (station.activeTicketItems === 0) return []
        const baseline = station.averageCompletedSeconds || station.expectedPrepTimeSeconds
        const behind = station.averageActiveAgeSeconds > baseline * 1.5
        if (!behind) return []
        const reliefStation = analytics.find(
          (candidate) => candidate.stationId !== station.stationId && candidate.activeTicketItems > 0 && candidate.averageActiveAgeSeconds < candidate.averageCompletedSeconds,
        )
        return [
          {
            type: 'cross_station_imbalance',
            delayedStationId: station.stationId,
            delayedStationName: station.stationName,
            delayedAverageAgeSeconds: station.averageActiveAgeSeconds,
            baselineSeconds: baseline,
            suggestedReliefStationId: reliefStation?.stationId ?? null,
            suggestedReliefStationName: reliefStation?.stationName ?? null,
          },
        ]
      })

      return { stations: analytics, alerts }
    })
  }

  async createTicketsForSentItems(db: Db, authContext: AuthContext, order: OrderRow, firedItems: OrderItemRow[]) {
    if (firedItems.length === 0) return []

    const productIds = [...new Set(firedItems.map((item) => item.productId))]
    const productRows = await db.select().from(products).where(inArray(products.id, productIds))
    const productById = new Map(productRows.map((row) => [row.id, row]))
    const categoryIds = [...new Set(productRows.map((product) => product.categoryId))]
    const categoryRows = categoryIds.length ? await db.select().from(menuCategories).where(inArray(menuCategories.id, categoryIds)) : []
    const categoryById = new Map(categoryRows.map((row) => [row.id, row]))
    const stations = await db
      .select()
      .from(kdsStations)
      .where(and(eq(kdsStations.organizationId, authContext.organizationId), eq(kdsStations.locationId, order.locationId), eq(kdsStations.status, 'active')))
    const stationByCode = new Map(stations.map((station) => [station.code, station]))

    const groupedByStation = new Map<string, { station: KdsStationRow; items: OrderItemRow[] }>()
    for (const item of firedItems) {
      const product = productById.get(item.productId)
      if (!product) throw new NotFoundException(`product ${item.productId} not found while building KDS tickets`)
      const category = categoryById.get(product.categoryId)
      const routeCode = product.kdsStationOverride ?? category?.defaultKdsStation
      if (!routeCode) {
        throw new BadRequestException({
          code: 'missing_kds_route',
          message: `product "${item.nameSnapshot}" has no station route configured`,
        })
      }
      const station = stationByCode.get(routeCode)
      if (!station) {
        throw new BadRequestException({
          code: 'kds_station_not_found',
          message: `no active KDS station exists for route "${routeCode}" at this location`,
        })
      }
      const entry = groupedByStation.get(station.id) ?? { station, items: [] }
      entry.items.push(item)
      groupedByStation.set(station.id, entry)
    }

    const createdTickets: KitchenTicketRow[] = []
    for (const { station, items } of groupedByStation.values()) {
      const [ticket] = await db
        .insert(kitchenTickets)
        .values({
          organizationId: authContext.organizationId,
          locationId: order.locationId,
          stationId: station.id,
          orderId: order.id,
          tableId: order.tableId ?? null,
          firedByActorId: authContext.actorId,
        })
        .returning()
      if (!ticket) throw new Error('failed to create kitchen ticket')
      createdTickets.push(ticket)

      await db.insert(kitchenTicketItems).values(
        items.map((item) => ({
          organizationId: authContext.organizationId,
          locationId: order.locationId,
          ticketId: ticket.id,
          stationId: station.id,
          orderId: order.id,
          orderItemId: item.id,
          nameSnapshot: item.nameSnapshot,
          localNameSnapshot: item.localNameSnapshot,
          quantity: item.quantity,
          seatNumber: item.seatNumber,
          course: item.course,
          kitchenNote: item.kitchenNote,
        })),
      )
    }

    return createdTickets
  }

  async requestVoidForOrderItem(db: Db, authContext: AuthContext, item: OrderItemRow, reason: string) {
    const ticketItemRows = await db
      .select()
      .from(kitchenTicketItems)
      .where(and(eq(kitchenTicketItems.organizationId, authContext.organizationId), eq(kitchenTicketItems.orderItemId, item.id), ne(kitchenTicketItems.status, 'voided')))

    if (ticketItemRows.length === 0) {
      throw new BadRequestException({
        code: 'missing_kitchen_ticket',
        message: 'cannot request a kitchen acknowledgment for an item with no active kitchen ticket',
      })
    }

    for (const row of ticketItemRows) {
      if (!KDS_TICKET_ITEM_STATUS_TRANSITIONS[row.status as KdsTicketItemStatus]?.includes('void_requested')) {
        throw new BadRequestException({
          code: 'illegal_kitchen_void_request',
          message: `cannot request kitchen void while ticket item is in status "${row.status}"`,
        })
      }
    }

    this.assertLegalOrderItemTransition(item.status as OrderItemStatus, 'void_requested')
    await db
      .update(kitchenTicketItems)
      .set({ status: 'void_requested', voidRequestedAt: new Date(), voidReason: reason })
      .where(and(eq(kitchenTicketItems.organizationId, authContext.organizationId), eq(kitchenTicketItems.orderItemId, item.id), ne(kitchenTicketItems.status, 'voided')))

    const [updated] = await db
      .update(orderItems)
      .set({ status: 'void_requested', voidReason: reason })
      .where(eq(orderItems.id, item.id))
      .returning()
    if (!updated) throw new Error('failed to mark order item void_requested')

    const ticketIds = [...new Set(ticketItemRows.map((row) => row.ticketId))]
    for (const ticketId of ticketIds) {
      await this.recomputeTicketStatus(db, ticketId)
    }
    await this.recomputeOrderReadiness(db, item.orderId)
    return updated
  }

  private async transitionTicketItem(
    authContext: AuthContext,
    ticketItemId: string,
    targetStatus: 'accepted' | 'in_progress' | 'ready',
    auditAction: string,
  ) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const ticketItem = await this.loadTicketItem(db, authContext.organizationId, ticketItemId)
      const station = await this.loadStation(db, authContext.organizationId, ticketItem.stationId)
      await this.assertStationActionPermission(db, authContext, station, BUMP_OWN_PERMISSION, BUMP_ANY_PERMISSION)

      this.assertLegalTicketItemTransition(ticketItem.status as KdsTicketItemStatus, targetStatus)
      const orderStatusTarget = this.mapKitchenStatusToOrderItemStatus(targetStatus)
      const orderItem = await this.loadOrderItem(db, authContext.organizationId, ticketItem.orderItemId)
      this.assertLegalOrderItemTransition(orderItem.status as OrderItemStatus, orderStatusTarget)

      const [updated] = await db
        .update(kitchenTicketItems)
        .set({
          status: targetStatus,
          ...(targetStatus === 'in_progress' && { startedAt: ticketItem.startedAt ?? new Date() }),
          ...(targetStatus === 'ready' && { startedAt: ticketItem.startedAt ?? new Date(), readyAt: new Date() }),
        })
        .where(eq(kitchenTicketItems.id, ticketItemId))
        .returning()
      if (!updated) throw new Error('failed to update kitchen ticket item')

      await this.syncOrderItemFromKitchen(db, updated.orderItemId)
      await this.refreshTicketOrderAndTableState(db, updated.ticketId, updated.orderId)
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: result.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: auditAction,
      entityType: 'kitchen_ticket_item',
      entityId: result.id,
    })

    return this.serializeTicketItem(result)
  }

  private async refreshTicketOrderAndTableState(db: Db, ticketId: string, orderId: string) {
    await this.recomputeTicketStatus(db, ticketId)
    await this.recomputeOrderReadiness(db, orderId)
  }

  private async recomputeTicketStatus(db: Db, ticketId: string) {
    const rows = await db.select().from(kitchenTicketItems).where(eq(kitchenTicketItems.ticketId, ticketId))
    if (rows.length === 0) return

    const active = rows.filter((row) => row.status !== 'voided')
    const nextStatus =
      active.length === 0
        ? 'voided'
        : active.every((row) => row.status === 'ready')
          ? 'ready'
          : active.some((row) => row.status === 'ready')
            ? 'partially_ready'
            : 'open'

    await db
      .update(kitchenTickets)
      .set({ status: nextStatus, readyAt: nextStatus === 'ready' ? new Date() : null })
      .where(eq(kitchenTickets.id, ticketId))
  }

  private async syncOrderItemFromKitchen(db: Db, orderItemId: string, resolvedByActorId?: string) {
    const orderItem = await this.loadOrderItem(db, null, orderItemId)
    if (orderItem.status === 'comped' || orderItem.status === 'served') return orderItem

    const rows = await db.select().from(kitchenTicketItems).where(eq(kitchenTicketItems.orderItemId, orderItemId))
    if (rows.length === 0) return orderItem

    const nextStatus: OrderItemStatus = rows.some((row) => row.status === 'void_requested')
      ? 'void_requested'
      : rows.every((row) => row.status === 'voided')
        ? 'voided'
        : rows.every((row) => ['ready', 'voided'].includes(row.status))
          ? 'ready'
          : rows.some((row) => row.status === 'in_progress')
            ? 'in_progress'
            : rows.some((row) => row.status === 'accepted')
              ? 'accepted'
              : 'sent'

    if (orderItem.status === nextStatus) return orderItem
    this.assertLegalOrderItemTransition(orderItem.status as OrderItemStatus, nextStatus)

    const patch: Partial<OrderItemRow> = { status: nextStatus }
    if (nextStatus === 'voided' && resolvedByActorId) patch.resolvedByActorId = resolvedByActorId
    const [updated] = await db.update(orderItems).set(patch).where(eq(orderItems.id, orderItemId)).returning()
    if (!updated) throw new Error('failed to sync order item from kitchen state')
    return updated
  }

  private async recomputeOrderReadiness(db: Db, orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
    if (!order) throw new NotFoundException('order not found')
    if (!['sent_to_kitchen', 'partially_ready', 'ready', 'served'].includes(order.status)) return order

    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), ne(orderItems.status, 'voided'), ne(orderItems.status, 'comped')))
    if (items.length === 0) return order

    const nextStatus: OrderStatus = items.every((item) => item.status === 'served')
      ? 'served'
      : items.every((item) => ['ready', 'served'].includes(item.status))
        ? 'ready'
        : items.some((item) => ['ready', 'served'].includes(item.status))
          ? 'partially_ready'
          : 'sent_to_kitchen'

    if (nextStatus !== order.status && ORDER_STATUS_TRANSITIONS[order.status as OrderStatus]?.includes(nextStatus)) {
      const [updatedOrder] = await db.update(orders).set({ status: nextStatus }).where(eq(orders.id, orderId)).returning()
      if (updatedOrder && nextStatus === 'ready' && updatedOrder.tableId) {
        const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, updatedOrder.tableId))
        if (table && TABLE_STATE_TRANSITIONS[table.status as TableStatus]?.includes('food_ready')) {
          await db.update(restaurantTables).set({ status: 'food_ready' }).where(eq(restaurantTables.id, table.id))
        }
      }
      return updatedOrder ?? order
    }

    return order
  }

  private async recomputeOrderTotals(db: Db, organizationId: string, orderId: string) {
    const items = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.organizationId, organizationId), ne(orderItems.status, 'voided')))
    const subtotalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0)
    const itemDiscounts = items.reduce((sum, item) => sum + item.discountAmount, 0)
    const orderLevelDiscounts = await db
      .select()
      .from(orderDiscounts)
      .where(and(eq(orderDiscounts.orderId, orderId), eq(orderDiscounts.organizationId, organizationId)))
    const discountAmount = itemDiscounts + orderLevelDiscounts.filter((row) => !row.orderItemId).reduce((sum, row) => sum + row.amountApplied, 0)
    const totalAmount = subtotalAmount - discountAmount
    await db.update(orders).set({ subtotalAmount, discountAmount, totalAmount }).where(eq(orders.id, orderId))
  }

  private buildStationBatches(items: KitchenTicketItemRow[]) {
    const grouped = new Map<string, KitchenTicketItemRow[]>()
    for (const item of items.filter((entry) => !['ready', 'voided'].includes(entry.status))) {
      const key = [item.stationId, item.nameSnapshot, item.course ?? '', item.kitchenNote ?? ''].join('::')
      const list = grouped.get(key) ?? []
      list.push(item)
      grouped.set(key, list)
    }

    return [...grouped.entries()].map(([batchKey, rows]) => ({
      batchKey,
      stationId: rows[0]!.stationId,
      nameSnapshot: rows[0]!.nameSnapshot,
      quantityTotal: rows.reduce((sum, row) => sum + row.quantity, 0),
      ticketItemIds: rows.map((row) => row.id),
      ticketIds: [...new Set(rows.map((row) => row.ticketId))],
      oldestAgeSeconds: Math.max(...rows.map((row) => this.ageSeconds(row.createdAt))),
    }))
  }

  private serializeTicketItem(item: KitchenTicketItemRow) {
    return {
      ...item,
      ageSeconds: this.ageSeconds(item.createdAt),
      attentionFlags: this.deriveAttentionFlags(item.kitchenNote),
    }
  }

  private deriveAttentionFlags(kitchenNote: string | null) {
    if (!kitchenNote) return [] as string[]
    return ATTENTION_REGEX.test(kitchenNote) ? ['allergy'] : []
  }

  private ageSeconds(value: Date) {
    return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  }

  private mapKitchenStatusToOrderItemStatus(status: 'accepted' | 'in_progress' | 'ready'): OrderItemStatus {
    if (status === 'accepted') return 'accepted'
    if (status === 'in_progress') return 'in_progress'
    return 'ready'
  }

  private assertLegalTicketItemTransition(from: KdsTicketItemStatus, to: KdsTicketItemStatus) {
    if (!KDS_TICKET_ITEM_STATUS_TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException({
        code: 'illegal_kitchen_ticket_item_transition',
        message: `cannot transition kitchen ticket item from "${from}" to "${to}"`,
        from,
        to,
      })
    }
  }

  private assertLegalOrderItemTransition(from: OrderItemStatus, to: OrderItemStatus) {
    if (!ORDER_ITEM_STATUS_TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException({
        code: 'illegal_order_item_transition',
        message: `cannot transition order item from "${from}" to "${to}"`,
        from,
        to,
      })
    }
  }

  async getStationById(authContext: AuthContext, stationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, VIEW_PERMISSION)
      const station = await this.loadStation(db, authContext.organizationId, stationId)
      return station
    })
  }

  async deleteStation(authContext: AuthContext, stationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      await this.assertPermission(db, authContext, MANAGE_STATIONS_PERMISSION)
      const existing = await this.loadStation(db, authContext.organizationId, stationId)
      await db.delete(kdsStations).where(eq(kdsStations.id, stationId))
    })
  }

  private async assertPermission(db: Db, authContext: AuthContext, permission: string) {
    const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
    if (!granted.includes(permission)) {
      throw new ForbiddenException({ code: 'permission_denied', message: `missing permission: ${permission}` })
    }
  }

  private async assertStationActionPermission(
    db: Db,
    authContext: AuthContext,
    station: KdsStationRow,
    ownPermission: string,
    anyPermission: string,
  ) {
    const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
    if (granted.includes(anyPermission)) return
    if (granted.includes(ownPermission) && (!station.assignedStaffId || station.assignedStaffId === authContext.actorId)) return
    throw new ForbiddenException({
      code: 'permission_denied',
      message: `missing permission: ${station.assignedStaffId === authContext.actorId ? ownPermission : anyPermission}`,
    })
  }

  private async loadStation(db: Db, organizationId: string, stationId: string) {
    const [station] = await db
      .select()
      .from(kdsStations)
      .where(and(eq(kdsStations.id, stationId), eq(kdsStations.organizationId, organizationId)))
    if (!station) throw new NotFoundException('KDS station not found')
    return station
  }

  private async loadAssignableStaff(db: Db, organizationId: string, locationId: string, staffId: string) {
    const [row] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.organizationId, organizationId), eq(staff.locationId, locationId)))
    if (!row) throw new NotFoundException('assigned staff member not found at this location')
    return row
  }

  private async loadTicket(db: Db, organizationId: string, ticketId: string) {
    const [row] = await db
      .select()
      .from(kitchenTickets)
      .where(and(eq(kitchenTickets.id, ticketId), eq(kitchenTickets.organizationId, organizationId)))
    if (!row) throw new NotFoundException('kitchen ticket not found')
    return row
  }

  private async loadTicketItem(db: Db, organizationId: string, ticketItemId: string) {
    const [row] = await db
      .select()
      .from(kitchenTicketItems)
      .where(and(eq(kitchenTicketItems.id, ticketItemId), eq(kitchenTicketItems.organizationId, organizationId)))
    if (!row) throw new NotFoundException('kitchen ticket item not found')
    return row
  }

  private async loadOrderItem(db: Db, organizationId: string | null, orderItemId: string) {
    const conditions = [eq(orderItems.id, orderItemId)]
    if (organizationId) conditions.push(eq(orderItems.organizationId, organizationId))
    const [row] = await db.select().from(orderItems).where(and(...conditions))
    if (!row) throw new NotFoundException('order item not found')
    return row
  }
}
