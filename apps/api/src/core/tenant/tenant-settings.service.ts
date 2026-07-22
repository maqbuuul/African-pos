import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { tenantSettings, type Db } from '@hospitality-os/database'

// Reads the tenant_settings table's org-default/location-override pair (see
// packages/database/src/schema/shared/index.ts) — a location-scoped row wins
// over the org-wide default when both exist. Callers supply their own
// fallback rather than this service hardcoding one, since a sane default is
// business-specific to each setting key (see feedback-scalability-security:
// "no hardcoded ... magic numbers").
@Injectable()
export class TenantSettingsService {
  async get<T>(db: Db, organizationId: string, key: string, fallback: T, locationId?: string | null): Promise<T> {
    if (locationId) {
      const [locationRow] = await db
        .select()
        .from(tenantSettings)
        .where(and(eq(tenantSettings.organizationId, organizationId), eq(tenantSettings.locationId, locationId), eq(tenantSettings.key, key)))
      if (locationRow) return locationRow.value as T
    }

    const [orgRow] = await db
      .select()
      .from(tenantSettings)
      .where(and(eq(tenantSettings.organizationId, organizationId), isNull(tenantSettings.locationId), eq(tenantSettings.key, key)))
    return orgRow ? (orgRow.value as T) : fallback
  }
}
