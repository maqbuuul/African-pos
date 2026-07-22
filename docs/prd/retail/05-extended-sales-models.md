# Retail PRD 05: Extended Sales Models

## Scope

Owns layaway/rent-to-own, rentals, job cards (repairs/services), event
ticketing, and the franchise royalty engine — the Africa-market-relevant
differentiators master plan section 9 calls out beyond standard
sell-now checkout. Corresponds to master plan section 9 (Retail Extended
Sales Models) in full.

**Status note:** see Retail PRD 01 — Year 3+ priority. Build phase:
**R5**, see `BUILD_WORKFLOW_RETAIL.md`.

## Dependencies

Retail PRD 01 (these are all variations on the sale concept), Retail PRD
02 (stock/goods release tied to payment completion).

## User Stories

- As a **customer**, I need to pay for an item over time (layaway) and
  only take it home once I've paid enough, without the store
  extending me unmanaged credit risk.
- As a **customer**, I need to rent an item with clear deposit and
  due-date terms, and a fair, transparent late-fee calculation if I'm
  late.
- As a **customer**, I need to track my repair's status without calling
  the shop every day.
- As an **event organizer/retailer**, I need to sell and validate
  tickets at the door without a separate ticketing system.
- As a **franchisor**, I need royalty calculated automatically and a
  clear, fair compliance score for each branch — not a manual monthly
  reconciliation.

## Workflows

### Layaway / rent-to-order

```text
Customer selects item(s), agrees to a layaway plan: deposit amount,
  installment schedule, total price locked at plan creation (price
  snapshot discipline, same as every other sale record in this
  document set)
  -> layaway_plans created: deposit paid, remaining balance scheduled
     across N installments
  -> Goods held (not released to the customer) until the plan's paid
     threshold is met (location-configurable -- could be 100%, or a
     lower "release at 80%, pay remainder on pickup" policy)
  -> Automatic reminder sent (Restaurant OS PRD 09's notification
     pipeline, reused) before each installment is due
  -> Payment received -> layaway_installments row recorded (append-only,
     never a mutable "amount paid so far" field)
  -> Defined forfeiture policy if payments lapse: after a configured
     grace period past a missed installment, the plan can be cancelled
     per policy -- deposit forfeiture terms shown to the customer at
     plan creation, never applied silently after the fact
```

### Rentals

```text
Customer rents an item: due date and deposit set at checkout
  -> Condition notes captured at checkout (photo optional) and again at
     return -- this is the dispute-prevention mechanism, so damage
     claims aren't a he-said-she-said after the fact
  -> Return processed: condition compared, late-return fee calculated
     automatically if past due date (rate and grace period are a
     tenant_settings-style configurable, not hardcoded)
  -> Deposit refunded minus any late fee/damage charge, or the full
     deposit forfeited per policy if the item isn't returned at all
     past a configured cutoff
```

### Job cards (repairs and services)

```text
Job card state machine: intake -> diagnosis -> quote_approved ->
  in_progress -> ready -> collected (master plan section 9, explicitly
  "same underlying state-machine pattern as an order, applied to a
  service instead of a product")
  -> Intake: item received, initial notes/photos, customer contact
  -> Diagnosis: technician assesses, produces a quote
  -> Customer approves quote (or declines -- job card can close at this
     stage with a diagnosis fee if the location charges one)
  -> In progress: work performed, parts usage recorded against
     inventory (Retail PRD 02, if parts are stock-tracked)
  -> Ready: work complete, customer notified
  -> Collected: customer picks up, payment finalized, job card closes
  -> WhatsApp status push at EVERY transition (master plan section 9's
     explicit requirement) -- the customer should never have to call to
     ask "is it ready yet"
```

### Event ticketing

```text
Event created with capacity and ticket types/pricing
  -> QR ticket issued at sale (same QR-generation pattern as Restaurant
     OS's receipt/loyalty QR usage, not a new mechanism)
  -> Door-scanner check-in mode: scanning a ticket validates it against
     capacity and prior-use (a ticket cannot check in twice -- the scan
     event itself is the source of truth, not a manually-maintained
     attendee list)
  -> Capacity tracked live -- selling stops automatically at capacity,
     not manually monitored
  -> Refund/transfer handling: a ticket can be refunded (per event
     policy) or transferred to a different attendee before the event,
     both recorded as explicit state changes on the ticket record, never
     silent
```

### Franchise royalty engine

```text
Each branch's daily/period sales feed automatic royalty calculation:
  royalty_amount = branch_sales x franchise_royalty_rules.percentage
  -> Compliance score computed from configured inputs: opens on time
     (per Restaurant OS staff-attendance-style clock data if
     applicable), buys only from approved suppliers (cross-referenced
     against Retail PRD 03's supplier records), stays within margin
     thresholds (cross-referenced against Retail PRD 07's margin
     reporting)
  -> HQ-set price floor: branches cannot sell below the floor price
     without explicit HQ override -- enforced at the same point Retail
     PRD 01's "sell below allowed price requires approval" rule already
     checks, extended with a franchise-HQ-set floor as an additional
     input to that same check, not a parallel mechanism
```

## Screens & UI Behavior

- **Layaway plan builder**: deposit/installment schedule entry, clear
  forfeiture-policy display shown to the customer before commitment.
