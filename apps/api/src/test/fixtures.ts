import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import {
  bills,
  businesses,
  cashDrawerAdjustments,
  cashDrawerSessions,
  createSystemDb,
  createSystemPool,
  customerFeedback,
  customers,
  devices,
  events,
  floorPlans,
  giftCards,
  receipts,
  goodsReceipts,
  hashSecret,
  integrationConnections,
  inventoryItems,
  kdsStations,
  kitchenTickets,
  locations,
  loyaltyEvents,
  menus,
  menuCategories,
  mpesaC2bTransactions,
  orderDiscounts,
  orderItems,
  orders,
  organizations,
  paymentIntents,
  payments,
  productPrices,
  products,
  purchaseOrders,
  recipes,
  refunds,
  restaurantTables,
  roles,
  shifts,
  stockAdjustments,
  stockCounts,
  stockLevels,
  stockLocations,
  syncConflicts,
  syncCursors,
  syncOperations,
  stockMovements,
  suppliers,
  tableMerges,
  taxComplianceSubmissions,
  staff,
  staffAttendance,
  staffRoles,
  tips,
  users,
  wastageEvents,
  type Db,
} from '@hospitality-os/database'
import type { AuthContext } from '../core/tenant/tenant.types.js'

// System pool (pos_user, DATABASE_URL) — bypasses RLS, same role `db:seed`
// runs as. Fixture setup/teardown is privileged scaffolding around the test,
// not the thing under test; the service methods under test still run
// through the RLS-enforced APP_POOL/pos_app connection via withTenantContext.
const systemPool = createSystemPool(process.env['DATABASE_URL']!)
export const systemDb: Db = createSystemDb(systemPool)

export async function closeFixturePool(): Promise<void> {
  await systemPool.end()
}

export interface LocationFixture {
  organizationId: string
  businessId: string
  locationId: string
}

export interface BillFixture {
  organizationId: string
  locationId: string
  orderId: string
  billId: string
}

// Creates an isolated organization → business → location chain. Each test
// gets its own organization so tests can run without stepping on each
// other's idempotency keys / permission grants / RLS visibility.
export async function createLocationFixture(
  overrides: { currency?: string } = {},
): Promise<LocationFixture> {
  const currency = overrides.currency ?? 'KES'

  const [org] = await systemDb
    .insert(organizations)
    .values({
      name: `Test Org ${randomUUID()}`,
      country: 'KE',
      defaultCurrency: currency,
      timezone: 'Africa/Nairobi',
    })
    .returning()
  if (!org) throw new Error('failed to create test organization')

  const [business] = await systemDb
    .insert(businesses)
    .values({ organizationId: org.id, name: 'Test Business', vertical: 'restaurant' })
    .returning()
  if (!business) throw new Error('failed to create test business')

  const [location] = await systemDb
    .insert(locations)
    .values({
      organizationId: org.id,
      businessId: business.id,
      name: 'Test Location',
      code: `LOC-${randomUUID().slice(0, 8)}`,
      country: 'KE',
      currency,
      timezone: 'Africa/Nairobi',
    })
    .returning()
  if (!location) throw new Error('failed to create test location')

  return { organizationId: org.id, businessId: business.id, locationId: location.id }
}

export async function deleteLocationFixture(fixture: LocationFixture): Promise<void> {
  // audit_logs.location_id is ON DELETE SET NULL, but that SET NULL is itself
  // an UPDATE on audit_logs — which audit_logs_immutable (0000_shared_foundation.sql)
  // unconditionally rejects, cascade or not. So deleting a location this test
  // wrote a (non-null-locationId) audit log entry for fails exactly the same
  // way deleting its organization always does (ON DELETE RESTRICT there).
  // Fall back to leaving the location/business behind, same accepted cost as
  // the organization row below — not worth a special-case "only delete if no
  // audit log referenced it" query for what's already a dev-DB-only cost.
  try {
    await systemDb.delete(locations).where(eq(locations.id, fixture.locationId))
    await systemDb.delete(businesses).where(eq(businesses.id, fixture.businessId))
  } catch {
    // left behind — see comment above.
  }
  // organizations row is intentionally left behind — see deleteBillFixture's
  // comment on audit_logs.organization_id being ON DELETE RESTRICT.
}

