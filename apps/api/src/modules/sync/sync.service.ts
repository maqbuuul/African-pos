import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'

import {
  syncConflicts,
  syncCursors,
  syncOperations,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import {
  ConflictPolicyEngine,
  type SyncOperation,
  type SyncPushResult,
} from '@hospitality-os/offline-sync'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { PushOperationsDto } from './dto/push-operations.dto.js'
import type { ResolveConflictDto } from './dto/resolve-conflict.dto.js'

@Injectable()
export class SyncService {
  private readonly conflictPolicy = new ConflictPolicyEngine()

  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async pushOperations(
    authContext: AuthContext,
    dto: PushOperationsDto,
  ): Promise<SyncPushResult> {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const accepted: SyncPushResult['accepted'] = []
      const conflicts: SyncPushResult['conflicts'] = []

      for (const op of dto.operations) {
        const existing = await this.findOperationByIdempotencyKey(
          db, authContext.organizationId, op.idempotencyKey ?? op.opId,
        )
        if (existing) {
          accepted.push({ opId: op.opId, serverEntityId: existing.entityId })
          continue
        }

        const resolution = this.conflictPolicy.resolve(
          op.entityType as SyncOperation['entityType'],
          op.operation as SyncOperation['operation'],
        )

          if (resolution === 'server_wins' || resolution === 'append_merge') {
          const [recorded] = await db
            .insert(syncOperations)
            .values({
              organizationId: authContext.organizationId,
              locationId: op.locationId,
              deviceId: op.deviceId,
              actorId: op.actorId,
              entityType: op.entityType,
              entityId: op.entityId,
              operation: op.operation,
              payload: op.payload as Record<string, unknown>,
              baseVersion: op.baseVersion ?? null,
              idempotencyKey: op.idempotencyKey ?? op.opId,
              status: 'synced',
            })
            .returning()
          if (!recorded) throw new Error('failed to record sync operation')

          accepted.push({ opId: op.opId, serverEntityId: recorded.entityId })
        } else if (resolution === 'payment_dependent') {
          const paymentPayload = op.payload as { method?: string }
          if (paymentPayload?.method === 'cash') {
            const [recorded] = await db
              .insert(syncOperations)
              .values({
                organizationId: authContext.organizationId,
                locationId: op.locationId,
                deviceId: op.deviceId,
                actorId: op.actorId,
                entityType: op.entityType,
                entityId: op.entityId,
                operation: op.operation,
                payload: op.payload as Record<string, unknown>,
                baseVersion: op.baseVersion ?? null,
                idempotencyKey: op.idempotencyKey ?? op.opId,
                status: 'synced',
              })
              .returning()
            if (!recorded) throw new Error('failed to record sync operation')

            accepted.push({ opId: op.opId, serverEntityId: recorded.entityId })
          } else {
            conflicts.push({
              opId: op.opId,
              entityType: op.entityType as SyncOperation['entityType'],
              entityId: op.entityId,
              serverVersion: null,
              clientVersion: op.payload,
              message: 'Non-cash payment requires online confirmation',
            })
          }
        } else {
          const [recorded] = await db
            .insert(syncOperations)
            .values({
              organizationId: authContext.organizationId,
              locationId: op.locationId,
              deviceId: op.deviceId,
              actorId: op.actorId,
              entityType: op.entityType,
              entityId: op.entityId,
              operation: op.operation,
              payload: op.payload as Record<string, unknown>,
              baseVersion: op.baseVersion ?? null,
              idempotencyKey: op.idempotencyKey ?? op.opId,
              status: 'conflict',
            })
            .returning()
          if (!recorded) throw new Error('failed to record sync operation')

          await db
            .insert(syncConflicts)
            .values({
              organizationId: authContext.organizationId,
              locationId: op.locationId,
              deviceId: op.deviceId,
              opId: op.opId,
              entityType: op.entityType,
              entityId: op.entityId,
              resolution: 'manual_review',
              serverSnapshot: {},
              clientSnapshot: op.payload as Record<string, unknown>,
              message: this.conflictPolicy.getDescription(
                op.entityType as SyncOperation['entityType'],
                op.operation as SyncOperation['operation'],
              ),
            })

          conflicts.push({
            opId: op.opId,
            entityType: op.entityType as SyncOperation['entityType'],
            entityId: op.entityId,
            serverVersion: null,
            clientVersion: op.payload,
            message: this.conflictPolicy.getDescription(
              op.entityType as SyncOperation['entityType'],
              op.operation as SyncOperation['operation'],
            ),
          })
        }
      }

      const deviceIds = [...new Set(dto.operations.map((o) => o.deviceId))]
      for (const deviceId of deviceIds) {
        await db
          .insert(syncCursors)
          .values({
            organizationId: authContext.organizationId,
            locationId: authContext.locationId ?? '',
            deviceId,
            lastSyncedAt: sql`now()`,
            pendingOperationCount: 0,
            syncStatus: 'syncing',
          })
          .onConflictDoUpdate({
            target: syncCursors.deviceId,
            set: {
              lastSyncedAt: sql`now()`,
              pendingOperationCount: 0,
              syncStatus: 'syncing',
              updatedAt: sql`now()`,
            },
          })
      }

      const deviceId = deviceIds[0] ?? 'unknown'
      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: authContext.locationId ?? '',
        actorType: 'system',
        actorId: authContext.actorId,
        action: 'sync.operations_pushed',
        entityType: 'sync',
        entityId: deviceId,
        newValue: { acceptedCount: accepted.length, conflictCount: conflicts.length },
      })

      return { accepted, conflicts }
    })
  }

  async getDeviceHealth(
    authContext: AuthContext,
    deviceId?: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const conditions = [
        eq(syncCursors.organizationId, authContext.organizationId),
      ]
      if (deviceId) {
        conditions.push(eq(syncCursors.deviceId, deviceId))
      }

      return db
        .select()
        .from(syncCursors)
        .where(and(...conditions))
        .orderBy(sql`${syncCursors.updatedAt} DESC`)
    })
  }

  async listConflicts(
    authContext: AuthContext,
    resolution?: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const conditions = [
        eq(syncConflicts.organizationId, authContext.organizationId),
      ]
      if (resolution) {
        conditions.push(eq(syncConflicts.resolution, resolution))
      }

      return db
        .select()
        .from(syncConflicts)
        .where(and(...conditions))
        .orderBy(sql`${syncConflicts.createdAt} DESC`)
    })
  }

  async resolveConflict(
    authContext: AuthContext,
    dto: ResolveConflictDto,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [conflict] = await db
        .update(syncConflicts)
        .set({
          resolution: dto.resolution,
          resolvedByActorId: authContext.actorId,
          resolvedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(syncConflicts.id, dto.conflictId),
            eq(syncConflicts.organizationId, authContext.organizationId),
          ),
        )
        .returning()

      if (!conflict) {
        throw new Error('Conflict not found or already resolved')
      }

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: authContext.locationId ?? '',
        actorType: 'staff',
        actorId: authContext.actorId,
        action: 'sync.conflict_resolved',
        entityType: 'sync_conflict',
        entityId: conflict.id,
        newValue: { resolution: dto.resolution, reason: dto.reason },
      })

      return conflict
    })
  }

  async updateDeviceStatus(
    authContext: AuthContext,
    deviceId: string,
    status: string,
    batteryLevel?: number,
    onBattery?: boolean,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [cursor] = await db
        .update(syncCursors)
        .set({
          syncStatus: status,
          batteryLevel: batteryLevel ?? null,
          onBattery: onBattery ?? false,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(syncCursors.deviceId, deviceId),
            eq(syncCursors.organizationId, authContext.organizationId),
          ),
        )
        .returning()

      return cursor ?? null
    })
  }

  private async findOperationByIdempotencyKey(
    db: Db,
    organizationId: string,
    key: string,
  ) {
    const [existing] = await db
      .select()
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.organizationId, organizationId),
          eq(syncOperations.idempotencyKey, key),
        ),
      )
    return existing ?? null
  }
}
