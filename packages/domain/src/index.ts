import { z } from 'zod'

export const VerticalSchema = z.enum(['restaurant', 'hotel', 'retail'])
export type Vertical = z.infer<typeof VerticalSchema>

export const StaffRoleSchema = z.enum([
  'owner',
  'regional_manager',
  'branch_manager',
  'supervisor',
  'cashier',
  'waiter',
  'chef',
  'receptionist',
  'housekeeping',
  'maintenance',
  'stock_controller',
  'accountant',
  'auditor',
])
export type StaffRole = z.infer<typeof StaffRoleSchema>

export const PaymentMethodSchema = z.enum([
  'cash',
  'mpesa',
  'airtel_money',
  'evc_plus',
  'edahab',
  'zaad',
  'card',
  'stripe',
  'flutterwave',
  'paystack',
  'loyalty',
  'gift_card',
  'customer_credit',
])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const OrderStatusSchema = z.enum([
  'draft',
  'open',
  'sent_to_kitchen',
  'partially_ready',
  'ready',
  'served',
  'bill_requested',
  'payment_pending',
  'paid',
  'voided',
  'refunded',
])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const MoneySchema = z.number().int()
export type Money = z.infer<typeof MoneySchema>

// Lifecycle status for org-level entities (organizations, businesses, locations,
// devices) — never hard-deleted, per Engineering Charter. Single source of truth:
// referenced by both the Drizzle CHECK constraint and any app-layer validation, so
// the allowed set only ever lives in one place.
export const EntityStatusSchema = z.enum(['active', 'suspended', 'inactive'])
export type EntityStatus = z.infer<typeof EntityStatusSchema>

// Lifecycle status for person accounts (users, staff) — includes a pre-activation
// "invited" state that plain entities don't need.
export const PersonStatusSchema = z.enum(['invited', 'active', 'suspended', 'deactivated'])
export type PersonStatus = z.infer<typeof PersonStatusSchema>

export const ActorTypeSchema = z.enum(['user', 'staff', 'system'])
export type ActorType = z.infer<typeof ActorTypeSchema>

export const PermissionSchema = z.string().min(1)
export type Permission = z.infer<typeof PermissionSchema>

// Product lifecycle, per docs/prd/03-menu-catalog.md "Business Rules": never
// hard-deleted. `unavailable` is the transient 86'd state (products.is_available
// toggles fast without a full status transition); the rest is the slower
// managed lifecycle a manager moves a product through deliberately.
export const ProductStatusSchema = z.enum(['draft', 'active', 'seasonal', 'unavailable', 'discontinued', 'archived'])
export type ProductStatus = z.infer<typeof ProductStatusSchema>

// Modifier groups/options: same never-delete rule as products (PRD 03 edge
// cases — a modifier referenced by open orders can't be hard-deleted, only
// discontinued), but without the day-part/seasonal states a full product has.
export const ModifierStatusSchema = z.enum(['active', 'discontinued'])
export type ModifierStatus = z.infer<typeof ModifierStatusSchema>

// Table state machine, per master plan section 23 / docs/prd/04-floor-plan-tables.md.
export const TableStatusSchema = z.enum([
  'available',
  'seated',
  'ordered',
  'food_ready',
  'eating',
  'bill_requested',
  'payment_pending',
  'paid',
  'cleaning',
  'reserved',
  'blocked',
])
export type TableStatus = z.infer<typeof TableStatusSchema>

export const TableShapeSchema = z.enum(['square', 'round', 'rectangle'])
export type TableShape = z.infer<typeof TableShapeSchema>

// Legal transitions out of each table state (PRD 04 "Table state machine" +
// its edge cases). `reserved`/`blocked` are reachable from any active state
// (a manager can pull a table out of rotation mid-service), so they're
// unioned in rather than repeated per-state. `bill_requested`/
// `payment_pending` -> `eating` is PRD 04's explicit "reopening ... is
// allowed with a manager-visible flag, not blocked outright" edge case —
// callers should treat that specific transition as flag-worthy, not silent.
// This is the single source of truth for what TablesService.setStatus
// allows — never duplicate this list elsewhere.
const ALWAYS_REACHABLE: readonly TableStatus[] = ['reserved', 'blocked']

export const TABLE_STATE_TRANSITIONS: Readonly<Record<TableStatus, readonly TableStatus[]>> = {
  available: ['seated', ...ALWAYS_REACHABLE],
  seated: ['ordered', 'available', ...ALWAYS_REACHABLE],
  ordered: ['food_ready', ...ALWAYS_REACHABLE],
  food_ready: ['eating', ...ALWAYS_REACHABLE],
  eating: ['bill_requested', ...ALWAYS_REACHABLE],
  bill_requested: ['payment_pending', 'eating', ...ALWAYS_REACHABLE],
  payment_pending: ['paid', 'eating', ...ALWAYS_REACHABLE],
  paid: ['cleaning', ...ALWAYS_REACHABLE],
  cleaning: ['available', ...ALWAYS_REACHABLE],
  reserved: ['available', 'seated', 'blocked'],
  blocked: ['available'],
}

// Reopening a table from bill/payment back to active service is allowed but
// must surface to managers (PRD 04 edge case), distinct from a routine
// forward transition.
export const TABLE_REOPEN_TRANSITIONS: ReadonlySet<string> = new Set(['bill_requested->eating', 'payment_pending->eating'])