- **Rental checkout/return**: condition-notes capture (photo upload),
  automatic late-fee calculation shown before finalizing a return.
- **Job card board**: kanban-style view by state (intake → collected),
  mirroring Restaurant OS KDS's ticket-board pattern conceptually,
  applied to service jobs instead of food orders.
- **Event door-scanner mode**: full-screen, scan-optimized, immediate
  valid/invalid/already-used feedback — this is used under time
  pressure at an event entrance, same "frontline speed" design
  discipline as Restaurant OS's POS screens.
- **Franchise compliance dashboard** (franchisor/HQ): royalty owed per
  branch, compliance score, price-floor violations flagged.

## Permissions

| Action | store_manager | franchisor/HQ | technician |
| --- | --- | --- | --- |
| Create layaway/rental agreement | Yes | — | — |
| Approve layaway forfeiture | Yes (threshold) | Yes | — |
| Update job card status | — | — | Yes |
| Approve a repair quote (customer-facing action, staff records it) | Yes | — | Yes |
| Set franchise royalty rules / price floors | No | Yes | — |
| Override a price-floor violation | No | Yes | — |

## Business Rules

- Every one of these five sale models follows the same append-only,
  price-snapshot, reason-required discipline as every other financial
  record in this document set — they are variations on "a sale," not
  exceptions to the platform's core data-integrity rules.
- A job card's WhatsApp status push at every transition is not optional
  — master plan section 9 states this explicitly, and it's the
  differentiating feature (vs. a generic repair-tracking system) this
  PRD exists to deliver.
- A ticket cannot check in twice — the scan event is authoritative;
  there is no manual override that bypasses this check without an
  explicit, audited exception process.
- Franchise royalty calculation and compliance scoring are transparent
  to the branch, not opaque — a branch manager can see exactly how their
  royalty and compliance score were computed, consistent with the
  platform-wide "explain, don't just dictate" principle.

## Edge Cases & Failure States

- Layaway customer pays exactly to the release threshold but the item
  sold out in the meantime (rare, if the item wasn't properly held):
  held-item stock deduction must happen at plan creation, not at
  payment completion, specifically to prevent this — flagged as a
  design requirement, not an acceptable risk to leave open.
- Rental item returned significantly damaged, deposit doesn't cover the
  full repair/replacement cost: recorded as a shortfall requiring a
  separate customer charge/collection process, never silently absorbed
  as a loss without a record.
- Job card customer never collects a ready item: after a configurable
  period, escalates to a manager decision (storage fee, disposal per
  local regulation, continued holding) — never silently forgotten.
- Franchise branch disputes their compliance score: score components
  are individually visible and traceable to source data (supplier
  purchase records, margin data, attendance data), so a dispute is
  resolvable by pointing at the underlying facts, not an opaque
  black-box number.

## Data Model

`DATA_MODEL.md` Later Retail Extensions, in full: `layaway_plans`,
`layaway_installments`, `rentals`, `job_cards`, `event_tickets`,
`franchise_royalty_rules`.

## Events Emitted

- `LayawayPlanCreated` / `LayawayInstallmentPaid` / `LayawayForfeited` —
  consumed by: notification (reminders), Retail PRD 07.
- `RentalCheckedOut` / `RentalReturned` / `LateFeeCalculated` —
  consumed by: Retail PRD 07.
- `JobCardStatusChanged` — consumed by: notification (WhatsApp push at
  every transition, per the explicit requirement above).
- `TicketIssued` / `TicketCheckedIn` / `TicketRefunded` /
  `TicketTransferred` — consumed by: Retail PRD 07 (event reporting).
- `RoyaltyCalculated` / `ComplianceScoreUpdated` / `PriceFloorViolated`
  — consumed by: franchise compliance dashboard, notification (HQ
  alert on violation).

## API Surface

- `POST /retail/layaway-plans`, `POST /retail/layaway-plans/:id/payments`
- `POST /retail/rentals`, `POST /retail/rentals/:id/return`
- `POST /retail/job-cards`, `PATCH /retail/job-cards/:id/status`
- `POST /retail/events`, `POST /retail/events/:id/tickets`,
  `POST /retail/tickets/:code/check-in`
- `GET /retail/franchise/:branch_id/royalty`,
  `GET /retail/franchise/:branch_id/compliance-score`

## Offline Behavior

Job card status updates and door-scanner ticket check-in both benefit
from offline tolerance (a repair shop's back room or an event venue's
entrance may have poor connectivity) — worth explicit offline-capable
design using the same operation-log pattern as Restaurant OS PRD 11,
flagged here as a design decision for whoever implements this PRD rather
than assumed either way.

## Acceptance Criteria

- A layaway plan correctly holds stock from creation, not from final
  payment, verified against the release-threshold edge case above.
- Every job card transition produces exactly one WhatsApp status push.
- A ticket cannot be checked in twice, verified by attempting a
  duplicate scan.
- Franchise royalty calculation matches `branch_sales × percentage`
  exactly, verified against a reference period's sales data.

## Non-Goals

- Full warranty-claim management beyond the job-card pattern.
- Dynamic event ticket pricing (fixed pricing per ticket type only, for
  this PRD's initial scope).
