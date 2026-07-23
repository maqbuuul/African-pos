// P10 — Offline Sync: Device-side SQLite schema mirrors the tables PowerSync
// manages for the download path. These tables match the bucket definitions in
// packages/offline-sync/powersync.yaml. Upload-path tables (operation queue)
// are managed by PowerSync's CRUD queue, not declared here.
//
// This file is consumed by apps/pos-mobile's SQLite initialization and by the
// PowerSync client SDK schema registration.
//
// Tables prefixed with powersync_ are managed by the PowerSync SDK.

// Download path: read-only mirrored tables.
export const DEVICE_SYNC_TABLES = [
  'products',
  'product_prices',
  'menu_categories',
  'modifier_groups',
  'modifiers',
  'floor_plans',
  'restaurant_tables',
  'staff',
  'staff_roles',
  'role_permissions',
  'permissions',
  'orders',
  'order_items',
  'tenant_settings',
] as const

export type DeviceSyncTable = (typeof DEVICE_SYNC_TABLES)[number]

// SQL to create local mirror tables on first launch.
// Uses "IF NOT EXISTS" so re-runs are safe.
export const DEVICE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sku" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_prices" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "product_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "effective_from" TEXT NOT NULL,
  "effective_to" TEXT,
  "created_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "menu_categories" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "modifier_groups" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "min_select" INTEGER NOT NULL DEFAULT 0,
  "max_select" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "modifiers" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "group_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "floor_plans" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "restaurant_tables" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "floor_plan_id" TEXT,
  "label" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 4,
  "status" TEXT NOT NULL DEFAULT 'available',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pin" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_roles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "role" TEXT NOT NULL,
  "permission_key" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "created_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "table_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "channel" TEXT NOT NULL DEFAULT 'pos',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "order_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "product_name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "tenant_settings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organization_id" TEXT NOT NULL,
  "location_id" TEXT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
`
