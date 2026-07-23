import { and, eq, isNull } from 'drizzle-orm'

import { createSystemDb, createSystemPool, type Db } from '../client/index.js'
import { hashSecret } from '../security/hash.js'
import {
  businesses,
  devices,
  floorPlans,
  inventoryItems,
  stockLevels,
  stockLocations,
  stockMovements,
  suppliers,
  kdsStations,
  locations,
  menuCategories,
  menus,
  modifierGroups,
  modifiers,
  organizations,
  permissions,
  productModifierGroups,
  productPrices,
  products,
  restaurantTables,
  rolePermissions,
  roles,
  staff,
  staffRoles,
  tenantSettings,
  users,
} from '../schema/index.js'

// Starter capability catalog — deliberately small. New permissions are a data
// insert (this list, or a future admin UI), not a code change; each
// `docs/prd/*` module adds its own as it's implemented (see DATA_MODEL.md
// "permissions").
const SYSTEM_PERMISSIONS = [
  'orders:create',
  'orders:void_item',
  'payments:take_cash',
  'payments:refund',
  'inventory:adjust',
  'reports:view_profit',
  'devices:activate',
  'staff:deactivate',
  // P3 — Menu + Product Catalog (docs/prd/03-menu-catalog.md Permissions table)
  'products:manage',
  'products:toggle_availability',
  'products:view_price_history',
  // Approval-request action key for a price change beyond the configurable
  // threshold (ProductsService.LARGE_PRICE_CHANGE_ACTION) — deliberately
  // withheld from branch_manager below even though that role otherwise gets
  // the full SYSTEM_PERMISSIONS set, since the whole point is that a
  // branch_manager's own large price change needs a genuine owner to sign
  // off, not a peer who happens to share the role.
  'products:approve_large_price_change',
  // P4 — Floor Plan + Tables (docs/prd/04-floor-plan-tables.md Permissions
  // table). `tables:manage` covers seat/status-change/merge/split/transfer
  // within one's own section; `tables:manage_any_section` is the
  // supervisor+ escalation for reassigning/merging tables assigned to
  // someone else; `tables:block` and `tables:edit_layout` map directly to
  // the PRD's "Block a table" / "Edit floor plan layout" rows.
  'tables:manage',
  'tables:manage_any_section',
  'tables:block',
  'tables:edit_layout',
  // P5 — Order Engine Core (docs/prd/05-order-engine.md Permissions table,
  // master plan section 22's Sales group). `orders:create`/`orders:void_item`
  // above are the pre-existing placeholders this phase now actually grants
  // and enforces. `orders:void_item` covers a pre-send void outright and
  // gates the elevated post-send/served void-or-comp path (OrdersService
  // checks the item's own state, not a separate permission, for that
  // distinction — see ORDER_ITEM_PRE_SEND_STATUSES). `orders:void_bill` is
  // the manager-tier permission that either performs a post-send void
  // directly or resolves the approval request a lower-tier holder's attempt
  // creates.
  'orders:update_own',
  'orders:update_any',
  'orders:void_bill',
  'orders:discount_small',
  'orders:discount_large',
  // Approval-request action keys OrdersService creates when a lower-tier
  // holder's attempt needs sign-off (mirrors
  // products:approve_large_price_change above) — ApprovalsController.resolve
  // requires the *resolver* to hold a permission whose key equals the
  // approval's `action` string literally, so these three must be real,
  // seeded permissions too, not just constants inside OrdersService.
  'orders:void_after_send',
  'orders:comp_item',
  'orders:discount_above_threshold',
  // P6 — Kitchen / KDS.
  'kds:view',
  'kds:manage_stations',
  'kds:bump_own_station',
  'kds:bump_any_station',
  'kds:recall_own_station',
  'kds:recall_any_station',
  'kds:view_analytics',
  // P7 — Payments Core (docs/prd/07-payments.md Permissions table,
  // master plan section 22's Payments group).
  // payments:take_cash and payments:refund were pre-existing placeholders
  // — they are now real, enforced, and mapped to correct roles below.
  'payments:take_mobile_money',
  'payments:take_card',
  'payments:take_bank_transfer', // manager-level — bank transfer fraud vector
  'payments:split',
  'payments:cancel',
  'payments:reconcile',
  'payments:connect_integration', // owner/branch_manager only — stores encrypted credentials
  // Approval action key for refunds (ApprovalsController.resolve requires
  // the resolver to hold this permission literally — same pattern as
  // orders:void_after_send). payments:refund is already in the list above;
  // this stays as-is (it doubles as both the RBAC permission and the approval action key).
  // P8 — Shift + Cash Drawer (docs/prd/08-shift-cash-drawer.md Permissions table).
  'shifts:open',
  'shifts:close',
  'shifts:view_pnl',
  'shifts:adjust_cash', // approval-gated for supervisor, direct for branch_manager
  'shifts:reopen',      // branch_manager+ only — rare, audited
  // P9 — Receipts + Notifications (docs/prd/09-receipts-notifications.md Permissions table).
  'receipts:generate',
  'receipts:send',
  'receipts:resend',
  'receipts:view_status',
  'receipts:configure_preferences', // owner/manager — per-location notification config
  // P11 — Inventory, Recipes & Purchasing (docs/prd/12-inventory-recipes-purchasing.md Permissions table).
  'inventory:view',
  'inventory:receive',
  'inventory:adjust',
  'inventory:transfer',
  'inventory:count',
  'inventory:approve_adjustment',
] as const

