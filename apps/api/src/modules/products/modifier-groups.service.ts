import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { modifierGroups, modifiers, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateModifierGroupDto } from './dto/create-modifier-group.dto.js'
import type { UpdateModifierGroupDto } from './dto/update-modifier-group.dto.js'

@Injectable()
export class ModifierGroupsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async list(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const where = locationId
        ? and(eq(modifierGroups.organizationId, authContext.organizationId), eq(modifierGroups.locationId, locationId))
        : eq(modifierGroups.organizationId, authContext.organizationId)
      const groups = await db.select().from(modifierGroups).where(where)
      const options = await db.select().from(modifiers).where(eq(modifiers.organizationId, authContext.organizationId))
      return groups.map((group) => ({
        ...group,
        modifiers: options.filter((option) => option.modifierGroupId === group.id).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
    })
  }

  async create(authContext: AuthContext, dto: CreateModifierGroupDto) {
    const minSelect = dto.minSelect ?? 0
    const maxSelect = dto.maxSelect ?? 1

    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [group] = await db
        .insert(modifierGroups)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          name: dto.name,
          minSelect,
          maxSelect,
        })
        .returning()
      if (!group) throw new Error('failed to create modifier group')

      const createdModifiers = await db
        .insert(modifiers)
        .values(
          dto.modifiers.map((modifier, index) => ({
            organizationId: authContext.organizationId,
            modifierGroupId: group.id,
            name: modifier.name,
            priceDelta: modifier.priceDelta,
            currency: modifier.currency,
            sortOrder: modifier.sortOrder ?? index,
          })),
        )
        .returning()

      return { ...group, modifiers: createdModifiers }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'modifier_group.created',
      entityType: 'modifier_group',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async update(authContext: AuthContext, id: string, dto: UpdateModifierGroupDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(modifierGroups)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.minSelect !== undefined && { minSelect: dto.minSelect }),
          ...(dto.maxSelect !== undefined && { maxSelect: dto.maxSelect }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(and(eq(modifierGroups.id, id), eq(modifierGroups.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('modifier group not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'modifier_group.updated',
      entityType: 'modifier_group',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [group] = await db
        .select()
        .from(modifierGroups)
        .where(and(eq(modifierGroups.id, id), eq(modifierGroups.organizationId, authContext.organizationId)))
      if (!group) throw new NotFoundException('modifier group not found')

      const options = await db
        .select()
        .from(modifiers)
        .where(eq(modifiers.modifierGroupId, id))
        .orderBy(modifiers.sortOrder)

      return { ...group, modifiers: options }
    })
  }

  async delete(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [existing] = await db
        .select()
        .from(modifierGroups)
        .where(and(eq(modifierGroups.id, id), eq(modifierGroups.organizationId, authContext.organizationId)))
      if (!existing) throw new NotFoundException('modifier group not found')

      await db.delete(modifiers).where(eq(modifiers.modifierGroupId, id))
      await db.delete(modifierGroups).where(eq(modifierGroups.id, id))
    })
  }
}
