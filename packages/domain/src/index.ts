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

// P7 — Payments Core. method = what type of payment from the customer's
// perspective; provider = which integration/system processed it.
// Kept separate so a card payment via Paystack and a card payment via a
// physical terminal share method='card' but differ on provider.
export const PaymentMethodSchema = z.enum([
  'cash',
  'mpesa',
  'airtel_money',
  'evc_plus',
  'edahab',
  'zaad',
  'card',
  'bank_transfer',
  'card_terminal',
  'loyalty_points',
  'gift_card',
  'customer_credit',
  'external_platform',
])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const PaymentProviderSchema = z.enum([
  'none',          // cash, card_terminal, manual_bank_transfer — no external system
  'mpesa_daraja',  // Safaricom Daraja API (STK push, direct per-tenant)
  'paystack',      // Paystack (card, bank transfer/Pesalink, mobile money)
  'airtel_money_api',
  'stripe',
  'flutterwave',
  'manual',        // recorded after the fact, reference number only
  'uber_eats',
  'glovo',
  'bolt_food',
])
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>

// Payment intent lifecycle: pending (created) → processing (STK push sent) →
// confirmed (provider webhook) | failed | expired (M-Pesa timeout).
// cancelled is set by the cashier or system aborting before confirmation.
export const PaymentIntentStatusSchema = z.enum([
  'pending',
  'processing',
  'confirmed',
  'failed',
  'cancelled',
  'expired',
])
export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatusSchema>

export const PAYMENT_INTENT_STATUS_TRANSITIONS: Readonly<Record<PaymentIntentStatus, readonly PaymentIntentStatus[]>> = {
  pending:    ['processing', 'confirmed', 'failed', 'cancelled', 'expired'],
  processing: ['confirmed', 'failed', 'expired', 'cancelled'],
  confirmed:  [],
  failed:     ['pending'], // cashier can retry with a fresh intent; service creates a new row
  cancelled:  [],
  expired:    [],
}

// Confirmed payment lifecycle. A payment row is only created once a provider
// confirms (or cash is taken). Never deleted — refunds create new rows.
export const PaymentStatusSchema = z.enum(['confirmed', 'partially_refunded', 'refunded'])
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

export const RefundStatusSchema = z.enum([
  'pending',
  'confirmed',
  'failed',
  'requires_manual_settlement', // provider reversal failed/expired, manual action needed
])
export type RefundStatus = z.infer<typeof RefundStatusSchema>

// Integration connection categories — matches packages/integrations categories.
export const IntegrationCategorySchema = z.enum([
  'payments',
  'messaging',
  'accounting',
  'delivery',
  'hospitality_channels',
  'commerce',
  'tax',
  'hardware',
])
export type IntegrationCategory = z.infer<typeof IntegrationCategorySchema>

export const IntegrationConnectionStatusSchema = z.enum(['active', 'inactive', 'error'])
export type IntegrationConnectionStatus = z.infer<typeof IntegrationConnectionStatusSchema>

// P8 — Shift + Cash Drawer (docs/prd/08-shift-cash-drawer.md, BUILD_WORKFLOW.md P8).

// Shift lifecycle per BUILD_WORKFLOW.md P8: draft → open → closing → closed → reconciled.
// `closing` is a brief transition state while the manager confirms variance/reason;
// once confirmed the shift moves to `closed` immediately (no async step).
// `reconciled` is set later by an accountant/owner after matching against actual
// provider settlements — it's a post-close endorsement, not a workflow gate.
export const ShiftStatusSchema = z.enum(['draft', 'open', 'closing', 'closed', 'reconciled'])
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>

export const SHIFT_STATUS_TRANSITIONS: Readonly<Record<ShiftStatus, readonly ShiftStatus[]>> = {
  draft:       ['open'],
  open:        ['closing'],
  closing:     ['closed', 'open'],  // 'open' to revert if variance check fails
  closed:      ['reconciled', 'open'],  // 'open' for manager reopen (rare, audited)
  reconciled:  [],
}

