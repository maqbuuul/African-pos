export interface SyncTokenPayload {
  deviceId: string
  organizationId: string
  locationId: string
  staffId: string
  iat?: number
  exp?: number
}

export function buildSyncTokenPayload(
  deviceId: string,
  organizationId: string,
  locationId: string,
  staffId: string,
  ttlMinutes = 120,
): SyncTokenPayload {
  const now = Math.floor(Date.now() / 1000)
  return {
    deviceId,
    organizationId,
    locationId,
    staffId,
    iat: now,
    exp: now + ttlMinutes * 60,
  }
}
