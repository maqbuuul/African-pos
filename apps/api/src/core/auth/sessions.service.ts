import { randomBytes } from 'node:crypto'

import { Injectable, UnauthorizedException } from '@nestjs/common'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { authSessions, hashSecret, verifySecret, type Db } from '@hospitality-os/database'

import type { ActorType } from '../tenant/tenant.types.js'
import { signAuthToken, signRefreshToken, verifyRefreshToken } from './jwt.js'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days, matches jwt.ts REFRESH_TOKEN_TTL

export interface IssueTokensInput {
  actorType: ActorType
  actorId: string
  organizationId: string
  locationId?: string | undefined
  deviceId?: string | null | undefined
}

export interface IssuedTokens {
  token: string
  refreshToken: string
}

// Owns the database-backed half of the refresh-token lifecycle; jwt.ts owns
// the signing/verification half. Split this way so AuthService's login
// methods and /auth/refresh both go through the same "create/rotate a real
// session row" path instead of each hand-rolling it.
@Injectable()
export class SessionsService {
  async issue(db: Db, input: IssueTokensInput): Promise<IssuedTokens> {
    const secret = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    const [session] = await db
      .insert(authSessions)
      .values({
        organizationId: input.organizationId,
        actorType: input.actorType,
        actorId: input.actorId,
        deviceId: input.deviceId ?? null,
        refreshTokenHash: await hashSecret(secret),
        expiresAt,
      })
      .returning()
    if (!session) throw new Error('failed to create session')

    const [token, refreshToken] = await Promise.all([
      signAuthToken(input.actorId, { actorType: input.actorType, organizationId: input.organizationId, ...(input.locationId ? { locationId: input.locationId } : {}) }),
      signRefreshToken(input.actorId, {
        actorType: input.actorType,
        organizationId: input.organizationId,
        sessionId: session.id,
        secret,
        ...(input.locationId ? { locationId: input.locationId } : {}),
      }),
    ])

    return { token, refreshToken }
  }

  // Verifies the presented refresh token both cryptographically (signature,
  // expiry, tokenType — jwt.ts) and against the database (session not
  // revoked, not expired, secret matches), then rotates: the old session is
  // revoked and a new one issued. Rotation on every refresh bounds how long
  // a stolen refresh token stays useful to a single-use window.
  async refresh(db: Db, refreshToken: string): Promise<IssuedTokens> {
    const claims = await verifyRefreshToken(refreshToken).catch(() => {
      throw new UnauthorizedException('invalid refresh token')
    })

    const [session] = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.id, claims.sessionId),
          eq(authSessions.organizationId, claims.organizationId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
    if (!session || !(await verifySecret(session.refreshTokenHash, claims.secret))) {
      throw new UnauthorizedException('invalid refresh token')
    }

    await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, session.id))

    return this.issue(db, {
      actorType: claims.actorType,
      actorId: claims.actorId,
      organizationId: claims.organizationId,
      locationId: claims.locationId,
      deviceId: session.deviceId,
    })
  }

  async revoke(db: Db, refreshToken: string): Promise<void> {
    const claims = await verifyRefreshToken(refreshToken).catch(() => {
      throw new UnauthorizedException('invalid refresh token')
    })
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.id, claims.sessionId), eq(authSessions.organizationId, claims.organizationId)))
  }
}