// System-default roles (DATA_MODEL.md "roles"), org-scoped custom roles are
// added later by tenants themselves. The permission grants below are a
// reasonable starting point, not a final authorization design — they'll grow
// as more of SYSTEM_PERMISSIONS' owning modules ship.
const SYSTEM_ROLES: Record<string, readonly (typeof SYSTEM_PERMISSIONS)[number][]> = {
  // P9 — owner, regional_manager, branch_manager get all receipt permissions.
  // cashier gets receipts:generate and receipts:send (own transactions).
  // receipts:configure_preferences is owner/manager only per PRD 09 permission table.
  owner: [...SYSTEM_PERMISSIONS],
  regional_manager: [...SYSTEM_PERMISSIONS],
  branch_manager: SYSTEM_PERMISSIONS.filter((key) => key !== 'products:approve_large_price_change'),
  supervisor: [
    'orders:create',
    'orders:void_item',
    'payments:take_cash',
    'payments:refund',
    'inventory:adjust',
    'devices:activate',
    'products:toggle_availability',
    'products:view_price_history',
    'tables:manage',
    'tables:manage_any_section',
    'tables:block',
    'kds:view',
    'kds:bump_any_station',
    'kds:recall_any_station',
    // Master plan section 22: supervisor "Approve small discounts" and
    // "Reassign orders" — void_bill/discount_large stay branch_manager+
    // (master plan names branch_manager, not supervisor, as the
    // void/discount/refund approver).
    'orders:update_any',
    'orders:discount_small',
    // P7 — supervisors can take mobile money and card, and cancel intents.
    'payments:take_mobile_money',
    'payments:take_card',
    'payments:cancel',
    // P8 — supervisors can view live P&L and adjust cash drawer (approval-gated).
    'shifts:open',
    'shifts:close',
    'shifts:view_pnl',
    'shifts:adjust_cash',
    // P9 — supervisors can send receipts and view delivery status.
    'receipts:send',
    'receipts:resend',
    'receipts:view_status',
    // P11 — supervisors can view stock, receive goods, and perform counts.
    'inventory:view',
    'inventory:receive',
    'inventory:count',
  ],
  // P7 — cashiers can take mobile money and card in addition to cash.
  // P8 — cashiers can open and close their own shifts.
  // P9 — cashiers can generate and send receipts for their own transactions.
  cashier: ['orders:create', 'orders:update_own', 'payments:take_cash', 'payments:take_mobile_money', 'payments:take_card', 'products:toggle_availability', 'shifts:open', 'shifts:close', 'receipts:generate', 'receipts:send', 'receipts:view_status'],
  // PRD 05: "waiter can void own item pre-kitchen-send" — orders:void_item,
  // scoped to pre-send by OrdersService's own state check, not a narrower
  // permission (master plan's Waiter Payment Policy doesn't grant waiters
  // any discount capability, so discount_small/_large stay off this list).
  // P7 — waiters can take cash and mobile money (common at table service).
  // P9 — waiters can generate and send receipts for their own tables.
  waiter: ['orders:create', 'orders:update_own', 'orders:void_item', 'products:toggle_availability', 'tables:manage', 'payments:take_cash', 'payments:take_mobile_money', 'receipts:generate', 'receipts:send'],
  chef: ['products:toggle_availability', 'kds:view', 'kds:bump_own_station', 'kds:recall_own_station', 'inventory:view'],
  // P11 — stock_controller gets full inventory permissions except approving adjustments.
  stock_controller: ['inventory:view', 'inventory:receive', 'inventory:adjust', 'inventory:count', 'inventory:transfer'],
  // P7 — accountants can reconcile and cancel intents in addition to existing grants.
  // P8 — accountants can view shift P&L as part of reporting.
  // P9 — accountants can view receipt status for reconciliation.
  accountant: ['reports:view_profit', 'payments:refund', 'payments:reconcile', 'payments:cancel', 'shifts:view_pnl', 'receipts:view_status'],
  auditor: ['reports:view_profit'],
}

