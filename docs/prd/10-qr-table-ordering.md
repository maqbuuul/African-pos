# PRD 10: QR / Table Ordering

## Scope

Owns the customer-facing ordering surface reached by scanning a table's
QR code — the `apps/customer-web` React+Vite app (ADR 0001). Corresponds
to master plan section 7/10 QR Ordering features and
`BUILD_WORKFLOW.md` P10. Does not re-implement order logic — this module
is a customer-facing client of PRD 05's order engine and PRD 07's
payment flow, plus its own table-session and shared-basket concerns.

## Dependencies

PRD 04 (Floor Plan & Tables) — a QR code is bound to a specific table.
PRD 05 (Order Engine) — every cart submission becomes real order_items.
PRD 07 (Payments) — pay-now flow. PRD 13 (CRM & Loyalty) — join-loyalty
capture point.

## User Stories

- As a **customer**, I need to scan a QR code, see the menu, and order
  without downloading an app or creating an account.
- As a **customer** dining with friends, I need to see what everyone at
  my table has already ordered (shared basket) so we don't duplicate or
  miss items, and I need to pay only for what I personally ordered.
- As a **customer**, I need to see my order's real status ("in the
  kitchen," "on its way") instead of wondering if it was received at
  all.
- As a **customer** eating a multi-course meal, I need to trigger "send
  the next course" myself when I'm ready, not have the kitchen guess my
  pacing.
- As a **waiter**, I need QR orders to land in the exact same order/KDS
  pipeline as orders I enter myself, so there's no second system to
  monitor.

## Workflows

### Scan and start a session

```text
Customer scans table's QR code (encodes location_id + table_id + a
rotating/short-lived session token, not a static permanently-reusable
code, to avoid stale-QR abuse after a table turns over)
  -> customer-web opens, resolves table -> checks for an existing OPEN
     table session (PRD 04's table state: seated/ordered/eating)
  -> If none exists: a new order is opened against this table exactly as
     PRD 05 describes (channel = qr), table -> seated
  -> If one exists (another diner already scanned in): this customer
     joins the existing session -- see multi-phone shared basket below
  -> Menu loads (PRD 03, filtered to current day-part/availability)
```

### Multi-phone shared table basket

```text
Multiple diners at the same table each scan the same QR code
  -> Each customer's device gets its own lightweight session identity
     (phone number or anonymous session, customer's choice) linked to
     the SAME underlying order (not separate orders per phone)
  -> Each diner adds items independently; all diners' devices show the
     live shared cart (WebSocket subscription, ADR 0001's real-time
     layer) -- not a per-device-only view
  -> Each order_item is tagged with which diner/seat added it (reusing
     PRD 05's seat_number field)
  -> At bill time, each diner can request "my items only" as their own
     bill (PRD 05's split-by-seat), and pay just that (PRD 07) --
     without needing to coordinate through a single phone
```

### Submitting an order

```text
Customer builds cart (product + modifiers, same rules as PRD 03 enforces
for staff-entered orders -- min/max modifier selection etc.)
  -> Submits -> becomes real order_items on the table's order (PRD 05),
     channel=qr, fired immediately (no waiter "hold" step needed by
     default, though the location can configure a manager-review step
     for QR orders if desired)
  -> Customer sees live order status timeline: received -> in the
     kitchen -> on its way, driven by the same OrderItemSent / kitchen
     ticket bump events (PRD 06) staff-facing screens use -- one source
     of truth for order status, not a separately-tracked customer-facing
     state
```

### Fire next course

```text
Customer has items marked as a later course (held, per PRD 05's hold-
and-fire pattern) and taps "send next course"
  -> Held items for that course fire immediately (same action a waiter
     could take, exposed to the customer directly for self-paced dining)
```

### Rate a dish

```text
Item reaches order_item.status = served (or customer manually confirms
receipt)
  -> Customer prompted (non-blocking, dismissible) to rate that specific
     dish
  -> Rating fed to PRD 14 (menu engineering) and PRD 06 (kitchen
     performance) in near-real-time -- not batched into a delayed survey
```

### Pay now or pay later

```text
Customer chooses "pay now" at any point (not just at the end)
  -> Triggers PRD 07's payment flow scoped to their own items (via
     split-by-seat if others are still ordering) or the full table
     -> On confirmation, their portion is marked paid; they can leave
        without waiting for the whole table to finish
"Pay later": customer flags intent to pay at the end; waiter handles
  final settlement normally through POS if the customer doesn't
  self-checkout
```

### Join loyalty / request waiter / feedback

```text
Any point in the session: customer can join loyalty (captures phone/
name into PRD 13's customer identity graph), request a waiter (creates
a lightweight notification to floor staff, not a full order-engine
event), or leave feedback (text/rating, feeds PRD 14 and, for negative
feedback, master plan Module 4's real-time alert to the manager)
```

## Screens & UI Behavior

