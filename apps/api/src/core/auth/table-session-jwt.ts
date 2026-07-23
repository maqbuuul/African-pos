import { SignJWT, jwtVerify } from 'jose'

import { getJwtSecret } from './jwt.js'

const TABLE_SESSION_TTL = '2h'

export interface TableSessionClaims {
  organizationId: string
  locationId: string
  tableId: string
  qrSlug: string
  tokenType: 'table_session'
}

export interface VerifiedTableSession {
  organizationId: string
  locationId: string
  tableId: string
  qrSlug: string
}

export const signTableSessionToken = async (claims: TableSessionClaims): Promise<string> =>
  new SignJWT({ ...claims, tokenType: 'table_session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.tableId)
    .setIssuedAt()
    .setExpirationTime(TABLE_SESSION_TTL)
    .sign(getJwtSecret())

export const verifyTableSessionToken = async (token: string): Promise<VerifiedTableSession> => {
  const { payload } = await jwtVerify(token, getJwtSecret())
  if (
    payload['tokenType'] !== 'table_session' ||
    typeof payload['organizationId'] !== 'string' ||
    typeof payload['locationId'] !== 'string' ||
    typeof payload['tableId'] !== 'string' ||
    typeof payload['qrSlug'] !== 'string'
  ) {
    throw new Error('malformed table session token')
  }
  return {
    organizationId: payload['organizationId'] as string,
    locationId: payload['locationId'] as string,
    tableId: payload['tableId'] as string,
    qrSlug: payload['qrSlug'] as string,
  }
}
