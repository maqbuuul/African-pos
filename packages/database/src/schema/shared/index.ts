import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { ActorTypeSchema, EntityStatusSchema, PersonStatusSchema, VerticalSchema } from '@hospitality-os/domain'

import { enumCheck, primaryId, timestamps } from './columns.js'

// ---------------------------------------------------------------------------
// Shared foundation — every table here backs docs/../DATA_MODEL.md "Shared
// Foundation" section. Row-Level Security for every tenant-scoped table below
// is enabled in the same migration this schema generates (Postgres doesn't have
// an equivalent of Drizzle's schema DSL for RLS mature enough to trust for
// codegen yet, so those statements are hand-written directly into the generated
// migration file — see packages/database/src/migrations).
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  ...primaryId,
  name: text('name').notNull(),
  legalName: text('legal_name'),
  // ISO 3166-1 alpha-2 / ISO 4217 — validated for shape here, not against a
  // hardcoded country/currency list, because the product explicitly plans to
  // operate across many African countries and currencies over time.
  country: text('country').notNull(),
  defaultCurrency: text('default_currency').notNull(),
  timezone: text('timezone').notNull(),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  check('organizations_country_len_check', sql`char_length(${table.country}) = 2`),
  check('organizations_currency_len_check', sql`char_length(${table.defaultCurrency}) = 3`),
  check('organizations_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

export const businesses = pgTable('businesses', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  vertical: text('vertical').notNull(),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('businesses_organization_id_idx').on(table.organizationId),
  check('businesses_vertical_check', enumCheck(table.vertical, VerticalSchema.options)),
  check('businesses_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

export const locations = pgTable('locations', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  address: text('address'),
  country: text('country').notNull(),
  currency: text('currency').notNull(),
  timezone: text('timezone').notNull(),
  phone: text('phone'),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('locations_organization_id_idx').on(table.organizationId),
  index('locations_business_id_idx').on(table.businessId),
  unique('locations_organization_id_code_key').on(table.organizationId, table.code),
  check('locations_country_len_check', sql`char_length(${table.country}) = 2`),
  check('locations_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('locations_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

// Owner/admin identity for web login (React + Vite owner/manager/admin apps).
export const users = pgTable('users', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  // argon2id hash (packages/database/src/security/hash.ts). Nullable so a user
  // row can exist in "invited" status before the owner/admin sets a password
  // via an activation link.
  passwordHash: text('password_hash'),
  status: text('status').notNull().default('invited'),
  ...timestamps,
}, (table) => [
  index('users_organization_id_idx').on(table.organizationId),
  // Login only has an email, not an org, so email must be unique platform-wide,
  // not just per-tenant. Case-insensitive to avoid Foo@x.com / foo@x.com dupes.
  uniqueIndex('users_email_lower_key').on(sql`lower(${table.email})`),
  check('users_status_check', enumCheck(table.status, PersonStatusSchema.options)),
])

// Operational staff identity — PIN login at a specific location/device.
export const staff = pgTable('staff', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  phone: text('phone'),
  // argon2id hash of the PIN. PINs are short by design (POS speed), so
  // lookup-by-PIN happens by verifying against every active staff row at the
  // given location rather than an equality index — see AuthService.
  pinHash: text('pin_hash').notNull(),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('staff_organization_id_idx').on(table.organizationId),
  index('staff_location_id_idx').on(table.locationId),
  check('staff_status_check', enumCheck(table.status, PersonStatusSchema.options)),
])

// organizationId is nullable: a null row is a system-default role available to
// every tenant (e.g. "owner", "cashier"); a non-null row is a tenant's own
// custom role. Mirrors the same nullable-override pattern tenant_settings uses
// for location-level overrides — roles are data, not a hardcoded enum, so a
// tenant can define a role the product never anticipated.
export const roles = pgTable('roles', {
  ...primaryId,
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description'),
  ...timestamps,
}, (table) => [
  index('roles_organization_id_idx').on(table.organizationId),
  uniqueIndex('roles_system_name_key').on(table.name).where(sql`${table.organizationId} is null`),
  uniqueIndex('roles_organization_id_name_key')
    .on(table.organizationId, table.name)
    .where(sql`${table.organizationId} is not null`),
])

// Global capability catalog — not tenant-scoped. Which role has which
// permission is tenant data (role_permissions); the catalog of what
// capabilities exist at all is a platform concern, seeded once.
export const permissions = pgTable('permissions', {
  ...primaryId,
  key: text('key').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique('permissions_key_key').on(table.key)])

export const rolePermissions = pgTable('role_permissions', {
  ...primaryId,
  // Denormalized from roles.organization_id so RLS can filter this table
  // directly instead of via a join into roles on every access.
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'restrict' }),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('role_permissions_organization_id_idx').on(table.organizationId),
  unique('role_permissions_role_id_permission_id_key').on(table.roleId, table.permissionId),
])

export const staffRoles = pgTable('staff_roles', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staff.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('staff_roles_organization_id_idx').on(table.organizationId),
  unique('staff_roles_staff_id_role_id_location_id_key').on(table.staffId, table.roleId, table.locationId),
])

