import { SignJWT, jwtVerify } from 'jose'

import { getJwtSecret } from '../../core/auth/jwt.js'

const PAYMENT_LINK_TTL = '24h'

export interface PaymentLinkClaims {
  organizationId: string
  orderId: string
  billId: string
  splitId: string
  tokenType: 'payment_link'
}

export interface VerifiedPaymentLink {
  organizationId: string
  orderId: string
  billId: string
  splitId: string
}

export const signPaymentLinkToken = async (claims: PaymentLinkClaims): Promise<string> =>
  new SignJWT({ ...claims, tokenType: 'payment_link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.splitId)
    .setIssuedAt()
    .setExpirationTime(PAYMENT_LINK_TTL)
    .sign(getJwtSecret())

export const verifyPaymentLinkToken = async (token: string): Promise<VerifiedPaymentLink> => {
  const { payload } = await jwtVerify(token, getJwtSecret())
  if (
    payload['tokenType'] !== 'payment_link' ||
    typeof payload['organizationId'] !== 'string' ||
    typeof payload['orderId'] !== 'string' ||
    typeof payload['billId'] !== 'string' ||
    typeof payload['splitId'] !== 'string'
  ) {
    throw new Error('malformed payment link token')
  }
  return {
    organizationId: payload['organizationId'] as string,
    orderId: payload['orderId'] as string,
    billId: payload['billId'] as string,
    splitId: payload['splitId'] as string,
  }
}