const seedSystemCatalog = async (db: Db) => {
  const permissionIds = new Map<string, string>()
  for (const key of SYSTEM_PERMISSIONS) {
    await db.insert(permissions).values({ key }).onConflictDoNothing({ target: permissions.key })
    const [row] = await db.select().from(permissions).where(eq(permissions.key, key))
    if (!row) throw new Error(`failed to seed permission ${key}`)
    permissionIds.set(key, row.id)
  }

  const roleIds = new Map<string, string>()
  for (const name of Object.keys(SYSTEM_ROLES)) {
    await db.insert(roles).values({ organizationId: null, name }).onConflictDoNothing()
    const [row] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.name, name), isNull(roles.organizationId)))
    if (!row) throw new Error(`failed to seed role ${name}`)
    roleIds.set(name, row.id)
  }

  for (const [roleName, grantedKeys] of Object.entries(SYSTEM_ROLES)) {
    const roleId = roleIds.get(roleName)
    if (!roleId) continue
    for (const key of grantedKeys) {
      const permissionId = permissionIds.get(key)
      if (!permissionId) continue
      await db
        .insert(rolePermissions)
        .values({ organizationId: null, roleId, permissionId })
        .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] })
    }
  }

  return { permissionIds, roleIds }
}

// Idempotent on its own — checked by menu existence, not gated behind
// seedDemoRestaurant's org-exists early return, so re-running `pnpm db:seed`
// against an already-seeded dev database (the normal case once P0/P2's
// staff/org/device seed already ran) still backfills the P3 catalog data.
const seedMenuCatalog = async (
  db: Db,
  org: { id: string; name: string },
  location: { id: string },
) => {
  const [existingMenu] = await db.select().from(menus).where(eq(menus.organizationId, org.id))
  if (existingMenu) {
    console.warn('Menu catalog already seeded, skipping.')
    return
  }

  // ProductsService.changePrice's fallback is 20% — this tenant runs a
  // tighter 15% band, demonstrating the setting is actually read, not just
  // defaulted (see TenantSettingsService).
  await db.insert(tenantSettings).values({
    organizationId: org.id,
    locationId: null,
    key: 'price_change_approval_threshold_pct',
    value: 15,
  })

  // P3 demo catalog: one menu, one category, two reusable modifier groups,
  // and a product attached to both — exercises BUILD_WORKFLOW.md P3's
  // acceptance gate end to end (create category + product with two modifier
  // groups, mark unavailable, search by local-language name).
  const [menu] = await db
    .insert(menus)
    .values({ organizationId: org.id, locationId: location.id, name: 'Main Menu', isDefault: true })
    .returning()
  if (!menu) throw new Error('failed to seed menu')

  const [category] = await db
    .insert(menuCategories)
    .values({
      organizationId: org.id,
      locationId: location.id,
      menuId: menu.id,
      name: 'Brunch Mains',
      localName: 'Vyakula vya Asubuhi',
      defaultKdsStation: 'hot_kitchen',
    })
    .returning()
  if (!category) throw new Error('failed to seed category')

  const [spiceGroup] = await db
    .insert(modifierGroups)
    .values({ organizationId: org.id, locationId: location.id, name: 'Spice Level', minSelect: 1, maxSelect: 1 })
    .returning()
  if (!spiceGroup) throw new Error('failed to seed spice modifier group')
  await db.insert(modifiers).values([
    { organizationId: org.id, modifierGroupId: spiceGroup.id, name: 'Mild', priceDelta: 0, currency: 'KES', sortOrder: 0 },
    { organizationId: org.id, modifierGroupId: spiceGroup.id, name: 'Medium', priceDelta: 0, currency: 'KES', sortOrder: 1 },
    { organizationId: org.id, modifierGroupId: spiceGroup.id, name: 'Hot', priceDelta: 0, currency: 'KES', sortOrder: 2 },
  ])

  const [addOnsGroup] = await db
    .insert(modifierGroups)
    .values({ organizationId: org.id, locationId: location.id, name: 'Extra Toppings', minSelect: 0, maxSelect: 3 })
    .returning()
  if (!addOnsGroup) throw new Error('failed to seed add-ons modifier group')
  await db.insert(modifiers).values([
    { organizationId: org.id, modifierGroupId: addOnsGroup.id, name: 'Extra Avocado', priceDelta: 100, currency: 'KES', sortOrder: 0 },
    { organizationId: org.id, modifierGroupId: addOnsGroup.id, name: 'Extra Cheese', priceDelta: 80, currency: 'KES', sortOrder: 1 },
  ])

  const [product] = await db
    .insert(products)
    .values({
      organizationId: org.id,
      locationId: location.id,
      categoryId: category.id,
      name: 'Nyama Choma Platter',
      localName: 'Nyama Choma',
      description: 'Grilled beef platter with sides',
      sku: 'BRN-001',
      priceAmount: 1200,
      currency: 'KES',
      status: 'active',
    })
    .returning()
  if (!product) throw new Error('failed to seed product')

  await db.insert(productPrices).values({
    organizationId: org.id,
    productId: product.id,
    priceAmount: 1200,
    currency: 'KES',
    reason: 'initial price',
  })

  await db.insert(productModifierGroups).values([
    { organizationId: org.id, productId: product.id, modifierGroupId: spiceGroup.id, sortOrder: 0 },
    { organizationId: org.id, productId: product.id, modifierGroupId: addOnsGroup.id, sortOrder: 1 },
  ])

  console.warn(`Seeded P3 menu catalog for "${org.name}":`)
  console.warn(`  menu_id:         ${menu.id}`)
  console.warn(`  category_id:     ${category.id}`)
  console.warn(`  demo product:    ${product.name} (${product.id}), sku ${product.sku}`)
}