// P5 — Order Engine Core (docs/prd/05-order-engine.md, BUILD_WORKFLOW.md P5).
// Order-level state machine, per master plan section 23's exact list. `draft`
// is reachable in principle (a not-yet-opened cart, e.g. a future QR-ordering
// session) but OrdersService.create opens orders directly into `open` —
// PRD 05's "Opening and building an order" workflow — so it isn't exercised
// by this phase's own API surface yet.
export const OrderChannelSchema = z.enum([
  'pos',
  'qr_table',
  'kiosk',
  'whatsapp',
  'online',
  'shopify',
  'woocommerce',
  'uber_eats',
  'glovo',
  'bolt_food',
])
export type OrderChannel = z.infer<typeof OrderChannelSchema>

// Legal order-status transitions. `voided` is reachable from any pre-payment
// state (whole-order void, OrdersService.voidOrder); `refunded` is P7
// (Payments Core) territory — nothing in this phase transitions into it.
// `paid` doubles as PRD 05's "closed" concept: master plan section 23's order
// state enum has no separate `closed` state, so OrdersService.close sets
// `closedAt` when the order reaches `paid`, rather than introducing a status
// value the master plan doesn't define.
const ORDER_VOIDABLE_PRE_PAYMENT: readonly OrderStatus[] = [
  'draft',
  'open',
  'sent_to_kitchen',
  'partially_ready',
  'ready',
  'served',
  'bill_requested',
  'payment_pending',
]

// `sent_to_kitchen`/`partially_ready`/`ready` can each reach `bill_requested`
// directly, not only via `served` — master plan section 23's order-level
// `served` state is meant to reflect every item having actually been served,
// which without a real KDS (BUILD_WORKFLOW.md P6) this phase can only track
// per-item (OrdersService.markServed), not aggregate automatically. Splitting
// the bill is itself sufficient real-world evidence that service is done, so
// OrdersService.split is allowed to carry the order straight to
// `bill_requested` from any of these — a narrower, honestly-scoped path, not
// the full "every item served" aggregation P6 will eventually enable.
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ['open', 'voided'],
  open: ['sent_to_kitchen', 'voided'],
  sent_to_kitchen: ['partially_ready', 'ready', 'served', 'bill_requested', 'voided'],
  partially_ready: ['ready', 'served', 'bill_requested', 'voided'],
  ready: ['served', 'bill_requested', 'voided'],
  served: ['bill_requested', 'voided'],
  bill_requested: ['payment_pending', 'served', 'voided'],
  payment_pending: ['paid', 'bill_requested', 'voided'],
  paid: ['refunded'],
  voided: [],
  refunded: [],
}
export { ORDER_VOIDABLE_PRE_PAYMENT }

// Order item state machine (PRD 05 / master plan section 23). `accepted` /
// `in_progress` / `ready` are KDS-driven states this phase's API doesn't set
// directly — BUILD_WORKFLOW.md P6 (Kitchen/KDS) owns bumping an item through
// them once it exists. Until then, `sent` items can be marked `served`
// directly (a waiter serving a dish the kitchen finished, tracked without a
// KDS screen yet) — a narrower, honestly-scoped path, not the full routing
// model P6 will add.
export const OrderItemStatusSchema = z.enum([
  'draft',
  'sent',
  'accepted',
  'in_progress',
  'ready',
  'served',
  'void_requested',
  'voided',
  'comped',
])
export type OrderItemStatus = z.infer<typeof OrderItemStatusSchema>

// `void_requested` is a real, legal state (reachable from anything not yet
// voided/comped) but OrdersService never persists it in this phase — a
// pending void/comp lives only in approval_requests, exactly like
// ProductsService.changePrice never parks a product in a "pending price"
// state while its approval is outstanding. The item jumps straight from its
// current status to `voided`/`comped` once approved. `void_requested` stays
// defined for BUILD_WORKFLOW.md P6, which needs a persisted "kitchen must
// acknowledge this void" state once a real KDS exists to acknowledge it.
export const ORDER_ITEM_STATUS_TRANSITIONS: Readonly<Record<OrderItemStatus, readonly OrderItemStatus[]>> = {
  draft: ['sent', 'voided', 'comped'],
  sent: ['accepted', 'in_progress', 'ready', 'served', 'voided', 'comped'],
  accepted: ['in_progress', 'ready', 'served', 'voided', 'comped'],
  in_progress: ['ready', 'served', 'voided', 'comped'],
  ready: ['served', 'voided', 'comped'],
  served: ['voided', 'comped'],
  void_requested: ['voided'],
  voided: [],
  comped: [],
}

// An order item is only a "pre-send" void (immediate, waiter-level
// orders:void_item, no approval) while it's still `draft`. Anything past that
// is a post-send void — manager approval required (PRD 05 Business Rules;
// master plan's Waiter Payment Policy) — enforced by OrdersService, not this
// list itself, but the boundary is defined once here so it can't drift
// between the void and comp code paths.
export const ORDER_ITEM_PRE_SEND_STATUSES: ReadonlySet<OrderItemStatus> = new Set(['draft'])

export const BillStatusSchema = z.enum(['open', 'payment_pending', 'paid', 'partially_refunded', 'refunded', 'voided'])
export type BillStatus = z.infer<typeof BillStatusSchema>

export const BILL_STATUS_TRANSITIONS: Readonly<Record<BillStatus, readonly BillStatus[]>> = {
  open: ['payment_pending', 'voided'],
  payment_pending: ['paid', 'open', 'voided'],
  paid: ['refunded', 'partially_refunded'],
  partially_refunded: ['refunded'],
  refunded: [],
  voided: [],
}

export const BillSplitMethodSchema = z.enum(['by_item', 'by_seat', 'evenly'])
export type BillSplitMethod = z.infer<typeof BillSplitMethodSchema>

