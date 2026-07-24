import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { Pool } from 'pg'
import { organizations, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import type { CreateOrganizationDto } from './dto/create-organization.dto.js'
import type { UpdateOrganizationDto } from './dto/update-organization.dto.js'

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  async list(authContext: AuthContext) {
    return withTenantContext(this.pool, authContext.organizationId, (db) =>
      db.select().from(organizations).where(eq(organizations.id, authContext.organizationId)),
    )
  }

  async getById(authContext: AuthContext, id: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
      if (!org) throw new NotFoundException('organization not found')
      return org
    })
  }

  async create(authContext: AuthContext, dto: CreateOrganizationDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [created] = await db
        .insert(organizations)
        .values({
          name: dto.name,
          legalName: dto.legalName ?? null,
          country: dto.country,
          defaultCurrency: dto.defaultCurrency,
          timezone: dto.timezone,
          taxId: dto.taxId ?? null,
          taxSerial: dto.taxSerial ?? null,
        })
        .returning()
      if (!created) throw new Error('failed to create organization')
      return created
    })

    await this.auditLog.record({
      organizationId: row.id,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'organization.created',
      entityType: 'organization',
      entityId: row.id,
      newValue: row,
    })

    return row
  }

  async update(authContext: AuthContext, id: string, dto: UpdateOrganizationDto) {
    const row = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [updated] = await db
        .update(organizations)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.legalName !== undefined && { legalName: dto.legalName }),
          ...(dto.country !== undefined && { country: dto.country }),
          ...(dto.defaultCurrency !== undefined && { defaultCurrency: dto.defaultCurrency }),
          ...(dto.timezone !== undefined && { timezone: dto.timezone }),
          ...(dto.taxId !== undefined && { taxId: dto.taxId }),
          ...(dto.taxSerial !== undefined && { taxSerial: dto.taxSerial }),
          ...(dto.status !== undefined && { status: dto.status }),
        })
        .where(eq(organizations.id, id))
        .returning()
      if (!updated) throw new NotFoundException('organization not found')
      return updated
    })

    await this.auditLog.record({
      organizationId: row.id,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'organization.updated',
      entityType: 'organization',
      entityId: row.id,
      newValue: row,
    })

    return row
  }
}
