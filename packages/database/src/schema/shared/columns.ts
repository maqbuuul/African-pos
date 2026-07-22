import { sql } from 'drizzle-orm'
import { timestamp, uuid, type PgColumn } from 'drizzle-orm/pg-core'

// Shared column groups so every table declares its id/timestamps the same way once,
// instead of each table re-typing the same boilerplate (and risking one drifting —
// e.g. a table left without a default, or with a differently-named column).
export const primaryId = {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
}

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

// Postgres CHECK constraints are static DDL and can't take bind parameters —
// `sql\`${value}\`` would parameterize as `$1`, which fails outside a prepared
// statement. These values are our own closed enum lists (packages/domain), never
// user input, so inlining as escaped SQL string literals is safe.
const sqlLiteral = (value: string) => sql.raw(`'${value.replace(/'/g, "''")}'`)

// Builds a CHECK constraint expression restricting a column to a closed set of
// values, driven by the same array the app-layer zod schema validates against
// (see packages/domain) — one list, not a value list duplicated in SQL and in code.
export const enumCheck = (column: PgColumn, values: readonly string[]) =>
  sql`${column} in (${sql.join(values.map(sqlLiteral), sql.raw(', '))})`
