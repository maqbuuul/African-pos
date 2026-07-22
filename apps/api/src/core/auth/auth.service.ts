import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { devices, locations, staff, users, verifySecret, withTenantContext } from '@hospitality-os/database'

import { AuditLogService } from '../audit/audit-log.service.js'
import { PermissionsService } from '../permissions/permissions.service.js'
import { APP_POOL } from '../tenant/tenant.constants.js'
import type { AuthContext } from '../tenant/tenant.types.js'
import type { DeviceActivateDto } from './dto/device-activate.dto.js'
import { verifyRefreshToken } from './jwt.js'
import { SessionsService } from './sessions.service.js'
import type { StaffPinLoginDto } from './dto/staff-pin-login.dto.js'

// Generic message for every owner-login failure path (unknown email, wrong
// password, inactive account) — distinguishing them in the response would
// let an attacker enumerate registered emails.
const INVALID_CREDENTIALS = 'Invalid email or password'
const INVALID_PIN = 'Invalid PIN'

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  async me(authContext: AuthContext) {
    const permissions = await withTenantContext(this.pool, authContext.organizationId, (db) =>
      this.permissionsService.listGrantedPermissions(db, authContext),
    )
    return { ...authContext, permissions }
  }

  async ownerLogin(email: string, password: string, ipAddress?: string) {
    const normalizedEmail = email.trim().toLowerCase()

    // No tenant context yet — this is the one deliberately-relaxed lookup
    // the users table's SELECT policy allows (see the shared_foundation
    // migration). Every other table stays fully locked out until organizationId
    // is known.
    const user = await withTenantContext(this.pool, null, async (db) => {
      const [row] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      return row
    })

    if (!user) {
      console.warn(`owner login attempted for unknown email: ${normalizedEmail}`)
      throw new UnauthorizedException(INVALID_CREDENTIALS)
    }

    const passwordValid = user.passwordHash ? await verifySecret(user.passwordHash, password) : false

    if (!passwordValid || user.status !== 'active') {
      await this.auditLog.record({
        organizationId: user.organizationId,
        actorType: 'user',
        actorId: user.id,
        action: 'auth.owner_login_failed',
        reason: !passwordValid ? 'invalid_password' : `account_status_${user.status}`,
        ipAddress: ipAddress ?? null,
      })
      throw new UnauthorizedException(INVALID_CREDENTIALS)
    }

    const { token, refreshToken } = await withTenantContext(this.pool, user.organizationId, (db) =>
      this.sessions.issue(db, { actorType: 'user', actorId: user.id, organizationId: user.organizationId }),
    )

    await this.auditLog.record({
      organizationId: user.organizationId,
      actorType: 'user',
      actorId: user.id,
      action: 'auth.owner_login',
      ipAddress: ipAddress ?? null,
    })

    return {
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, organizationId: user.organizationId },
    }
  }

  async staffPinLogin(dto: StaffPinLoginDto, ipAddress?: string) {
    const { organizationId, locationId, pin, deviceId } = dto

    const matchedStaff = await withTenantContext(this.pool, organizationId, async (db) => {
      const candidates = await db
        .select()
        .from(staff)
        .where(
          and(
            eq(staff.organizationId, organizationId),
            eq(staff.locationId, locationId),
            eq(staff.status, 'active'),
          ),
        )

      for (const candidate of candidates) {
        if (await verifySecret(candidate.pinHash, pin)) return candidate
      }
      return undefined
    })

    if (!matchedStaff) {
      await this.auditLog.record({
        organizationId,
        locationId,
        actorType: 'staff',
        action: 'auth.staff_pin_login_failed',
        reason: 'pin_not_matched',
        deviceId: deviceId ?? null,
        ipAddress: ipAddress ?? null,
      })
      throw new UnauthorizedException(INVALID_PIN)
    }

    const { token, refreshToken } = await withTenantContext(this.pool, organizationId, async (db) => {
      if (deviceId) {
        await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, deviceId))
      }
      return this.sessions.issue(db, {
        actorType: 'staff',
        actorId: matchedStaff.id,
        organizationId,
        locationId,
        deviceId,
      })
    })

    await this.auditLog.record({
      organizationId,
      locationId,
      actorType: 'staff',
      actorId: matchedStaff.id,
      action: 'auth.staff_pin_login',
      deviceId: deviceId ?? null,
      ipAddress: ipAddress ?? null,
    })

    return {
      token,
      refreshToken,
      staff: { id: matchedStaff.id, name: matchedStaff.name, organizationId, locationId },
    }
  }

  async refresh(refreshToken: string) {
    // organizationId isn't known yet — verifyRefreshToken (jwt.ts) checks
    // the JWT signature first, which is what makes trusting its embedded
    // organizationId safe here (see SessionsService.refresh for the DB-side
    // revocation/expiry/secret check that follows).
    const claims = await verifyRefreshToken(refreshToken).catch(() => {
      throw new UnauthorizedException('invalid refresh token')
    })

    const tokens = await withTenantContext(this.pool, claims.organizationId, (db) =>
      this.sessions.refresh(db, refreshToken),
    )

    await this.auditLog.record({
      organizationId: claims.organizationId,
      locationId: claims.locationId ?? null,
      actorType: claims.actorType,
      actorId: claims.actorId,
      action: 'auth.token_refreshed',
    })

    return tokens
  }

  async logout(refreshToken: string) {
    const claims = await verifyRefreshToken(refreshToken).catch(() => {
      throw new UnauthorizedException('invalid refresh token')
    })

    await withTenantContext(this.pool, claims.organizationId, (db) => this.sessions.revoke(db, refreshToken))

    await this.auditLog.record({
      organizationId: claims.organizationId,
      locationId: claims.locationId ?? null,
      actorType: claims.actorType,
      actorId: claims.actorId,
      action: 'auth.logout',
    })

    return { status: 'ok' }
  }

  // "Binds a physical device to a location" (BUILD_WORKFLOW.md P2). Devices
  // aren't self-registering — an already-authenticated, already-permissioned
  // actor (owner/manager) vouches for a new device the first time it's set
  // up, or reactivates one that was suspended.
  async activateDevice(authContext: AuthContext, dto: DeviceActivateDto) {
    // AuditLogService.record opens its own transaction (see audit-log.service.ts),
    // so it must run after this transaction commits, not nested inside it —
    // nested here, it would try to FK-reference a device row no other
    // connection can see yet. Same reason ownerLogin/staffPinLogin above call
    // it after their own withTenantContext block resolves.
    const device = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [location] = await db
        .select()
        .from(locations)
        .where(and(eq(locations.id, dto.locationId), eq(locations.organizationId, authContext.organizationId)))
      if (!location) throw new NotFoundException('location not found')

      const [existing] = await db
        .select()
        .from(devices)
        .where(
          and(
            eq(devices.organizationId, authContext.organizationId),
            eq(devices.locationId, dto.locationId),
            eq(devices.name, dto.name),
            eq(devices.deviceType, dto.deviceType),
          ),
        )

      const [row] = existing
        ? await db
            .update(devices)
            .set({ status: 'active', platform: dto.platform ?? existing.platform, lastSeenAt: new Date() })
            .where(eq(devices.id, existing.id))
            .returning()
        : await db
            .insert(devices)
            .values({
              organizationId: authContext.organizationId,
              locationId: dto.locationId,
              name: dto.name,
              deviceType: dto.deviceType,
              platform: dto.platform,
            })
            .returning()
      if (!row) throw new Error('failed to activate device')
      return row
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: dto.locationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'devices.activated',
      entityType: 'device',
      entityId: device.id,
      deviceId: device.id,
    })

    return device
  }
}
