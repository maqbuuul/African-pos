# PRD 05: Order Engine

## Scope

Owns the order/bill lifecycle: creating an order, adding/modifying items,
discounts, voids, splitting into bills, and closing. This is the center
of gravity `BUILD_WORKFLOW.md` describes everything else channeling
into. Corresponds to master plan section 7 Order Management Features and
`DATA_MODEL.md` (`orders`, `order_items`, `order_item_modifiers`, `bills`,
`bill_items`). Does not own payment capture itself (PRD 07 — a bill
reaching `payment_pending` hands off to it) or kitchen routing (PRD 06,
which consumes this module's item-sent events).

## Dependencies

PRD 00, 01 (tenancy, auth). PRD 03 (Menu & Catalog) — order items
reference products/modifiers and capture their price/name at sale time.
PRD 04 (Floor Plan & Tables) — dine-in orders are table-scoped; this PRD
and PRD 04 co-drive table state.

## User Stories

- As a **waiter**, I need to open an order for a table, add items with
  modifiers and notes, and send them to the kitchen, in one continuous
  flow without re-navigating screens.
- As a **cashier**, I need to ring up a counter sale (no table) as fast
  as a waiter rings up a dine-in order — the engine must not assume every
  order has a table.
- As a **waiter**, I need to split a bill by seat, by item, or evenly,
  because guests pay differently depending on the group.
- As a **manager**, I need to void an item or the whole bill with a
  reason, and have that show up in reporting and audit immediately.
- As an **owner**, I need every order's channel (POS, QR, phone,
  delivery) tracked, so channel-mix reporting (PRD 14) is accurate
  without manual tagging.

## Workflows

### Opening and building an order

```text
Order opened (dine-in: tied to a table via PRD 04; counter: no table,
channel = pos; other channels per PRD 10/15/16)
  -> order.status = open, channel set at creation, never changed after
  -> Staff adds items: product + modifiers + quantity + seat number
     (optional) + course (optional) + kitchen note (optional)
  -> Each order_item captures product name, price, and modifier prices
     AS THEY ARE RIGHT NOW (snapshot, not a live reference -- see
     Business Rules)
  -> order_item.status = draft until explicitly sent
```

### Hold and fire / sending to kitchen

```text
Waiter marks item(s) or the whole order "fire"
  -> order_item.status: draft -> sent
  -> Kitchen ticket generated per station (PRD 06 consumes this)
  -> "Hold" items (e.g. dessert held until mains are cleared) stay
     status = draft, staff fires them explicitly later -- this is a
     first-class action, not a workaround
```

### Discounts

```text
Staff applies a discount (item-level or bill-level; percentage or fixed)
  -> System checks permission: orders:discount_small vs
     orders:discount_large (threshold configurable per location)
  -> Above threshold and staff lacks large-discount permission ->
     approval_request created (PRD 01), discount held pending approval
  -> Applied discount recorded with reason and staff_id, contributes to
     order.discount_amount, never silently absorbed into the item price
```

### Void

```text
Staff requests void on an item or the whole bill
  -> order_item.status -> void_requested if item already sent to kitchen
     (kitchen must acknowledge -- can't silently vanish a ticket the
     chef is already cooking)
  -> If item never left draft: void is immediate, no kitchen ack needed
  -> Void requires a reason (enforced by PRD 02's audit rule)
  -> Permission check: orders:void_item vs orders:void_bill, may require
     manager approval per master plan section 22
  -> order_item.status -> voided; excluded from bill totals but NOT
     deleted from the order -- the void itself is data
```

### Splitting into bills

```text
Waiter/cashier chooses split method at bill_requested (PRD 04 trigger):
  - By item: staff assigns each order_item to bill 1, 2, 3...
  - By seat: system auto-groups order_items by their seat_number
  - Evenly: system divides the total by N, generating N equal bills
    (rounding remainder assigned to bill 1, deterministically)
  -> Each resulting bill (DATA_MODEL bills/bill_items) references its
     subset of order_items -- items themselves are never duplicated or
     copied, only referenced
  -> Each bill can be paid independently (PRD 07), tips per bill
  -> Split-check payment link per seat (master plan section 7): each
     bill can generate its own WhatsApp/SMS payment link so each diner
     pays their own share from their own phone
```

### Closing an order

```text
All bills for an order reach status = paid
  -> order.status -> closed, closed_at set
  -> Table (if any) -> cleaning (PRD 04)
  -> order.total_amount, tax_amount, service_charge_amount finalized
     (append-only from here -- see Business Rules)
```

## Screens & UI Behavior

- **Order builder** (POS/handheld): product grid (PRD 03) feeds into a
  running cart/ticket view. Seat/course assignment is inline, not a
  separate step, because waiters build orders while standing at the
  table. Cart total recalculates instantly on any change (master plan
  section 21 latency target).
- **Order detail**: full item list with status per item (draft/sent/
  ready/served/voided), running total, applied discounts, and — per PRD
  02 — inline audit trail of any void/discount/reopen on this order.
- **Split-bill screen**: visual seat/item assignment (drag items to a
  bill, or auto-split-evenly toggle), live preview of each resulting
  bill's total before confirming.
- **Void/discount reason prompt**: appears at the point of action,
  required field, not skippable (PRD 02).

## Permissions