// P4 — Floor Plan + Tables (docs/prd/04-floor-plan-tables.md, BUILD_WORKFLOW.md
// P4) demo data: one floor plan, three tables — one already assigned to
// waiterOneId (exercises the "own section" permission check), one
// unassigned, one pre-blocked (exercises the tables:block-gated transition).
// Idempotent by floor-plan existence, same pattern as seedMenuCatalog.
const seedFloorPlanAndTables = async (
  db: Db,
  org: { id: string; name: string },
  location: { id: string },
  waiterOneId: string,
) => {
  const [existingFloorPlan] = await db.select().from(floorPlans).where(eq(floorPlans.organizationId, org.id))
  if (existingFloorPlan) {
    console.warn('Floor plan already seeded, skipping.')
    return
  }

  const [floorPlan] = await db
    .insert(floorPlans)
    .values({ organizationId: org.id, locationId: location.id, name: 'Main Dining Room' })
    .returning()
  if (!floorPlan) throw new Error('failed to seed floor plan')

  await db.insert(restaurantTables).values([
    {
      organizationId: org.id,
      locationId: location.id,
      floorPlanId: floorPlan.id,
      label: 'T1',
      section: 'patio',
      capacity: 4,
      assignedStaffId: waiterOneId,
    },
    { organizationId: org.id, locationId: location.id, floorPlanId: floorPlan.id, label: 'T2', section: 'patio', capacity: 2 },
    {
      organizationId: org.id,
      locationId: location.id,
      floorPlanId: floorPlan.id,
      label: 'T3',
      section: 'main_hall',
      capacity: 6,
      shape: 'round',
      status: 'blocked',
    },
  ])

  console.warn(`Seeded P4 floor plan for "${org.name}": ${floorPlan.name} (${floorPlan.id}), tables T1-T3`)
}

