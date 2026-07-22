import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { menuCategories, menus, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateCategoryDto } from './dto/create-category.dto.js'
import type { UpdateCategoryDto } from './dto/update-category.dto.js'

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async list(authContext: AuthContext, locationId?: string) {
    return withTenantContext(this.pool, authContext.organizationId, (db) => {
      const where = locationId
        ? and(eq(menuCategories.organizationId, authContext.organizationId), eq(menuCategories.locationId, locationId))
        : eq(menuCategories.organizationId, authContext.organizationId)
      return db.select().from(menuCategories).where(where).orderBy(asc(menuCategories.sortOrder))
    })
  }

  async create(authContext: AuthContext, dto: CreateCategoryDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      // RLS-scoped SELECT, not a bare FK check — a menuId belonging to
      // another tenant simply won't be visible on this connection, so this
      // is the tenant-isolation check, not just a "does it exist" one.
      const [menu] = await db.select().from(menus).where(eq(menus.id, dto.menuId))
      if (!menu) throw new NotFoundException('menu not found')

      const [created] = await db
        .insert(menuCategories)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId,
          menuId: dto.menuId,
          name: dto.name,
          localName: dto.localName ?? null,
          description: dto.description ?? null,
          defaultKdsStation: dto.defaultKdsStation ?? null,
          sortOrder: dto.sortOrder ?? 0,
        })
        .returning()
      if (!created) throw new Error('failed to create category')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'category.created',
      entityType: 'menu_category',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async update(authContext: AuthContext, id: string, dto: UpdateCategoryDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(menuCategories)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.localName !== undefined && { localName: dto.localName }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.defaultKdsStation !== undefined && { defaultKdsStation: dto.defaultKdsStation }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(and(eq(menuCategories.id, id), eq(menuCategories.organizationId, authContext.organizationId)))
        .returning()
      if (!updated) throw new NotFoundException('category not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: row.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'category.updated',
      entityType: 'menu_category',
      entityId: row.id,
      newValue: row,
    })

    return row
  }
}