// Creates an isolated organization → business → location → order → bill
// chain for a single test. Each test gets its own organization so tests can
// run without stepping on each other's idempotency keys / permission grants.
export async function createBillFixture(
  overrides: { totalAmount?: number; currency?: string } = {},
): Promise<BillFixture> {
  const currency = overrides.currency ?? 'KES'
  const totalAmount = overrides.totalAmount ?? 1000

  const { organizationId: orgId, locationId } = await createLocationFixture({ currency })
  const org = { id: orgId }
  const location = { id: locationId }

  const [order] = await systemDb
    .insert(orders)
    .values({
      organizationId: org.id,
      locationId: location.id,
      channel: 'pos',
      status: 'bill_requested',
      totalAmount,
      currency,
    })
    .returning()
  if (!order) throw new Error('failed to create test order')

  const [bill] = await systemDb
    .insert(bills)
    .values({
      organizationId: org.id,
      locationId: location.id,
      orderId: order.id,
      billNumber: 1,
      status: 'open',
      totalAmount,
      currency,
    })
    .returning()
  if (!bill) throw new Error('failed to create test bill')

  return { organizationId: org.id, locationId: location.id, orderId: order.id, billId: bill.id }
}

// Deletes everything created for one organization's worth of order/bill/
// payment test data, deepest dependents first (every FK in this schema is
// onDelete: 'restrict' — nothing cascades automatically except where noted).
// Shared by deleteBillFixture and any test (e.g. orders.service.spec.ts)
// that builds its own orders/items directly off a LocationFixture rather
// than going through createBillFixture.
export async function deleteOrgOrderData(organizationId: string): Promise<void> {
  await systemDb.delete(refunds).where(eq(refunds.organizationId, organizationId))
  await systemDb.delete(tips).where(eq(tips.organizationId, organizationId))
  await systemDb.delete(payments).where(eq(payments.organizationId, organizationId))
  await systemDb.delete(paymentIntents).where(eq(paymentIntents.organizationId, organizationId))
  await systemDb.delete(mpesaC2bTransactions).where(eq(mpesaC2bTransactions.organizationId, organizationId))
  await systemDb.delete(integrationConnections).where(eq(integrationConnections.organizationId, organizationId))
  // Outbox domain events (events.location_id is FK-restricted, so these must
  // go before locations below). audit_logs is deliberately NOT deleted here —
  // audit_logs_immutable (0000_shared_foundation.sql) forbids UPDATE/DELETE
  // on that table outright (Engineering Charter: append-only), so any
  // organization a test wrote an audit log entry for can never have that
  // row removed. This is working as designed, not a fixture bug.
  await systemDb.delete(events).where(eq(events.organizationId, organizationId))
  // kitchen_tickets.order_id and order_discounts.order_id are both
  // onDelete:'restrict' against orders, and order_items.order_id likewise —
  // all three must go before orders itself. kitchen_ticket_items/
  // order_item_modifiers/bill_items all cascade automatically from these.
  // receipts.bill_id is also restrict (notifications-owned, but must be
  // cleared before bills here), and tax_compliance_submissions.receipt_id
  // is restrict against receipts in turn — clear both before bills/orders.
  await systemDb.delete(kitchenTickets).where(eq(kitchenTickets.organizationId, organizationId))
  await systemDb.delete(orderDiscounts).where(eq(orderDiscounts.organizationId, organizationId))
  await systemDb.delete(orderItems).where(eq(orderItems.organizationId, organizationId))
  await systemDb.delete(taxComplianceSubmissions).where(eq(taxComplianceSubmissions.organizationId, organizationId))
  await systemDb.delete(receipts).where(eq(receipts.organizationId, organizationId))
  await systemDb.delete(bills).where(eq(bills.organizationId, organizationId))
  await systemDb.delete(orders).where(eq(orders.organizationId, organizationId))
  // Locations (and their businesses) are left to deleteLocationFixture-style
  // best-effort cleanup — see that function's comment: a location any test
  // wrote a non-null-locationId audit log entry against can't be deleted
  // either, for the same immutable-audit-log reason organizations can't.
  // That row (and its business, transitively kept alive by
  // locations->businesses FKs) is intentionally left behind on failure: a
  // few orphaned rows per test run is the accepted cost of testing against a
  // real, honestly-immutable audit log instead of one that secretly allows
  // deletes only in tests.
  const orgLocations = await systemDb.select().from(locations).where(eq(locations.organizationId, organizationId))
  try {
    await systemDb.delete(locations).where(eq(locations.organizationId, organizationId))
    for (const businessId of new Set(orgLocations.map((l) => l.businessId))) {
      await systemDb.delete(businesses).where(eq(businesses.id, businessId))
    }
  } catch {
    // left behind — see comment above.
  }
}