- **Menu view**: category-browsable, photos, local-language names (PRD
  03), day-part-filtered. Must load fast on cheap Android phones over
  patchy 3G/4G — this is `apps/customer-web`'s explicit performance
  budget from ADR 0001, the single hardest-constrained surface in the
  whole product.
- **Shared basket view**: who-ordered-what, running total, clearly
  showing "your items" vs. "table total."
- **Order status timeline**: received → kitchen → ready → served,
  updating live via WebSocket, not requiring a manual refresh.
- **Pay screen**: reuses PRD 07's split/payment-method flow, scoped to
  the requesting diner's items by default.

## Permissions

This module is customer-facing and effectively unauthenticated by
default (a table QR scan, not a staff login) — "permissions" here are
about what an anonymous session can and cannot do, not a role matrix:

| Action | Anonymous QR session |
| --- | --- |
| View menu, add items, submit order | Yes |
| Pay for own items | Yes |
| Void/discount any item | No — staff-only, PRD 05 |
| See other tables' orders | No — session is table-scoped only |
| Reopen a closed/paid order | No |

## Business Rules

- QR-submitted items follow the **exact same** business rules as
  staff-entered items (PRD 03/05): modifier min/max enforcement,
  price/name snapshot at add-time, category/station routing. There is no
  separate, looser validation path for customer self-service.
- A table's QR session is bound to that table's *current* open order —
  once the table closes/cleans (PRD 04), the QR code's session token is
  invalidated; a customer scanning a stale QR after table turnover starts
  a fresh session against whatever the table's current state is, never
  silently attaches to a stranger's now-finished order.
- Fire-next-course and pay-now are customer-empowerment actions layered
  on PRD 05's existing hold/fire and payment primitives — this module
  does not duplicate that logic, it calls it.
- Feedback/ratings are optional and dismissible at every step — this
  surface must never block or gate the core ordering flow behind a
  rating prompt.

## Edge Cases & Failure States

- Customer's phone loses connectivity mid-order: `customer-web` is not a
  PowerSync/offline-first client (that's the POS device's job) — a
  disconnected customer session shows a clear "reconnecting" state and
  does not silently lose an unsent cart; submission is retried once
  connectivity returns, using the same idempotency approach as any other
  order write.
- Two diners at the same table submit conflicting modifier choices on
  what they both think is "their" cart (rare, if the UI doesn't make
  per-diner ownership clear enough): each submitted item is independently
  valid and both are added — there's no real conflict at the data level,
  only a potential UX confusion the shared-basket view is designed to
  prevent.
- QR code physically damaged/unreadable, or customer's camera can't
  scan: location can print the resolved short URL as a fallback (not a
  hard dependency on camera QR scanning working).
- Customer attempts to pay for items that a staff member has already
  voided in the meantime: pay screen re-validates the bill total against
  the current order state immediately before payment, not against a
  possibly-stale cached total.

## Data Model

`DATA_MODEL.md` Restaurant MVP: reuses `orders`, `order_items`, `bills`
(PRD 05), `restaurant_tables` (PRD 04), and `table_qr_sessions` for the
rotating-token anti-abuse behavior described above.

## Events Emitted

- `QrSessionStarted` / `QrOrderSubmitted` — consumed by: PRD 14 (channel-
  mix reporting), product analytics.
- `WaiterRequested` — consumed by: notification module, floor staff
  device alert.
- `DishRated` / `FeedbackSubmitted` — consumed by: PRD 14 (menu
  engineering, kitchen performance), notification module (negative
  feedback → immediate manager alert per Module 4).

## API Surface

- `GET /qr/:table_token` (resolves table, opens/joins session)
- `POST /qr/:session_id/items`, `GET /qr/:session_id/cart` (live, via
  WebSocket subscription for shared-basket updates)
- `POST /qr/:session_id/fire-next-course`
- `POST /qr/:session_id/pay` (delegates to PRD 07)
- `POST /qr/:session_id/rate-dish`, `POST /qr/:session_id/feedback`,
  `POST /qr/:session_id/request-waiter`

## Offline Behavior

`apps/customer-web` is explicitly **not** built offline-first (unlike
POS/KDS) — a customer without connectivity cannot use QR ordering at all,
which is an acceptable and correct scope boundary: the restaurant's own
operations (PRD 05/06/11) must survive an outage; a single customer's
phone losing signal for a few seconds is handled with a reconnect/retry
UI, not full offline capability.

## Acceptance Criteria

- A customer can scan, view the menu, submit an order, and see it appear
  on the kitchen's KDS (PRD 06) and staff-facing order view (PRD 05)
  within the same latency budget as a staff-entered order.
- Two phones scanning the same table's QR code see the same shared
  basket update within one WebSocket round trip of each other.
- A diner can pay for exactly their own items via split-by-seat without
  needing another diner's cooperation or device.

## Non-Goals

- WhatsApp ordering and general online ordering (pickup/delivery,
  branded page) — related but distinct customer channels, covered by
  master plan section 10, not this table-QR-specific PRD.
- Kiosk and drive-thru ordering UI — separate physical form factors,
  later enhancement.