// Configurable per-organization (and optionally per-location override)
// key/value settings. A null location_id row is the org-wide default; a
// non-null row overrides it for that one location.
export const tenantSettings = pgTable('tenant_settings', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  updatedByStaffId: uuid('updated_by_staff_id').references(() => staff.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('tenant_settings_organization_id_idx').on(table.organizationId),
  uniqueIndex('tenant_settings_org_key_key')
    .on(table.organizationId, table.key)
    .where(sql`${table.locationId} is null`),
  uniqueIndex('tenant_settings_org_location_key_key')
    .on(table.organizationId, table.locationId, table.key)
    .where(sql`${table.locationId} is not null`),
])

export const devices = pgTable('devices', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  // e.g. 'pos', 'kds', 'admin', 'kiosk' — text, not an enum, because new device
  // classes will show up as the product grows and shouldn't require a migration.
  deviceType: text('device_type').notNull(),
  platform: text('platform'),
  status: text('status').notNull().default('active'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('devices_organization_id_idx').on(table.organizationId),
  index('devices_location_id_idx').on(table.locationId),
  check('devices_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

// Immutable operational audit trail. Insert-only — enforced by a trigger
// (see migration) that rejects UPDATE/DELETE, not just an app-layer convention.
export const auditLogs = pgTable('audit_logs', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  actorType: text('actor_type').notNull(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  reason: text('reason'),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_logs_organization_id_idx').on(table.organizationId),
  index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  check('audit_logs_actor_type_check', enumCheck(table.actorType, ActorTypeSchema.options)),
])

export const approvalRequests = pgTable('approval_requests', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  // No FK to `staff`: the requester is normally a PIN-login staff member
  // (PermissionsGuard's override flow), but the *approver* of a P3 large
  // price change is deliberately an owner (`users` row, not `staff` — see
  // seed/index.ts's products:approve_large_price_change grant), and a future
  // requester could equally be a `users` actor. Same reasoning as
  // audit_logs.actorId: this points into either table depending on context,
  // and no single foreign table covers both.
  requestedByActorId: uuid('requested_by_actor_id').notNull(),
  approvedByActorId: uuid('approved_by_actor_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  // Set the instant a guard lets a retried request through on the strength of
  // this approval (see PermissionsGuard). Distinct from `approvedAt`: a
  // manager can approve well before the requester retries, and this must
  // only ever be set once — an approved-but-unconsumed row must not grant a
  // second retry, which is what makes the override a one-time spend instead
  // of a standing permission bypass.
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
}, (table) => [
  index('approval_requests_organization_id_idx').on(table.organizationId),
  check(
    'approval_requests_status_check',
    enumCheck(table.status, ['pending', 'approved', 'rejected', 'cancelled']),
  ),
])

// Server-side-revocable refresh tokens (master plan Module 2: "Refresh
// tokens", "Session management"). The access JWT (jwt.ts) stays short-lived
// and purely stateless; this table is what makes the *refresh* token
// revocable on logout without maintaining a blocklist of every access token
// ever issued. `refreshTokenHash` is argon2id — same credential-hashing
// story as every other secret in the system (see security/hash.ts) — hashing
// a per-session random secret, not the JWT string itself; the session id and
// that secret both live inside the signed refresh JWT (see auth/jwt.ts), so
// looking a session up never needs an unscoped table scan.
export const authSessions = pgTable('auth_sessions', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  actorType: text('actor_type').notNull(),
  // No FK: mirrors audit_logs.actor_id — points into either `users` or
  // `staff` depending on actorType, and no single foreign table covers both.
  actorId: uuid('actor_id').notNull(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('auth_sessions_organization_id_idx').on(table.organizationId),
  index('auth_sessions_actor_idx').on(table.actorType, table.actorId),
  check('auth_sessions_actor_type_check', enumCheck(table.actorType, ActorTypeSchema.options)),
])

// Marks which of the above tables carry tenant data and therefore require RLS —
// consumed by the migration hand-edit step and by anything else (tests, docs)
// that needs the same list without redefining it.
export const tenantScopedTables = [
  organizations,
  businesses,
  locations,
  users,
  staff,
  roles,
  rolePermissions,
  staffRoles,
  tenantSettings,
  devices,
  auditLogs,
  approvalRequests,
  authSessions,
] as const
