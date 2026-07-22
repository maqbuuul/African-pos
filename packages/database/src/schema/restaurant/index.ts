import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import {
  BillSplitMethodSchema,
  BillStatusSchema,
  EntityStatusSchema,
  ModifierStatusSchema,
  OrderChannelSchema,
  OrderItemStatusSchema,
  OrderStatusSchema,
  ProductStatusSchema,
  TableShapeSchema,
  TableStatusSchema,
} from '@hospitality-os/domain'

import { locations, organizations, staff } from '../shared/index.js'
import { enumCheck, primaryId, timestamps } from '../shared/columns.js'

// ---------------------------------------------------------------------------
// P3 — Menu + Product Catalog (docs/prd/03-menu-catalog.md, BUILD_WORKFLOW.md
// P3). Row-Level Security for every tenant-scoped table below is hand-written
// into the migration this schema generates, same reason as shared/index.ts:
// drizzle-kit doesn't codegen RLS. The `pg_trgm` extension and trigram search
// index (PRD 03: "Postgres full-text search on product create/update — name,
// local name, SKU") are hand-written for the same reason — no Drizzle DSL for
// operator-class-specific GIN indexes.
// ---------------------------------------------------------------------------

export const menus = pgTable('menus', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description'),
  // Day-part windows (breakfast/lunch/dinner, Ramadan/Iftar per Module 18) are
  // PRD 03's "Day-part menu switching" workflow — out of scope for P3's
  // acceptance gate (a single active menu is enough to hang categories off
  // of), but stored as an open jsonb schedule now so that feature is a
  // scheduler addition later, not a schema change.
  dayPartWindows: jsonb('day_part_windows'),
  isDefault: boolean('is_default').notNull().default(false),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('menus_organization_id_idx').on(table.organizationId),
  index('menus_location_id_idx').on(table.locationId),
  check('menus_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

export const menuCategories = pgTable('menu_categories', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  menuId: uuid('menu_id')
    .notNull()
    .references(() => menus.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  localName: text('local_name'),
  description: text('description'),
  // Category → default KDS station mapping (master plan section 6, consumed
  // by P6). Text, not an FK to a kds_stations table — that table doesn't
  // exist until P6, and the mapping here is just a station identifier string
  // a product can inherit or override.
  defaultKdsStation: text('default_kds_station'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('menu_categories_organization_id_idx').on(table.organizationId),
  index('menu_categories_menu_id_idx').on(table.menuId),
  check('menu_categories_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

// Sellable menu item. `priceAmount`/`currency` are a cache of the currently
// active `productPrices` row (see below) — never written directly outside
// ProductsService.changePrice, which closes the prior row and inserts a new
// one in the same transaction.
export const products = pgTable('products', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => menuCategories.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  localName: text('local_name'),
  description: text('description'),
  sku: text('sku'),
  photoUrl: text('photo_url'),
  priceAmount: integer('price_amount').notNull().default(0),
  currency: text('currency').notNull(),
  // No FK: Module 18's country tax adapter (tax_categories table) doesn't
  // exist yet — this is a forward-compatible placeholder id, validated at
  // the app layer once that table ships, same pattern as audit_logs.actor_id
  // pointing into a type-varying target.
  taxCategoryId: uuid('tax_category_id'),
  kdsStationOverride: text('kds_station_override'),
  status: text('status').notNull().default('draft'),
  // Fast 86 toggle, independent of `status` — a `discontinued` product is
  // never available regardless of this flag, but an `active` product can be
  // instantly 86'd mid-shift without walking it through a full lifecycle
  // transition (PRD 03 "Marking an item unavailable").
  isAvailable: boolean('is_available').notNull().default(true),
  // Optional auto-restore time a manager sets when 86'ing ("back tomorrow").
  // A scheduled job (P3 follow-up, not this phase) flips is_available back to
  // true once this passes; null means manual-restore only.
  autoRestoreAt: timestamp('auto_restore_at', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, (table) => [
  index('products_organization_id_idx').on(table.organizationId),
  index('products_location_id_idx').on(table.locationId),
  index('products_category_id_idx').on(table.categoryId),
  uniqueIndex('products_location_id_sku_key').on(table.locationId, table.sku).where(sql`${table.sku} is not null`),
  check('products_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('products_status_check', enumCheck(table.status, ProductStatusSchema.options)),
])

// Append-only price history (never overwritten — ENGINEERING_CHARTER.md
// versioning rule). Exactly one row per product has `effectiveTo IS NULL`
// (the currently active price), enforced by the partial unique index below,
// not just an app-layer convention.
export const productPrices = pgTable('product_prices', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  priceAmount: integer('price_amount').notNull(),
  currency: text('currency').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  reason: text('reason'),
  changedByStaffId: uuid('changed_by_staff_id').references(() => staff.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('product_prices_organization_id_idx').on(table.organizationId),
  index('product_prices_product_id_idx').on(table.productId, table.effectiveFrom),
  uniqueIndex('product_prices_active_key').on(table.productId).where(sql`${table.effectiveTo} is null`),
  check('product_prices_currency_len_check', sql`char_length(${table.currency}) = 3`),
])

// Reusable per-location modifier group (e.g. "Spice Level"), attached to one
// or more products via productModifierGroups rather than owned by a single
// product — PRD 03's create-product workflow explicitly allows attaching
// "existing or new" groups.
export const modifierGroups = pgTable('modifier_groups', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  // Selection rule the POS must enforce before add-to-cart (PRD 03 Business
  // Rules) — e.g. minSelect=1/maxSelect=1 for a required single choice like
  // size, minSelect=0/maxSelect=3 for optional add-ons.
  minSelect: integer('min_select').notNull().default(0),
  maxSelect: integer('max_select').notNull().default(1),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('modifier_groups_organization_id_idx').on(table.organizationId),
  index('modifier_groups_location_id_idx').on(table.locationId),
  check('modifier_groups_select_check', sql`${table.minSelect} >= 0 and ${table.maxSelect} >= ${table.minSelect}`),
  check('modifier_groups_status_check', enumCheck(table.status, ModifierStatusSchema.options)),
])

export const modifiers = pgTable('modifiers', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  modifierGroupId: uuid('modifier_group_id')
    .notNull()
    .references(() => modifierGroups.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  priceDelta: integer('price_delta').notNull().default(0),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, (table) => [
  index('modifiers_organization_id_idx').on(table.organizationId),
  index('modifiers_modifier_group_id_idx').on(table.modifierGroupId),
  check('modifiers_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('modifiers_status_check', enumCheck(table.status, ModifierStatusSchema.options)),
])

// Join table: which modifier groups a product offers, and in what order.
export const productModifierGroups = pgTable('product_modifier_groups', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  modifierGroupId: uuid('modifier_group_id')
    .notNull()
    .references(() => modifierGroups.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('product_modifier_groups_organization_id_idx').on(table.organizationId),
  index('product_modifier_groups_product_id_idx').on(table.productId),
  unique('product_modifier_groups_product_id_modifier_group_id_key').on(table.productId, table.modifierGroupId),
])

// ---------------------------------------------------------------------------
// P4 — Floor Plan + Tables (docs/prd/04-floor-plan-tables.md, BUILD_WORKFLOW.md
// P4). Same RLS-is-hand-written reasoning as the P3 block above.
// ---------------------------------------------------------------------------

export const floorPlans = pgTable('floor_plans', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  ...timestamps,
}, (table) => [
  index('floor_plans_organization_id_idx').on(table.organizationId),
  index('floor_plans_location_id_idx').on(table.locationId),
  check('floor_plans_status_check', enumCheck(table.status, EntityStatusSchema.options)),
])

// Physical or temporary table (DATA_MODEL.md). `orderId` is a forward
// reference to P5's not-yet-existing `orders` table — same no-FK-yet pattern
// as products.taxCategoryId — populated once the order engine ships;
// PRD 04 explicitly scopes this module to owning the table entity and its
// own state machine, not order content.
export const restaurantTables = pgTable('restaurant_tables', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  floorPlanId: uuid('floor_plan_id')
    .notNull()
    .references(() => floorPlans.id, { onDelete: 'restrict' }),
  label: text('label').notNull(),
  // Waiter section (PRD 04: "waiter's section by default, manager sees the
  // whole floor"; permissions table's "own section" scoping for merge/split/
  // transfer). Free text, not an FK — sections are a per-tenant floor
  // grouping, not a managed entity of their own at this phase.
  section: text('section'),
  capacity: integer('capacity').notNull().default(4),
  shape: text('shape').notNull().default('square'),
  // Floor-plan-editor drag-and-drop coordinates (PRD 04 "Floor plan editor").
  positionX: integer('position_x').notNull().default(0),
  positionY: integer('position_y').notNull().default(0),
  status: text('status').notNull().default('available'),
  // Set when seated, cleared on release back to available/cleaning. Soft
  // limit only (PRD 04 Business Rules: "warns, doesn't hard-block" — African
  // hospitality routinely seats above nominal capacity for family dining).
  partySize: integer('party_size'),
  assignedStaffId: uuid('assigned_staff_id').references(() => staff.id, { onDelete: 'set null' }),
  orderId: uuid('order_id'),
  ...timestamps,
}, (table) => [
  index('restaurant_tables_organization_id_idx').on(table.organizationId),
  index('restaurant_tables_location_id_idx').on(table.locationId),
  index('restaurant_tables_floor_plan_id_idx').on(table.floorPlanId),
  index('restaurant_tables_status_idx').on(table.status),
  index('restaurant_tables_assigned_staff_id_idx').on(table.assignedStaffId),
  uniqueIndex('restaurant_tables_location_id_label_key').on(table.locationId, table.label),
  check('restaurant_tables_capacity_check', sql`${table.capacity} > 0`),
  check('restaurant_tables_status_check', enumCheck(table.status, TableStatusSchema.options)),
  check('restaurant_tables_shape_check', enumCheck(table.shape, TableShapeSchema.options)),
])

// Tracks tables merged into one logical order session (PRD 04). An active
// merge is a row with `unmergedAt IS NULL`; the partial unique index below
// stops the same table being merged into two primaries at once. `mergedBy`/
// `unmergedByActorId` have no FK — dual-target (users vs. staff) pattern,
// same as audit_logs.actor_id and approval_requests' *_actor_id (P3 fixed a
// real bug from getting this wrong with a staff-only FK).
export const tableMerges = pgTable('table_merges', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  primaryTableId: uuid('primary_table_id')
    .notNull()
    .references(() => restaurantTables.id, { onDelete: 'restrict' }),
  mergedTableId: uuid('merged_table_id')
    .notNull()
    .references(() => restaurantTables.id, { onDelete: 'restrict' }),
  orderId: uuid('order_id'),
  mergedByActorId: uuid('merged_by_actor_id').notNull(),
  mergedAt: timestamp('merged_at', { withTimezone: true }).notNull().defaultNow(),
  unmergedByActorId: uuid('unmerged_by_actor_id'),
  unmergedAt: timestamp('unmerged_at', { withTimezone: true }),
}, (table) => [
  index('table_merges_organization_id_idx').on(table.organizationId),
  index('table_merges_primary_table_id_idx').on(table.primaryTableId),
  index('table_merges_merged_table_id_idx').on(table.mergedTableId),
  uniqueIndex('table_merges_active_merged_table_key').on(table.mergedTableId).where(sql`${table.unmergedAt} is null`),
  check('table_merges_distinct_tables_check', sql`${table.primaryTableId} <> ${table.mergedTableId}`),
])

// ---------------------------------------------------------------------------
// P5 — Order Engine Core (docs/prd/05-order-engine.md, BUILD_WORKFLOW.md P5).
// Same RLS-is-hand-written reasoning as the P3/P4 blocks above. This is the
// center-of-gravity module every later channel (QR, delivery, commerce)
// produces orders into — see packages/domain's ORDER_STATUS_TRANSITIONS /
// ORDER_ITEM_STATUS_TRANSITIONS for the state machines OrdersService enforces.
// ---------------------------------------------------------------------------

// Restaurant order/check (DATA_MODEL.md). `tableId` is null for counter sales
// (PRD 05: "the engine must not assume every order has a table"). `customerId`
// has no FK yet — P13 (CRM & Loyalty) customers table doesn't exist — same
// forward-reference placeholder pattern as products.taxCategoryId.
// `channel` is set once at creation and never mutated (Business Rules).
export const orders = pgTable('orders', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  tableId: uuid('table_id').references(() => restaurantTables.id, { onDelete: 'restrict' }),
  customerId: uuid('customer_id'),
  // 'set null' rather than 'restrict': same historical-attribution column as
  // productPrices.changedByStaffId, not a live "currently assigned" pointer.
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
  channel: text('channel').notNull(),
  status: text('status').notNull().default('open'),
  subtotalAmount: integer('subtotal_amount').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  taxAmount: integer('tax_amount').notNull().default(0),
  serviceChargeAmount: integer('service_charge_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  currency: text('currency').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('orders_organization_id_idx').on(table.organizationId),
  index('orders_location_id_idx').on(table.locationId),
  index('orders_table_id_idx').on(table.tableId),
  index('orders_staff_id_idx').on(table.staffId),
  index('orders_status_idx').on(table.status),
  check('orders_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('orders_channel_check', enumCheck(table.channel, OrderChannelSchema.options)),
  check('orders_status_check', enumCheck(table.status, OrderStatusSchema.options)),
])

// Items on an order (DATA_MODEL.md). Snapshots product name/price and each
// selected modifier's name/price at the moment the item is added (PRD 05
// Business Rules: "never a live join against current product data" — this is
// what keeps a historical order immutable even as the menu changes later).
export const orderItems = pgTable('order_items', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  nameSnapshot: text('name_snapshot').notNull(),
  localNameSnapshot: text('local_name_snapshot'),
  // Optional per PRD 05's order builder workflow ("seat/course assignment is
  // inline, not a separate step").
  seatNumber: integer('seat_number'),
  course: text('course'),
  kitchenNote: text('kitchen_note'),
  quantity: integer('quantity').notNull().default(1),
  unitPriceAmount: integer('unit_price_amount').notNull(),
  // Sum of the selected modifiers' priceDelta, per unit, at snapshot time —
  // orderItemModifiers below holds the per-modifier breakdown this is derived
  // from; this column exists so total-recompute doesn't need the join.
  modifiersPriceAmount: integer('modifiers_price_amount').notNull().default(0),
  // Gross line total before this item's own discount: (unitPrice +
  // modifiersPrice) * quantity. Recomputed by OrdersService on every
  // quantity/modifier change, never hand-edited (Business Rules).
  totalAmount: integer('total_amount').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  currency: text('currency').notNull(),
  // Forward-reference snapshot of products.taxCategoryId — Module 18's
  // country tax adapter doesn't exist yet, same no-FK-yet reasoning as the
  // column it's copied from.
  taxCategoryId: uuid('tax_category_id'),
  status: text('status').notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  voidReason: text('void_reason'),
  compReason: text('comp_reason'),
  // No FK: dual-target (users vs. staff) pattern, same as audit_logs.actorId —
  // a void/comp approver can be either actor type.
  resolvedByActorId: uuid('resolved_by_actor_id'),
  ...timestamps,
}, (table) => [
  index('order_items_organization_id_idx').on(table.organizationId),
  index('order_items_location_id_idx').on(table.locationId),
  index('order_items_order_id_idx').on(table.orderId),
  index('order_items_product_id_idx').on(table.productId),
  index('order_items_status_idx').on(table.status),
  check('order_items_quantity_check', sql`${table.quantity} > 0`),
  check('order_items_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('order_items_status_check', enumCheck(table.status, OrderItemStatusSchema.options)),
])

// Modifiers captured at time of sale (DATA_MODEL.md) — one row per selected
// modifier per order item, snapshotting name/price the same way orderItems
// snapshots the product itself.
export const orderItemModifiers = pgTable('order_item_modifiers', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  modifierId: uuid('modifier_id')
    .notNull()
    .references(() => modifiers.id, { onDelete: 'restrict' }),
  nameSnapshot: text('name_snapshot').notNull(),
  priceDeltaAmount: integer('price_delta_amount').notNull().default(0),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('order_item_modifiers_organization_id_idx').on(table.organizationId),
  index('order_item_modifiers_order_item_id_idx').on(table.orderItemId),
  check('order_item_modifiers_currency_len_check', sql`char_length(${table.currency}) = 3`),
])

// Applied discount entries (PRD 05 Business Rules: "discounts are recorded as
// their own entries (never merged into price)"). Not in DATA_MODEL.md's
// literal orders bullet list, but required by the same Business Rule that
// requires order.discount_amount to be a sum of real, reasoned entries — same
// "the schema grows to match the PRD" precedent as P3's productPrices and P4's
// tableMerges. `orderItemId` null means a bill/order-level discount rather
// than a single item's.
export const orderDiscounts = pgTable('order_discounts', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  orderItemId: uuid('order_item_id').references(() => orderItems.id, { onDelete: 'cascade' }),
  discountType: text('discount_type').notNull(),
  // Percentage discounts store 0-100; fixed discounts store a money amount in
  // the same whole-currency-unit convention as products.priceAmount.
  discountValue: integer('discount_value').notNull(),
  amountApplied: integer('amount_applied').notNull(),
  currency: text('currency').notNull(),
  reason: text('reason'),
  appliedByActorId: uuid('applied_by_actor_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('order_discounts_organization_id_idx').on(table.organizationId),
  index('order_discounts_order_id_idx').on(table.orderId),
  check('order_discounts_value_check', sql`${table.discountValue} > 0`),
  check('order_discounts_amount_applied_check', sql`${table.amountApplied} >= 0`),
  check('order_discounts_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('order_discounts_type_check', enumCheck(table.discountType, ['percentage', 'fixed'])),
])

// Payable bill generated from one order (DATA_MODEL.md). Supports split
// bills — see billItems below for how a bill references its subset of order
// items without duplicating them (PRD 05 "Splitting into bills").
export const bills = pgTable('bills', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  billNumber: integer('bill_number').notNull(),
  splitMethod: text('split_method'),
  status: text('status').notNull().default('open'),
  subtotalAmount: integer('subtotal_amount').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  taxAmount: integer('tax_amount').notNull().default(0),
  serviceChargeAmount: integer('service_charge_amount').notNull().default(0),
  tipAmount: integer('tip_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  currency: text('currency').notNull(),
  // Set once P7 (Payments Core) actually captures payment for this bill — see
  // BillStatusSchema: PRD 05 explicitly hands off payment capture itself to
  // PRD 07, this phase only carries a bill to `payment_pending`.
  paidAt: timestamp('paid_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('bills_organization_id_idx').on(table.organizationId),
  index('bills_location_id_idx').on(table.locationId),
  index('bills_order_id_idx').on(table.orderId),
  index('bills_status_idx').on(table.status),
  unique('bills_order_id_bill_number_key').on(table.orderId, table.billNumber),
  check('bills_currency_len_check', sql`char_length(${table.currency}) = 3`),
  check('bills_status_check', enumCheck(table.status, BillStatusSchema.options)),
  check('bills_split_method_check', enumCheck(table.splitMethod, BillSplitMethodSchema.options)),
])

// Line allocation to a bill (DATA_MODEL.md). A join, not a copy: order items
// are "referenced not duplicated" across bills (PRD 05) — `allocatedAmount`
// lets an evenly-split bill reference the same order item as another bill,
// each carrying only its own share.
export const billItems = pgTable('bill_items', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  allocatedAmount: integer('allocated_amount').notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('bill_items_organization_id_idx').on(table.organizationId),
  index('bill_items_bill_id_idx').on(table.billId),
  index('bill_items_order_item_id_idx').on(table.orderItemId),
  unique('bill_items_bill_id_order_item_id_key').on(table.billId, table.orderItemId),
  check('bill_items_allocated_amount_check', sql`${table.allocatedAmount} >= 0`),
  check('bill_items_currency_len_check', sql`char_length(${table.currency}) = 3`),
])

// Same purpose as shared/index.ts's tenantScopedTables — the migration
// hand-edit step's checklist, kept next to the tables it describes.
export const restaurantTenantScopedTables = [
  menus,
  menuCategories,
  products,
  productPrices,
  modifierGroups,
  modifiers,
  productModifierGroups,
  floorPlans,
  restaurantTables,
  tableMerges,
  orders,
  orderItems,
  orderItemModifiers,
  orderDiscounts,
  bills,
  billItems,
] as const