const WAITER_ONE_PIN = '1111'
const WAITER_TWO_PIN = '2222'
const CHEF_PIN = '3333'

// Idempotent by staff name, called from both the fresh-org and
// already-seeded-org paths so a P4 backfill against a database seeded before
// this phase existed still ends up with the waiters P4's demo data needs.
const seedWaiters = async (db: Db, org: { id: string }, location: { id: string }, roleIds: Map<string, string>) => {
  const waiterRoleId = roleIds.get('waiter')
  if (!waiterRoleId) throw new Error('waiter system role missing')

  const ensureWaiter = async (name: string, pin: string) => {
    const [existingStaff] = await db.select().from(staff).where(and(eq(staff.organizationId, org.id), eq(staff.name, name)))
    if (existingStaff) return existingStaff
    const [created] = await db
      .insert(staff)
      .values({ organizationId: org.id, locationId: location.id, name, pinHash: await hashSecret(pin) })
      .returning()
    if (!created) throw new Error(`failed to seed ${name}`)
    await db
      .insert(staffRoles)
      .values({ organizationId: org.id, staffId: created.id, roleId: waiterRoleId, locationId: location.id })
      .onConflictDoNothing()
    return created
  }

  const waiterOne = await ensureWaiter('Waiter One', WAITER_ONE_PIN)
  const waiterTwo = await ensureWaiter('Waiter Two', WAITER_TWO_PIN)
  return { waiterOne, waiterTwo }
}

const seedKitchenDemo = async (db: Db, org: { id: string; name: string }, location: { id: string }, chefId: string) => {
  const [existingStation] = await db.select().from(kdsStations).where(eq(kdsStations.organizationId, org.id))
  if (existingStation) {
    console.warn('KDS stations already seeded, skipping.')
    return
  }

  await db.insert(kdsStations).values([
    {
      organizationId: org.id,
      locationId: location.id,
      code: 'hot_kitchen',
      name: 'Hot Kitchen',
      assignedStaffId: chefId,
      expectedPrepTimeSeconds: 900,
      recallGraceSeconds: 120,
      sortOrder: 0,
    },
    {
      organizationId: org.id,
      locationId: location.id,
      code: 'cold_station',
      name: 'Cold Station',
      expectedPrepTimeSeconds: 480,
      recallGraceSeconds: 120,
      sortOrder: 1,
    },
    {
      organizationId: org.id,
      locationId: location.id,
      code: 'expo',
      name: 'Expo',
      isExpo: true,
      expectedPrepTimeSeconds: 300,
      recallGraceSeconds: 120,
      sortOrder: 2,
    },
  ])

  console.warn(`Seeded P6 KDS stations for "${org.name}": hot_kitchen, cold_station, expo`)
}

const seedChef = async (db: Db, org: { id: string }, location: { id: string }, roleIds: Map<string, string>) => {
  const chefRoleId = roleIds.get('chef')
  if (!chefRoleId) throw new Error('chef system role missing')

  const [existingChef] = await db.select().from(staff).where(and(eq(staff.organizationId, org.id), eq(staff.name, 'Chef One')))
  if (existingChef) return existingChef

  const [chef] = await db
    .insert(staff)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Chef One',
      pinHash: await hashSecret(CHEF_PIN),
    })
    .returning()
  if (!chef) throw new Error('failed to seed chef staff')

  await db
    .insert(staffRoles)
    .values({ organizationId: org.id, staffId: chef.id, roleId: chefRoleId, locationId: location.id })
    .onConflictDoNothing()

  return chef
}

