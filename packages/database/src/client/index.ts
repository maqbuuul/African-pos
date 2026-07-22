import { Pool, type PoolClient } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

export type Db = NodePgDatabase<typeof schema>

// System pool: connects as the schema-owning role (pos_user, DATABASE_URL).
// For migrations, seeding, and other administrative operations that must see
// across every tenant — never for serving API requests. pos_user is a
// Postgres superuser and unconditionally bypasses Row-Level Security, so RLS
// is decorative on this connection (see infra/postgres/init.sql).
export const createSystemPool = (connectionString: string) => new Pool({ connectionString })

export const createSystemDb = (pool: Pool): Db => drizzle(pool, { schema })

// Application pool: connects as pos_app (APP_DATABASE_URL), the low-privilege
// role Row-Level Security actually applies to. Every request-serving query
// must go through a connection from this pool, scoped with withTenantContext
// below — never queried directly against the pool.
export const createAppPool = (connectionString: string) => new Pool({ connectionString })

// Runs `fn` inside a transaction with the tenant's organization id set as
// Postgres session state, which every RLS policy reads via
// app_current_organization_id() (see the shared_foundation migration).
// set_config(..., true) is the parameterized equivalent of `SET LOCAL` — SET
// itself can't take a bind parameter, and string-interpolating the id into
// raw SQL would reopen the injection risk RLS is meant to close off.
//
// SET LOCAL is transaction-scoped, so this owns the whole transaction: one
// checked-out client, one BEGIN/COMMIT/ROLLBACK. Never share a client or a
// transaction across requests.
//
// organizationId is null only for the one legitimate pre-authentication
// case — looking a user up by email at login, before their organization is
// known. The users table's SELECT policy is the only one that relaxes for a
// null tenant context; every other table stays fully locked out.
export const withTenantContext = async <T>(
  pool: Pool,
  organizationId: string | null,
  fn: (db: Db) => Promise<T>,
): Promise<T> => {
  const client: PoolClient = await pool.connect()
  try {
    await client.query('BEGIN')
    if (organizationId) {
      await client.query("SELECT set_config('app.current_organization_id', $1, true)", [
        organizationId,
      ])
    }
    const result = await fn(drizzle(client, { schema }))
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
