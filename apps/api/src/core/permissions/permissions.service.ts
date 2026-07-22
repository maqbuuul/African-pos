import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { permissions, rolePermissions, roles, staffRoles, type Db } from '@hospitality-os/database'

import type { AuthContext } from '../tenant/tenant.types.js'

// users (owner/admin web accounts) don't have their own staff_roles entries —
// DATA_MODEL.md keeps `users` (web login) and `staff` (PIN login) as separate
// identities. A `users` row implicitly acts under the system "owner" role's
// full permission set for its organization, since a `users` account is by
// definition the organization's own owner/admin. The permission set itself
// still comes from the DB-seeded owner role's role_permissions, not a
// hardcoded list here — only the "which role" mapping for this one actor
// type is fixed.
const OWNER_ROLE_NAME = 'owner'

@Injectable()
export class PermissionsService {
  async listGrantedPermissions(db: Db, authContext: AuthContext): Promise<string[]> {
    const rows =
      authContext.actorType === 'user'
        ? await db
            .select({ key: permissions.key })
            .from(rolePermissions)
            .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(and(eq(roles.name, OWNER_ROLE_NAME), isNull(roles.organizationId)))
        : await db
            .select({ key: permissions.key })
            .from(staffRoles)
            .innerJoin(rolePermissions, eq(rolePermissions.roleId, staffRoles.roleId))
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(eq(staffRoles.staffId, authContext.actorId))

    return [...new Set(rows.map((row) => row.key))]
  }
}