export const CashDrawerSessionStatusSchema = z.enum(['open', 'counted', 'closed'])
export type CashDrawerSessionStatus = z.infer<typeof CashDrawerSessionStatusSchema>

// Direction of a mid-shift drawer adjustment (petty cash out, change float in, etc.)
export const CashAdjustmentDirectionSchema = z.enum(['in', 'out'])
export type CashAdjustmentDirection = z.infer<typeof CashAdjustmentDirectionSchema>

// KES denomination list (notes + coins) — used by the denomination calculator
// and the shift-close counting screen. Ordered largest to smallest for greedy
// change-calculation. Other currencies will be added as the product expands
// (Module 18: denomination-aware cash handling is a first-class feature, not an
// afterthought — the calculator must work in actual local denominations).
export const KES_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1] as const
export type KesDenomination = (typeof KES_DENOMINATIONS)[number]

// Map of currency code → denominations, ordered largest to smallest.
// Extend as new currencies are onboarded.
export const CURRENCY_DENOMINATIONS: Readonly<Record<string, readonly number[]>> = {
  KES: KES_DENOMINATIONS,
  // Placeholder shape — add as the product expands:
  // NGN: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  // GHS: [200, 100, 50, 20, 10, 5, 2, 1],
  // UGX: [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50],
}

// Computes the optimal denomination breakdown to make a given change amount.
// Returns a map of denomination → count, plus any unhandled remainder (should
// be 0 for a clean amount; non-zero means the denominations list doesn't cover
// the amount exactly, which is a data problem, not a rounding one).
// Pure function — no side effects, safe to call server-side or on-device.
export const computeChangeDenominations = (
  changeAmount: number,  // integer, smallest currency unit
  currency: string,
): { breakdown: Record<number, number>; remainder: number } => {
  const denominations = CURRENCY_DENOMINATIONS[currency]
  if (!denominations) {
    return { breakdown: {}, remainder: changeAmount }
  }
  const breakdown: Record<number, number> = {}
  let remaining = changeAmount
  for (const denom of denominations) {
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom)
      breakdown[denom] = count
      remaining -= count * denom
    }
  }
  return { breakdown, remainder: remaining }
}

// P9 — Receipts + Notifications (docs/prd/09-receipts-notifications.md, BUILD_WORKFLOW.md P9).
// Receipt delivery channels — the method used to deliver the receipt to the customer.
export const ReceiptChannelSchema = z.enum([
  'print',
  'whatsapp',
  'sms',
  'email',
  'pdf',
])
export type ReceiptChannel = z.infer<typeof ReceiptChannelSchema>

// Delivery status per channel attempt.
export const DeliveryStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
])
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>

// Tax compliance submission status (KRA eTIMS, FIRS, SARS).
export const TaxSubmissionStatusSchema = z.enum([
  'queued',
  'sent',
  'confirmed',
  'failed',
])
export type TaxSubmissionStatus = z.infer<typeof TaxSubmissionStatusSchema>

export const TaxProviderSchema = z.enum([
  'kra_etims',
  'firs',
  'sars',
])
export type TaxProvider = z.infer<typeof TaxProviderSchema>

// Subject type for notification preferences.
export const NotificationSubjectTypeSchema = z.enum(['staff', 'customer'])
export type NotificationSubjectType = z.infer<typeof NotificationSubjectTypeSchema>

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
  partially_ready: ['sent_to_kitchen', 'ready', 'served', 'bill_requested', 'voided'],
  ready: ['sent_to_kitchen', 'partially_ready', 'served', 'bill_requested', 'voided'],
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