export async function deleteBillFixture(fixture: Pick<BillFixture, 'organizationId'>): Promise<void> {
  await deleteOrgOrderData(fixture.organizationId)
}

// actorType 'user' resolves to the global `owner` role's full permission set
// regardless of actorId (PermissionsService.listGrantedPermissions has no
// actorId filter for 'user' actors) — a fresh random UUID is enough, no
// users row needs to exist for permission checks to pass.
export function testActorContext(fixture: Pick<BillFixture, 'organizationId' | 'locationId'>): AuthContext {
  return {
    actorType: 'user',
    actorId: randomUUID(),
    organizationId: fixture.organizationId,
    locationId: fixture.locationId,
  }
}

// System roles (organizationId null) are seeded once, platform-wide, by
// `pnpm db:seed` (packages/database/src/seed/index.ts's SYSTEM_ROLES) — not
// per-test-org. Looking one up by name and granting it to a fresh test staff
// row via staff_roles is how a test staff member gets a real, non-owner
// permission set without re-seeding the whole catalog per test.
export async function getSystemRoleId(roleName: string): Promise<string> {
  const [role] = await systemDb.select().from(roles).where(and(eq(roles.name, roleName), isNull(roles.organizationId)))
  if (!role) {
    throw new Error(`system role "${roleName}" not found — has \`pnpm db:seed\` been run against this database?`)
  }
  return role.id
}

export interface StaffFixture {
  staffId: string
  name: string
  pin: string
}

// Creates a PIN-login staff row at the given location and grants it one
// system role (waiter/cashier/branch_manager/etc — see SYSTEM_ROLES). The
// returned `pin` is the plaintext PIN a test can log in with; only its
// argon2id hash is ever persisted, matching AuthService.staffPinLogin.
export async function createStaffFixture(
  location: Pick<LocationFixture, 'organizationId' | 'locationId'>,
  roleName: string,
  overrides: { name?: string; pin?: string } = {},
): Promise<StaffFixture> {
  const pin = overrides.pin ?? '1234'
  const [row] = await systemDb
    .insert(staff)
    .values({
      organizationId: location.organizationId,
      locationId: location.locationId,
      name: overrides.name ?? 'Test Staff',
      pinHash: await hashSecret(pin),
    })
    .returning()
  if (!row) throw new Error('failed to create test staff')

  const roleId = await getSystemRoleId(roleName)
  await systemDb.insert(staffRoles).values({
    organizationId: location.organizationId,
    staffId: row.id,
    roleId,
    locationId: location.locationId,
  })

  return { staffId: row.id, name: row.name, pin }
}

export function staffActorContext(
  location: Pick<LocationFixture, 'organizationId' | 'locationId'>,
  staffFixture: Pick<StaffFixture, 'staffId'>,
): AuthContext {
  return {
    actorType: 'staff',
    actorId: staffFixture.staffId,
    organizationId: location.organizationId,
    locationId: location.locationId,
  }
}

export async function deleteStaffFixture(staffFixture: Pick<StaffFixture, 'staffId'>): Promise<void> {
  await systemDb.delete(staffAttendance).where(eq(staffAttendance.staffId, staffFixture.staffId))
  await systemDb.delete(staffRoles).where(eq(staffRoles.staffId, staffFixture.staffId))
  await systemDb.delete(staff).where(eq(staff.id, staffFixture.staffId))
}