Full matrix in master plan section 22 (Sales group:
`orders:create`, `orders:update_own`, `orders:update_any`,
`orders:void_item`, `orders:void_bill`, `orders:discount_small`,
`orders:discount_large`, `orders:refund`, `orders:reopen_closed`). This
module enforces every one of them; specific notes:

- `orders:update_own` vs `update_any` — a waiter can normally only modify
  orders they opened; `update_any` (supervisor+) is needed for shift
  handoffs and covering another section.
- `orders:reopen_closed` is deliberately rare (manager+) — reopening a
  closed, paid order has real financial-reporting implications (PRD 14's
  daily totals) and always requires a reason.

## Business Rules

- **Order items snapshot price and product name at the moment they're
  added**, per master plan section 27's conflict policy and PRD 03's
  pricing rule. An order is never a live join against current product
  data — this is what makes historical orders immutable even as the
  menu changes.
- Orders and their totals are **append-only in spirit**: `order_items`
  are added/voided (never deleted), discounts are recorded as their own
  entries (never merged into price), and `order.total_amount` is
  recalculated from current non-voided items + discounts + tax, not
  hand-edited directly.
- Tax and service charge are computed per the location's configured tax
  category (Module 18 country adapter) at the time totals are
  calculated — for a long-running open order, this recalculates as items
  are added, using each item's own tax category, not one blanket rate
  assumed at order-open time.
- A voided item that was already sent to the kitchen requires a kitchen
  acknowledgment (PRD 06) before the void is considered complete — this
  prevents a server voiding an item the kitchen has already started or
  finished cooking without the kitchen knowing.
- Order `channel` is set once at creation and never mutated — channel-mix
  reporting (PRD 14) depends on this being a reliable, unchanging fact
  about how the order originated.

## Edge Cases & Failure States

- Item added to an order after the bill has been split: must be
  explicitly assigned to one of the existing bills (or start a new one)
  — never silently added to "bill 1" by default, which would misattribute
  cost.
- Void requested on an item that the kitchen has already marked `ready`
  or `served`: allowed, but escalates to `orders:void_bill`-level
  permission regardless of the item's individual value — a served item
  being voided is closer to a comp/loss than a simple order-entry
  correction.
- Network/offline: two devices at the same table both add items to the
  same order while offline, then reconnect — per master plan section 27,
  item-add operations merge append-only (both sets of additions survive);
  only conflicting *edits* to the same item need conflict review.
- Order left open indefinitely (staff forgot to close): reporting (PRD
  14) flags orders open past a configurable threshold as an exception,
  surfaced to the manager — this is a detection/alerting concern, not an
  auto-close, since auto-closing a genuinely still-active order (e.g. a
  slow bar tab) would be actively harmful.

## Data Model

`DATA_MODEL.md` Restaurant MVP: `orders`, `order_items`,
`order_item_modifiers`, `bills`, `bill_items`.

## Events Emitted

- `OrderOpened` / `OrderItemAdded` / `OrderItemSent` /
  `OrderItemVoided` / `OrderDiscountApplied` / `OrderClosed` — consumed
  by: PRD 06 (kitchen ticket generation on `OrderItemSent`), PRD 04
  (table state transitions), PRD 02 (audit trail for void/discount), PRD
  14 (sales reporting), PRD 17 (AI/ML feature inputs — e.g. discount
  patterns for fraud detection).
- `BillCreated` / `BillPaid` — consumed by: PRD 07 (payment flow
  trigger/completion), PRD 09 (receipt generation trigger).

## API Surface

- `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id`
- `POST /orders/:id/items`, `PATCH /orders/:id/items/:item_id`
  (modify/void), `POST /orders/:id/items/:item_id/fire`
- `POST /orders/:id/discounts`
- `POST /orders/:id/split` (by-item/by-seat/evenly), returns generated
  `bills`
- `POST /orders/:id/close`, `POST /orders/:id/reopen`

## Offline Behavior

Fully offline-capable — this is the single most important module for
offline correctness, since "open a table, take a full cash-paying
dine-in order, and reconcile cleanly once reconnected" is
`BUILD_WORKFLOW.md` P11's literal acceptance gate. Every write in this
module's workflows goes through the operation-log/upload-queue pattern
(PRD 11). Cash payments can complete fully offline (PRD 07); mobile
money/card require online confirmation, which can leave an order in
`bill_requested`/`payment_pending` state waiting for connectivity — the
UI must show this state honestly, not hide the wait.

## Acceptance Criteria

- A waiter can open a table, add items across two courses, split the
  bill by seat, and close all resulting bills — fully offline — with no
  duplicate orders or payments after reconnect (matches P11's gate).
- A void on a kitchen-acknowledged item is blocked until the kitchen
  acknowledges, verified by attempting the void immediately after firing
  and confirming it's held pending.
- Order totals recompute correctly (tax, service charge, discounts)
  after any combination of item add/void/discount, verified against a
  reference calculation for at least: single item, multiple items with
  mixed tax categories, item + bill-level discount stacking.

## Non-Goals

- Payment method-specific logic (cash drawer handling, mobile money
  callback verification) — PRD 07.
- Kitchen ticket routing/station logic — PRD 06.
- Reservation-to-order linkage — deferred with PRD 04's reservation
  non-goal.
