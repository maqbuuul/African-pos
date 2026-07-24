import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { staffNotifications, type Db } from '@hospitality-os/database'

export interface CreateStaffNotificationParams {
  organizationId: string
  locationId: string
  staffId?: string | null
  tableId?: string | null
  notificationType: string
  message?: string | null
  reason?: string | null
  channel?: string | null
  status?: string
}

// staff_notifications has no owning business module of its own (an
// orphaned table pre-dating the module-boundary manifest) — homed here
// since it's a notifications-domain concern, not because of schema
// colocation. db-first: callable from any other module's already-open
// transaction, never opens its own withTenantContext.
@Injectable()
export class StaffNotificationsService {
  async create(db: Db, params: CreateStaffNotificationParams) {
    const [notification] = await db
      .insert(staffNotifications)
      .values({
        organizationId: params.organizationId,
        locationId: params.locationId,
        staffId: params.staffId ?? null,
        tableId: params.tableId ?? null,
        notificationType: params.notificationType,
        message: params.message ?? null,
        reason: params.reason ?? null,
        channel: params.channel ?? null,
        status: params.status ?? 'pending',
      })
      .returning()
    if (!notification) throw new Error('failed to create staff notification')
    return notification
  }

  async hasPending(db: Db, organizationId: string, notificationType: string, reason: string) {
    const [existing] = await db
      .select({ id: staffNotifications.id })
      .from(staffNotifications)
      .where(
        and(
          eq(staffNotifications.organizationId, organizationId),
          eq(staffNotifications.notificationType, notificationType),
          eq(staffNotifications.reason, reason),
          eq(staffNotifications.status, 'pending'),
        ),
      )
    return existing != null
  }
}