// `void_requested` became a persisted state in P6 once the KDS exists to
// acknowledge it. Pre-send voids still jump straight to `voided`; post-send
// voids can now pause in `void_requested` until the kitchen explicitly
// acknowledges them, matching PRD 05/06's “don't silently vanish a live
// kitchen item” rule.
export const ORDER_ITEM_STATUS_TRANSITIONS: Readonly<Record<OrderItemStatus, readonly OrderItemStatus[]>> = {
  draft: ['sent', 'voided', 'comped'],
  sent: ['accepted', 'in_progress', 'ready', 'served', 'void_requested', 'voided', 'comped'],
  accepted: ['in_progress', 'ready', 'served', 'void_requested', 'voided', 'comped'],
  in_progress: ['ready', 'served', 'void_requested', 'voided', 'comped'],
  ready: ['in_progress', 'served', 'void_requested', 'voided', 'comped'],
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

// P6 — Kitchen / KDS (docs/prd/06-kitchen-kds.md, BUILD_WORKFLOW.md P6).
// Ticket items are station-local workflow state, distinct from order-item
// state: `queued` means the order item has been fired and routed to a station,
// but that station hasn't accepted work yet. Recall is handled by a bounded
// transition from `ready` back to `in_progress`, not a separate status.
export const KdsTicketStatusSchema = z.enum(['open', 'partially_ready', 'ready', 'voided'])
export type KdsTicketStatus = z.infer<typeof KdsTicketStatusSchema>

export const KdsTicketItemStatusSchema = z.enum(['queued', 'accepted', 'in_progress', 'ready', 'void_requested', 'voided'])
export type KdsTicketItemStatus = z.infer<typeof KdsTicketItemStatusSchema>

export const KDS_TICKET_ITEM_STATUS_TRANSITIONS: Readonly<Record<KdsTicketItemStatus, readonly KdsTicketItemStatus[]>> = {
  queued: ['accepted', 'in_progress', 'ready', 'void_requested', 'voided'],
  accepted: ['in_progress', 'ready', 'void_requested', 'voided'],
  in_progress: ['ready', 'void_requested', 'voided'],
  ready: ['in_progress', 'void_requested'],
  void_requested: ['voided'],
  voided: [],
}

export const KDS_TICKET_STATUS_TRANSITIONS: Readonly<Record<KdsTicketStatus, readonly KdsTicketStatus[]>> = {
  open: ['partially_ready', 'ready', 'voided'],
  partially_ready: ['ready', 'voided'],
  ready: [],
  voided: [],
}

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

// P11 — Inventory, Recipes & Purchasing (BUILD_WORKFLOW.md P12,
// docs/prd/12-inventory-recipes-purchasing.md, DATA_MODEL.md Inventory group).
export const StockMovementTypeSchema = z.enum([
  'receive',
  'sale',
  'recipe_deduction',
  'transfer_out',
  'transfer_in',
  'adjustment',
  'wastage',
  'return',
])
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>

export const PurchaseOrderStatusSchema = z.enum([
  'draft',
  'sent',
  'partially_received',
  'received',
  'cancelled',
])
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusSchema>

export const StockCountStatusSchema = z.enum([
  'open',
  'submitted',
  'approved',
])
export type StockCountStatus = z.infer<typeof StockCountStatusSchema>

export const InventoryItemTypeSchema = z.enum([
  'ingredient',
  'packaging',
  'supply',
  'finished_good',
  'hotel_supply',
  'other',
])
export type InventoryItemType = z.infer<typeof InventoryItemTypeSchema>

export const RecipeStatusSchema = z.enum([
  'draft',
  'active',
  'archived',
])
export type RecipeStatus = z.infer<typeof RecipeStatusSchema>

export const UnitOfMeasureSchema = z.enum([
  'piece',
  'kg',
  'g',
  'lb',
  'oz',
  'l',
  'ml',
  'cup',
  'tbsp',
  'tsp',
  'dozen',
  'case',
  'bag',
  'box',
  'bottle',
  'can',
  'crate',
  'portion',
])
export type UnitOfMeasure = z.infer<typeof UnitOfMeasureSchema>

