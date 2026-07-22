import { SetMetadata } from '@nestjs/common'

export const PERMISSION_KEY = 'requiredPermission'

export interface RequiredPermission {
  permission: string
  // When true, a staff member who lacks `permission` doesn't get an outright
  // 403 — PermissionsGuard creates a pending approval_requests row instead
  // and the route responds 202 (see ApprovalRequiredFilter). Only for the
  // "sensitive actions requiring approval" class named in master plan
  // Module 2 (void, refund, discount, deactivate, ...) — leave it off for
  // everything else, where a missing permission should just be a flat 403.
  allowOverride?: boolean | undefined
  // Recorded on the approval_requests row an override creates, so an
  // approvals dashboard can show "staff deactivation" instead of a bare
  // permission key. The entity id itself is read off the route's `:id`
  // param by the guard, not configured here.
  entityType?: string | undefined
}

// Permission strings are checked against DB-stored role_permissions at
// request time (see PermissionsGuard) — this decorator only names which
// capability a route needs, it doesn't define what that capability grants.
export const RequirePermission = (
  permission: string,
  options?: { allowOverride?: boolean; entityType?: string },
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, {
    permission,
    allowOverride: options?.allowOverride,
    entityType: options?.entityType,
  } satisfies RequiredPermission)