export interface OwnerUserFixture {
  userId: string
  email: string
  password: string
}

// Creates a web-login owner account (users table — distinct identity from
// PIN-login staff, see DATA_MODEL.md). actorType 'user' always resolves to
// the global owner role's full permission set (PermissionsService), so this
// is for exercising AuthService.ownerLogin itself, not for permission-scoped
// service tests (use createStaffFixture + a narrower role for those).
export async function createOwnerUserFixture(
  organizationId: string,
  overrides: { email?: string; password?: string; status?: 'active' | 'invited' | 'suspended' | 'deactivated' } = {},
): Promise<OwnerUserFixture> {
  const email = overrides.email ?? `owner-${randomUUID()}@test.hospitality-os.dev`
  const password = overrides.password ?? 'correct horse battery staple'
  const [row] = await systemDb
    .insert(users)
    .values({
      organizationId,
      name: 'Test Owner',
      email,
      passwordHash: await hashSecret(password),
      status: overrides.status ?? 'active',
    })
    .returning()
  if (!row) throw new Error('failed to create test owner user')
  return { userId: row.id, email, password }
}

export async function deleteOwnerUserFixture(ownerFixture: Pick<OwnerUserFixture, 'userId'>): Promise<void> {
  await systemDb.delete(users).where(eq(users.id, ownerFixture.userId))
}

export interface ProductFixture {
  menuId: string
  categoryId: string
  productId: string
  priceAmount: number
  currency: string
}

// Creates the menu -> category -> product chain a real order/inventory/CRM
// flow needs a product to exist at all (products.category_id is NOT NULL).
// Bypasses ProductsService entirely — this is test data setup, not the thing
// under test, same rationale as every other fixture in this file.
export async function createProductFixture(
  location: Pick<LocationFixture, 'organizationId' | 'locationId'>,
  overrides: { name?: string; priceAmount?: number; currency?: string; isAvailable?: boolean; status?: string } = {},
): Promise<ProductFixture> {
  const currency = overrides.currency ?? 'KES'
  const priceAmount = overrides.priceAmount ?? 500

  const [menu] = await systemDb
    .insert(menus)
    .values({ organizationId: location.organizationId, locationId: location.locationId, name: 'Test Menu' })
    .returning()
  if (!menu) throw new Error('failed to create test menu')

  const [category] = await systemDb
    .insert(menuCategories)
    .values({
      organizationId: location.organizationId,
      locationId: location.locationId,
      menuId: menu.id,
      name: 'Test Category',
      // Every order.send()/sendCourse() routes fired items to a KDS station
      // by this code (KdsService.createTicketsForSentItems) — set a default
      // so order-lifecycle tests don't need to know about KDS routing to
      // fire an item. Pair with createKdsStationFixture(location, 'kitchen')
      // for any test that actually calls send()/sendCourse().
      defaultKdsStation: 'kitchen',
    })
    .returning()
  if (!category) throw new Error('failed to create test category')

  const [product] = await systemDb
    .insert(products)
    .values({
      organizationId: location.organizationId,
      locationId: location.locationId,
      categoryId: category.id,
      name: overrides.name ?? 'Test Product',
      priceAmount,
      currency,
      status: overrides.status ?? 'active',
      isAvailable: overrides.isAvailable ?? true,
    })
    .returning()
  if (!product) throw new Error('failed to create test product')

  // Every product created via the real ProductsService.create() atomically
  // opens a price-history row alongside the product itself (see
  // products.service.ts) — mirror that invariant here so fixture-created
  // products behave like real ones for anything exercising price history.
  await systemDb.insert(productPrices).values({
    organizationId: location.organizationId,
    productId: product.id,
    priceAmount,
    currency,
    reason: 'initial price (fixture)',
  })

  return { menuId: menu.id, categoryId: category.id, productId: product.id, priceAmount, currency }
}

