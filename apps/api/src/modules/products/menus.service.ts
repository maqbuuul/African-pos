import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { menus, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateMenuDto } from './dto/create-menu.dto.js'

@Injectable()
export class MenusService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async list(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => {
      const where = locationId
        ? and(eq(menus.organizationId, authContext.organizationId), eq(menus.locationId, locationId))
        : eq(menus.organizationId, authContext.organizationId)
      return db.select().from(menus).where(where)
    })
  }

  async create(authContext: AuthContext, dto: CreateMenuDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [created] = await db
        .insert(menus)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          name: dto.name,
          description: dto.description ?? null,
          isDefault: dto.isDefault ?? false,
        })
        .returning()
      if (!created) throw new Error('failed to create menu')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'menu.created',
      entityType: 'menu',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.id, id), eq(menus.organizationId, authContext.organizationId)))
      if (!menu) throw new NotFoundException('menu not found')
      return menu
    })
  }

  async update(authContext: AuthContext, id: string, data: any) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [existing] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.id, id), eq(menus.organizationId, authContext.organizationId)))
      if (!existing) throw new NotFoundException('menu not found')

      const [updated] = await db
        .update(menus)
        .set({ ...data })
        .where(and(eq(menus.id, id), eq(menus.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new Error('failed to update menu')
      return updated
    })
  }

  async delete(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [existing] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.id, id), eq(menus.organizationId, authContext.organizationId)))
      if (!existing) throw new NotFoundException('menu not found')

      await db.delete(menus).where(eq(menus.id, id))
    })
  }
}
