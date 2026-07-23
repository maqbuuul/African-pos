import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Pool } from 'pg'

import { signTableSessionToken } from '../../core/auth/table-session-jwt.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'

@Injectable()
export class TableSessionsService {
  constructor(@Inject(APP_POOL) private readonly pool: Pool) {}

  async createSession(qrSlug: string): Promise<{ token: string; tableId: string }> {
    const { rows } = await this.pool.query<{
      id: string
      organization_id: string
      location_id: string
    }>(
      `SELECT id, organization_id, location_id
         FROM restaurant_tables
        WHERE qr_slug = $1
        LIMIT 1`,
      [qrSlug],
    )

    const table = rows[0]
    if (!table) throw new NotFoundException('table not found for this QR code')

    const token = await signTableSessionToken({
      organizationId: table.organization_id,
      locationId: table.location_id,
      tableId: table.id,
      qrSlug,
      tokenType: 'table_session',
    })

    return { token, tableId: table.id }
  }

  async getPublicMenu(tableSession: { organizationId: string; locationId: string }) {
    return { organizationId: tableSession.organizationId, locationId: tableSession.locationId }
  }
}