export async function deleteProductFixture(fixture: ProductFixture): Promise<void> {
  // product_prices.product_id is onDelete:'restrict' — any test that called
  // ProductsService.create/changePrice against this product (both insert a
  // price-history row) must clear those first.
  await systemDb.delete(productPrices).where(eq(productPrices.productId, fixture.productId))
  await systemDb.delete(products).where(eq(products.id, fixture.productId))
  await systemDb.delete(menuCategories).where(eq(menuCategories.id, fixture.categoryId))
  await systemDb.delete(menus).where(eq(menus.id, fixture.menuId))
}

export interface KdsStationFixture {
  stationId: string
  code: string
}

// code='kitchen' matches createProductFixture's category default —
// KdsService.createTicketsForSentItems routes a fired item to the active
// station whose code equals the product's category's defaultKdsStation.
export async function createKdsStationFixture(
  location: Pick<LocationFixture, 'organizationId' | 'locationId'>,
  code = 'kitchen',
): Promise<KdsStationFixture> {
  const [station] = await systemDb
    .insert(kdsStations)
    .values({ organizationId: location.organizationId, locationId: location.locationId, code, name: `Test Station (${code})` })
    .returning()
  if (!station) throw new Error('failed to create test KDS station')
  return { stationId: station.id, code: station.code }
}

export async function deleteKdsStationFixture(fixture: KdsStationFixture): Promise<void> {
  await systemDb.delete(kdsStations).where(eq(kdsStations.id, fixture.stationId))
}

export interface FloorPlanFixture {
  floorPlanId: string
}

export async function createFloorPlanFixture(location: Pick<LocationFixture, 'organizationId' | 'locationId'>): Promise<FloorPlanFixture> {
  const [plan] = await systemDb
    .insert(floorPlans)
    .values({ organizationId: location.organizationId, locationId: location.locationId, name: 'Test Floor Plan' })
    .returning()
  if (!plan) throw new Error('failed to create test floor plan')
  return { floorPlanId: plan.id }
}

export async function deleteFloorPlanFixture(fixture: FloorPlanFixture): Promise<void> {
  await systemDb.delete(floorPlans).where(eq(floorPlans.id, fixture.floorPlanId))
}

export interface TableFixture {
  tableId: string
  floorPlanId: string
}

// Creates its own floor plan (1:1, deleted together) unless the caller wants
// several tables sharing one plan — pass an existing FloorPlanFixture in that
// case and skip calling deleteTableFixture's floor-plan cleanup (delete the
// shared plan once yourself instead).
export async function createTableFixture(
  location: Pick<LocationFixture, 'organizationId' | 'locationId'>,
  overrides: { floorPlanId?: string; label?: string; section?: string; capacity?: number; qrSlug?: string } = {},
): Promise<TableFixture> {
  const floorPlanId = overrides.floorPlanId ?? (await createFloorPlanFixture(location)).floorPlanId
  const [table] = await systemDb
    .insert(restaurantTables)
    .values({
      organizationId: location.organizationId,
      locationId: location.locationId,
      floorPlanId,
      label: overrides.label ?? 'T1',
      section: overrides.section ?? null,
      capacity: overrides.capacity ?? 4,
      qrSlug: overrides.qrSlug ?? null,
    })
    .returning()
  if (!table) throw new Error('failed to create test table')
  return { tableId: table.id, floorPlanId }
}

// Deletes the table and, if it owns the only reference to its floor plan,
// the plan too. Safe to call even when the plan is shared — deleting a
// floor plan still referenced by another table would fail its own FK
// (restaurant_tables.floor_plan_id is onDelete:'restrict'), so this only
// attempts the plan delete, best-effort.
export async function deleteTableFixture(fixture: TableFixture): Promise<void> {
  // table_merges.primary_table_id/merged_table_id are onDelete:'restrict' —
  // any merge (active or already-unmerged) referencing this table blocks its
  // deletion otherwise.
  await systemDb.delete(tableMerges).where(eq(tableMerges.primaryTableId, fixture.tableId))
  await systemDb.delete(tableMerges).where(eq(tableMerges.mergedTableId, fixture.tableId))
  await systemDb.delete(restaurantTables).where(eq(restaurantTables.id, fixture.tableId))
  try {
    await systemDb.delete(floorPlans).where(eq(floorPlans.id, fixture.floorPlanId))
  } catch {
    // still referenced by a sibling table sharing this plan — leave it.
  }
}

