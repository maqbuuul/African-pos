import { SignJWT, jwtVerify } from 'jose'

import type { ActorType, AuthContext } from '../tenant/tenant.types.js'

const TOKEN_TTL = '12h'
const REFRESH_TOKEN_TTL = '30d'

let cachedSecret: Uint8Array | undefined

// No hardcoded fallback secret — a missing/weak JWT_SECRET fails startup of
// whatever calls this rather than silently signing tokens with a guessable
// key. Set in .env / .env.example, never committed.
export const getJwtSecret = (): Uint8Array => {
  if (cachedSecret) return cachedSecret
  const secret = process.env['JWT_SECRET']
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters')
  }
  cachedSecret = new TextEncoder().encode(secret)
  return cachedSecret
}

export interface AuthTokenClaims {
  actorType: ActorType
  organizationId: string
  locationId?: string
}

export const signAuthToken = async (subject: string, claims: AuthTokenClaims): Promise<string> =>
  new SignJWT({ ...claims, tokenType: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getJwtSecret())

export const verifyAuthToken = async (token: string): Promise<AuthContext> => {
  const { payload } = await jwtVerify(token, getJwtSecret())
  const actorType = payload['actorType']
  const organizationId = payload['organizationId']
  if (
    payload['tokenType'] !== 'access' ||
    (actorType !== 'user' && actorType !== 'staff') ||
    typeof organizationId !== 'string' ||
    typeof payload.sub !== 'string'
  ) {
    throw new Error('malformed auth token payload')
  }
  const locationId = payload['locationId']
  return {
    actorType,
    organizationId,
    actorId: payload.sub,
    ...(typeof locationId === 'string' ? { locationId } : {}),
  }
}

// Refresh tokens are also signed JWTs (so verifying one needs no DB lookup
// to trust its claims) but carry a `tokenType: 'refresh'` claim so one can
// never be presented where an access token is expected, plus `sessionId` +
// `secret` so the server side (auth_sessions, see SessionsService) can be
// looked up by primary key and revoked/rotated — the JWT signature alone
// proves authenticity, but only the DB row makes it revocable before its
// natural expiry (logout).
export interface RefreshTokenClaims {
  actorType: ActorType
  organizationId: string
  locationId?: string
  sessionId: string
  secret: string
}

export const signRefreshToken = async (subject: string, claims: RefreshTokenClaims): Promise<string> =>
  new SignJWT({ ...claims, tokenType: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getJwtSecret())

export interface VerifiedRefreshToken extends AuthContext {
  sessionId: string
  secret: string
}

export const verifyRefreshToken = async (token: string): Promise<VerifiedRefreshToken> => {
  const { payload } = await jwtVerify(token, getJwtSecret())
  const actorType = payload['actorType']
  const organizationId = payload['organizationId']
  const sessionId = payload['sessionId']
  const secret = payload['secret']
  if (
    payload['tokenType'] !== 'refresh' ||
    (actorType !== 'user' && actorType !== 'staff') ||
    typeof organizationId !== 'string' ||
    typeof sessionId !== 'string' ||
    typeof secret !== 'string' ||
    typeof payload.sub !== 'string'
  ) {
    throw new Error('malformed refresh token payload')
  }
  const locationId = payload['locationId']
  return {
    actorType,
    organizationId,
    actorId: payload.sub,
    sessionId,
    secret,
    ...(typeof locationId === 'string' ? { locationId } : {}),
  }
}
