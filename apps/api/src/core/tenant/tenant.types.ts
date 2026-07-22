export type ActorType = 'user' | 'staff'

// Attached to the request by TenantContextMiddleware after verifying the
// bearer JWT. Absent entirely on unauthenticated requests (public routes,
// or a request with no/invalid token) — code must not assume it's present.
export interface AuthContext {
  actorType: ActorType
  actorId: string
  organizationId: string
  locationId?: string
}

declare module 'express-serve-static-core' {
  interface Request {
    authContext?: AuthContext
  }
}