const seedInventoryDemo = async (db: Db, org: { id: string; name: string }, location: { id: string }) => {
  const [existingSupplier] = await db.select().from(suppliers).where(eq(suppliers.organizationId, org.id))
  if (existingSupplier) {
    console.warn('Inventory demo data already seeded, skipping.')
    return
  }

  const [supplier] = await db
    .insert(suppliers)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Kenia Fresh Produce Ltd',
      contactPerson: 'John Kamau',
      phone: '+254700100200',
      email: 'orders@keniafresh.co.ke',
      paymentTerms: 'net30',
      currency: 'KES',
      status: 'active',
    })
    .returning()

  const [supplier2] = await db
    .insert(suppliers)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Nairobi Meat Packers',
      contactPerson: 'Grace Wanjiku',
      phone: '+254700100300',
      paymentTerms: 'net15',
      currency: 'KES',
      status: 'active',
    })
    .returning()

  const [stockLocation] = await db
    .insert(stockLocations)
    .values({ organizationId: org.id, locationId: location.id, name: 'Main Dry Store', description: 'Room 101 — dry goods' })
    .returning()

  const [stockLocation2] = await db
    .insert(stockLocations)
    .values({ organizationId: org.id, locationId: location.id, name: 'Walk-in Chiller', description: 'Perishables' })
    .returning()

  const [item1] = await db
    .insert(inventoryItems)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Maize Flour',
      sku: 'RAW-MZ-001',
      itemType: 'ingredient',
      unit: 'kg',
      unitCost: 15000,
      currency: 'KES',
      reorderPoint: 20,
      preferredSupplierId: supplier?.id,
      status: 'active',
    })
    .returning()

  const [item2] = await db
    .insert(inventoryItems)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Beef (boneless)',
      sku: 'RAW-BF-001',
      itemType: 'ingredient',
      unit: 'kg',
      unitCost: 80000,
      currency: 'KES',
      reorderPoint: 10,
      preferredSupplierId: supplier2?.id,
      status: 'active',
    })
    .returning()

  if (item1 && stockLocation) {
    await db.insert(stockLevels).values({ organizationId: org.id, locationId: location.id, inventoryItemId: item1.id, stockLocationId: stockLocation.id, quantity: 50, unit: 'kg' })
    await db.insert(stockMovements).values({ organizationId: org.id, locationId: location.id, inventoryItemId: item1.id, stockLocationId: stockLocation.id, movementType: 'receive', quantity: 50, unit: 'kg', unitCost: 15000, reason: 'initial stock', movedByActorId: '00000000-0000-0000-0000-000000000000' })
  }
  if (item2 && stockLocation2) {
    await db.insert(stockLevels).values({ organizationId: org.id, locationId: location.id, inventoryItemId: item2.id, stockLocationId: stockLocation2.id, quantity: 30, unit: 'kg' })
    await db.insert(stockMovements).values({ organizationId: org.id, locationId: location.id, inventoryItemId: item2.id, stockLocationId: stockLocation2.id, movementType: 'receive', quantity: 30, unit: 'kg', unitCost: 80000, reason: 'initial stock', movedByActorId: '00000000-0000-0000-0000-000000000000' })
  }

  console.warn(`Seeded P12 inventory demo for "${org.name}": 2 suppliers, 2 stock locations, 2 inventory items`)
}