// Deletes everything InventoryService can write for one organization,
// deepest dependents first. purchase_order_items/recipe_ingredients cascade
// automatically from purchase_orders/recipes so aren't listed separately.
export async function deleteOrgInventoryData(organizationId: string): Promise<void> {
  await systemDb.delete(stockAdjustments).where(eq(stockAdjustments.organizationId, organizationId))
  await systemDb.delete(goodsReceipts).where(eq(goodsReceipts.organizationId, organizationId))
  await systemDb.delete(stockMovements).where(eq(stockMovements.organizationId, organizationId))
  await systemDb.delete(stockLevels).where(eq(stockLevels.organizationId, organizationId))
  await systemDb.delete(stockCounts).where(eq(stockCounts.organizationId, organizationId))
  await systemDb.delete(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId))
  await systemDb.delete(recipes).where(eq(recipes.organizationId, organizationId))
  await systemDb.delete(wastageEvents).where(eq(wastageEvents.organizationId, organizationId))
  await systemDb.delete(inventoryItems).where(eq(inventoryItems.organizationId, organizationId))
  await systemDb.delete(suppliers).where(eq(suppliers.organizationId, organizationId))
  await systemDb.delete(stockLocations).where(eq(stockLocations.organizationId, organizationId))
}

export interface DeviceFixture {
  deviceId: string
}

// shifts.device_id has a real FK to devices (unlike order_items.staffId etc,
// which are plain uuids with no FK) — any test exercising a device-scoped
// shift needs a real row here, not just a random UUID.
export async function createDeviceFixture(
  location: Pick<LocationFixture, 'organizationId' | 'locationId'>,
  overrides: { name?: string; deviceType?: string } = {},
): Promise<DeviceFixture> {
  const [device] = await systemDb
    .insert(devices)
    .values({
      organizationId: location.organizationId,
      locationId: location.locationId,
      name: overrides.name ?? 'Test Device',
      deviceType: overrides.deviceType ?? 'pos',
    })
    .returning()
  if (!device) throw new Error('failed to create test device')
  return { deviceId: device.id }
}

export async function deleteDeviceFixture(fixture: DeviceFixture): Promise<void> {
  await systemDb.delete(devices).where(eq(devices.id, fixture.deviceId))
}

// Deletes everything ShiftsService can write for one organization, deepest
// dependents first. shifts.opened_by_staff_id is onDelete:'restrict' — call
// this before deleting any staff fixture a test opened a shift as.
export async function deleteOrgShiftData(organizationId: string): Promise<void> {
  await systemDb.delete(cashDrawerAdjustments).where(eq(cashDrawerAdjustments.organizationId, organizationId))
  await systemDb.delete(cashDrawerSessions).where(eq(cashDrawerSessions.organizationId, organizationId))
  await systemDb.delete(shifts).where(eq(shifts.organizationId, organizationId))
}

// Deletes everything CrmService can write for one organization. customer_
// identities/tags/loyalty_accounts/credit_accounts all cascade from
// customers, but loyalty_events -> loyalty_accounts is onDelete:'restrict'
// and would otherwise block that cascade — deleted explicitly first.
// gift_cards and customer_feedback have no FK into customers at all.
export async function deleteOrgCrmData(organizationId: string): Promise<void> {
  await systemDb.delete(loyaltyEvents).where(eq(loyaltyEvents.organizationId, organizationId))
  await systemDb.delete(giftCards).where(eq(giftCards.organizationId, organizationId))
  await systemDb.delete(customerFeedback).where(eq(customerFeedback.organizationId, organizationId))
  await systemDb.delete(customers).where(eq(customers.organizationId, organizationId))
}

export async function deleteOrgSyncData(organizationId: string): Promise<void> {
  await systemDb.delete(syncConflicts).where(eq(syncConflicts.organizationId, organizationId))
  await systemDb.delete(syncOperations).where(eq(syncOperations.organizationId, organizationId))
  await systemDb.delete(syncCursors).where(eq(syncCursors.organizationId, organizationId))
}
