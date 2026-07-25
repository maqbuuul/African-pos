import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  bills,
  businesses,
  createSystemDb,
  createSystemPool,
  events,
  integrationConnections,
  locations,
  mpesaC2bTransactions,
  orders,
  organizations,
  paymentIntents,
  payments,
  refunds,
  tips,
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

export interface BillFixture {
  organizationId: string
  locationId: string
  orderId: string
  billId: string
}

// Creates an isolated organization → business → location → order → bill
// chain for a single test. Each test gets its own organization so tests can
// run without stepping on each other's idempotency keys / permission grants.
export async function createBillFixture(
  overrides: { totalAmount?: number; currency?: string } = {},
): Promise<BillFixture> {
  const currency = overrides.currency ?? 'KES'
  const totalAmount = overrides.totalAmount ?? 1000

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

// Deletes everything created for one fixture's organization, deepest
// dependents first (every FK in this schema is onDelete: 'restrict' —
// nothing cascades automatically).
export async function deleteBillFixture(fixture: BillFixture): Promise<void> {
  const organizationId = fixture.organizationId
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
  await systemDb.delete(bills).where(eq(bills.organizationId, organizationId))
  await systemDb.delete(orders).where(eq(orders.organizationId, organizationId))
  // audit_logs.location_id is ON DELETE SET NULL, so locations can still go —
  // only audit_logs.organization_id (ON DELETE RESTRICT) blocks the
  // organization row itself. That row (and its businesses, transitively kept
  // alive by locations->businesses FKs) is intentionally left behind: a few
  // orphaned organization row per test run is the accepted cost of testing
  // against a real, honestly-immutable audit log instead of one that
  // secretly allows deletes only in tests.
  const orgLocations = await systemDb.select().from(locations).where(eq(locations.organizationId, organizationId))
  await systemDb.delete(locations).where(eq(locations.organizationId, organizationId))
  for (const businessId of new Set(orgLocations.map((l) => l.businessId))) {
    await systemDb.delete(businesses).where(eq(businesses.id, businessId))
  }
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