const seedDemoRestaurant = async (db: Db, roleIds: Map<string, string>) => {
  const existing = await db.select().from(organizations).where(eq(organizations.name, 'Izzi Brunch and Cake'))
  if (existing[0]) {
    console.warn('Seed organization already exists, skipping restaurant seed.')
    const [location] = await db.select().from(locations).where(eq(locations.organizationId, existing[0].id))
    if (location) {
      await seedMenuCatalog(db, existing[0], location)
      const { waiterOne } = await seedWaiters(db, existing[0], location, roleIds)
      const chef = await seedChef(db, existing[0], location, roleIds)
      await seedFloorPlanAndTables(db, existing[0], location, waiterOne.id)
      await seedKitchenDemo(db, existing[0], location, chef.id)
      await seedInventoryDemo(db, existing[0], location)
    }
    return
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Izzi Brunch and Cake',
      legalName: 'Izzi Brunch and Cake',
      country: 'KE',
      defaultCurrency: 'KES',
      timezone: 'Africa/Nairobi',
    })
    .returning()
  if (!org) throw new Error('failed to seed organization')

  const [business] = await db
    .insert(businesses)
    .values({ organizationId: org.id, name: org.name, vertical: 'restaurant' })
    .returning()
  if (!business) throw new Error('failed to seed business')

  const [location] = await db
    .insert(locations)
    .values({
      organizationId: org.id,
      businessId: business.id,
      name: 'Izzi Brunch and Cake — Main Branch',
      code: 'MAIN',
      country: 'KE',
      currency: 'KES',
      timezone: 'Africa/Nairobi',
    })
    .returning()
  if (!location) throw new Error('failed to seed location')

  const ownerPassword = 'DevOwner!2026'
  const [owner] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      name: 'Owner',
      email: 'info@izzibrunchandcake.com',
      passwordHash: await hashSecret(ownerPassword),
      status: 'active',
    })
    .returning()
  if (!owner) throw new Error('failed to seed owner user')

  const managerPin = '1234'
  const [manager] = await db
    .insert(staff)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Branch Manager',
      pinHash: await hashSecret(managerPin),
    })
    .returning()
  if (!manager) throw new Error('failed to seed manager staff')

  const cashierPin = '4321'
  const [cashier] = await db
    .insert(staff)
    .values({
      organizationId: org.id,
      locationId: location.id,
      name: 'Cashier One',
      pinHash: await hashSecret(cashierPin),
    })
    .returning()
  if (!cashier) throw new Error('failed to seed cashier staff')

  const branchManagerRoleId = roleIds.get('branch_manager')
  const cashierRoleId = roleIds.get('cashier')
  if (!branchManagerRoleId || !cashierRoleId) throw new Error('system roles missing')

  await db.insert(staffRoles).values([
    { organizationId: org.id, staffId: manager.id, roleId: branchManagerRoleId, locationId: location.id },
    { organizationId: org.id, staffId: cashier.id, roleId: cashierRoleId, locationId: location.id },
  ])

  // Two waiters (not just one) so P4's "own section" permission check has a
  // real second waiter to deny against — Waiter One owns T1, Waiter Two owns
  // nothing, both exercisable via BUILD_WORKFLOW.md P4's acceptance gate.
  const { waiterOne } = await seedWaiters(db, org, location, roleIds)
  const chef = await seedChef(db, org, location, roleIds)

  await db.insert(devices).values([
    {
      organizationId: org.id,
      locationId: location.id,
      name: 'Front Counter POS',
      deviceType: 'pos',
      platform: 'android',
    },
    {
      organizationId: org.id,
      locationId: location.id,
      name: 'Hot Kitchen Screen',
      deviceType: 'kds',
      platform: 'web',
    },
  ])

  await db.insert(tenantSettings).values({
    organizationId: org.id,
    locationId: null,
    key: 'cash_variance_threshold',
    value: { amount: 500, currency: 'KES' },
  })

  console.warn('Seeded demo restaurant "Izzi Brunch and Cake":')
  console.warn(`  organization_id: ${org.id}`)
  console.warn(`  location_id:     ${location.id}`)
  console.warn(`  owner login:     ${owner.email} / ${ownerPassword}`)
  console.warn(`  manager PIN:     ${managerPin} (location ${location.code})`)
  console.warn(`  cashier PIN:     ${cashierPin} (location ${location.code})`)
  console.warn(`  waiter one PIN:  ${WAITER_ONE_PIN} (location ${location.code})`)
  console.warn(`  waiter two PIN:  ${WAITER_TWO_PIN} (location ${location.code})`)
  console.warn(`  chef PIN:        ${CHEF_PIN} (location ${location.code})`)

  await seedMenuCatalog(db, org, location)
  await seedFloorPlanAndTables(db, org, location, waiterOne.id)
  await seedKitchenDemo(db, org, location, chef.id)
  await seedInventoryDemo(db, org, location)
}

const run = async () => {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) throw new Error('DATABASE_URL is required to run the seed script')

  const pool = createSystemPool(connectionString)
  const db = createSystemDb(pool)

  try {
    const { roleIds } = await seedSystemCatalog(db)
    await seedDemoRestaurant(db, roleIds)
  } finally {
    await pool.end()
  }
}

await run().catch((error) => {
  console.error(error)
  process.exit(1)
})
