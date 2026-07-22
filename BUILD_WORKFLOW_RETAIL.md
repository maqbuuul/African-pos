# AI Build Workflow — Retail OS

Companion to `BUILD_WORKFLOW.md` (Restaurant OS) and `BUILD_WORKFLOW_
HOTEL.md`, same format and same rules. Execution playbook for Retail OS
once it enters the build queue — `HOSPITALITY_OS_MASTER_PLAN.md` section
3 scopes Retail OS to Year 3+. Every phase assumes Restaurant OS's
shared-platform phases (P0–P2 at minimum) are already built, since
Retail OS is a vertical on the same shared platform, not a separate
system.

Phases are prefixed `R` to avoid collision with Restaurant OS's `P0`–
`P19` and Hotel OS's `H1`–`H9` numbering.

`HOSPITALITY_OS_MASTER_PLAN.md` sections 9/25 define **what** to build.
`docs/prd/retail/*.md` define the workflows, permissions, business
rules, and acceptance criteria in detail — this document defines **the
order**.

## 0. How To Use This Document

Identical rules to `BUILD_WORKFLOW.md` section 0 and `BUILD_WORKFLOW_
HOTEL.md` section 0: respect `Depends on`, work only inside listed
modules, a phase is done at its acceptance gate not at compile time,
never borrow ahead, commit per completed phase.

## 1. Build Hierarchy

```text
R1 Inventory + variants             (products, variants, barcodes, serials, batches, warehouses)
R2 POS + checkout                   (barcode scan, cart, suspend/resume, quotes, sale state machine)
R3 Procurement                      (purchase orders, RFQs, reorder suggestions)
R4 Returns + exchanges              (return state machine, store credit)
R5 Extended sales models            (layaway, rentals, job cards, ticketing, franchise royalty)
R6 Omnichannel                      (unified inventory, BOPIS, ship-from-store, social/marketplace)
R7 CRM + reports + BI + AI          (owner/inventory/customer/operations dashboards, ML, briefings)
```

Dependency graph in plain terms:

- **R1** is foundational, the way Menu & Catalog (P3) is for Restaurant
  OS — checkout (R2) cannot ring up a sale against a variant that
  doesn't exist yet.
- **R2 POS + checkout** is Retail OS's center of gravity, the way Order
  Engine (P5) is for Restaurant OS — R4 (returns), R5 (extended sales
  models), and R6 (omnichannel) all reference or extend a sale; they are
  variations on R2, not replacements for it.
- **R3 Procurement** depends on R1 (it receives against variant-level
  inventory) but not on R2 — a store can receive stock before it can
  sell, and building procurement before checkout is a legitimate order
  if a specific implementation wants warehouse operations running
  first. This playbook keeps R2 before R3 because `docs/prd/retail/03-
  procurement.md` explicitly reuses Restaurant OS PRD 12's discipline
  and most implementations will find it easier to validate procurement
  against a working checkout/stock-deduction loop first.
- **R4 Returns** depends on R2 (a return references an original sale)
  and R1 (stock movements on return).
- **R5 Extended sales models** depends on R2/R1 — layaway, rentals, job
  cards, and ticketing are each "variations on a sale" per the PRD's own
  framing, not independent systems.
- **R6 Omnichannel** depends on R2/R1 (one inventory pool, one sale
  path) and reuses Restaurant OS PRD 13's customer-identity system
  directly for the "unified customer profile" requirement — it does not
  wait for R7, despite `docs/prd/retail/06-omnichannel.md` listing R7 as
  a dependency for that specific point; that dependency is satisfied by
  Restaurant OS PRD 13, already built, not by R7's reporting layer. R7
  is placed last because its own reporting/ML/AI scope genuinely needs
  every other phase's events to exist first.
- **R7 CRM + reports + BI + AI** depends on R1–R6 — identical reasoning
  to why Restaurant OS's P14/P17 and Hotel OS's H9 are late.

## 2. Phase-By-Phase Workflow

### R1 — Inventory + Variants

Depends on: Restaurant OS P1 (shared domain/schema), P2 (auth).

Full spec: `docs/prd/retail/02-inventory-variants.md`.

Build (`apps/api/src/modules/retail-inventory`):

- Tables: `retail_products`, `retail_variants`, `barcodes`,
  `serial_numbers`, `batches`, `warehouses`, `stock_transfers`.
- Variant modeling (parent product + variant matrix, e.g. size × color),
  bundles/kits, bin-location tracking.
- Stock count workflow: frozen expected-snapshot, barcode-scan
  counting, tiered variance approval (low auto-approve, medium manager
  review, high owner/auditor review).
- Append-only stock-movement discipline, identical rule to Restaurant OS
  PRD 12 — `stock_levels` is never directly overwritten.
- `GET/POST /retail/products`, `GET/POST /retail/variants`,
  `POST /retail/stock-counts`, `POST /retail/stock-transfers`.

Acceptance gate: exactly `docs/prd/retail/02`'s acceptance criteria —
stock levels are always reconstructable by replaying `stock_movements`
from zero; a stock count's variance reflects only pre-freeze
discrepancies; every serialized-item sale consumes exactly one serial
record.

### R2 — POS + Checkout

Depends on: R1.

Full spec: `docs/prd/retail/01-pos-checkout.md`.

Build (`apps/pos-mobile` retail mode, `apps/api/src/modules/retail-
sales`):

- Tables: `sales`, `sale_items`, `quotes`.
- Sale state machine: `cart → quoted → pending_payment → paid →
  fulfilled → returned → partially_returned`, `voided` reachable from
  `cart`/`quoted`/`pending_payment`.
- Barcode-scan-to-variant resolution, suspend/resume, multiple
  concurrent carts, quotes with a validity period.
- Payment: reuses Restaurant OS PRD 07's payment adapters directly, not
  reimplemented.
- `POST /retail/sales`, `POST /retail/sales/:id/suspend`,
  `POST /retail/sales/:id/resume`, `POST /retail/quotes`.

Acceptance gate: exactly `docs/prd/retail/01`'s acceptance criteria —
barcode scanning resolves the exact variant; a serialized product
requires serial capture; a batch/expiry product deducts from the
selected batch; a cashier cannot sell below the allowed price without
approval.

### R3 — Procurement

Depends on: R1.

Full spec: `docs/prd/retail/03-procurement.md`.

Build (`apps/api/src/modules/retail-procurement`):

- Tables: `purchase_orders`, `purchase_order_items`, `goods_receipts`,
  `suppliers` (shared pattern with Restaurant OS PRD 12), plus RFQ
  tables per the PRD's flagged schema gap.
- PO state machine: `draft → pending_approval → approved → sent →
  partially_received → received → closed`, `cancelled` reachable from
  any pre-sent state.
- Reorder suggestion workflow (velocity, lead time, safety stock,
  seasonality, promotion calendar), RFQ comparison, partial receiving.
- `POST /retail/rfqs`, `POST /retail/purchase-orders`,
  `POST /retail/purchase-orders/:id/receive`,
  `GET /retail/reorder-suggestions`.

Acceptance gate: exactly `docs/prd/retail/03`'s acceptance criteria —
the full reorder workflow (suggestion → draft → approval → send →
receive → stock update → supplier performance update) completes
end-to-end.

### R4 — Returns + Exchanges

Depends on: R2, R1.

Full spec: `docs/prd/retail/04-returns-exchanges.md`.

Build (`apps/api/src/modules/retail-returns`):

- Tables: `returns`, `exchanges`.
- Return state machine: `requested → approved/rejected →
  refunded/exchanged/store_credit_issued`.
- Receipt-linked return, no-receipt/past-window approval gating,
  damaged-item quarantine routing, store credit as an append-only
  liability ledger.
- `GET /retail/sales/:id/return-eligibility`, `POST /retail/returns`,
  `POST /retail/exchanges`.

Acceptance gate: exactly `docs/prd/retail/04`'s acceptance criteria — a
return links to its original sale when found; a refund never exceeds
the original paid amount; a damaged return routes to quarantine, never
sellable stock; every return has a recorded reason.

### R5 — Extended Sales Models

Depends on: R2, R1.

Full spec: `docs/prd/retail/05-extended-sales-models.md`.

Build (`apps/api/src/modules/retail-extended-sales`):

- Tables: `layaway_plans`, `layaway_installments`, `rentals`,
  `job_cards`, `event_tickets`, `franchise_royalty_rules`.
- Layaway (deposit + installment schedule, stock held from plan
  creation not final payment, forfeiture policy), rentals (deposit +
  due date, condition notes at checkout/return, automatic late-fee
  calculation), job cards (`intake → diagnosis → quote_approved →
  in_progress → ready → collected`, WhatsApp push at every transition),
  event ticketing (QR issuance, door-scanner check-in, capacity
  tracking), franchise royalty engine (automatic calculation,
  compliance scoring, HQ price floor).
- `POST /retail/layaway-plans`, `POST /retail/rentals`,
  `POST /retail/job-cards`, `POST /retail/tickets/:code/check-in`,
  `GET /retail/franchise/:branch_id/royalty`.

Acceptance gate: exactly `docs/prd/retail/05`'s acceptance criteria — a
layaway plan holds stock from creation; every job card transition
produces exactly one WhatsApp push; a ticket cannot check in twice;
franchise royalty matches `branch_sales × percentage` exactly.

### R6 — Omnichannel

Depends on: R2, R1, Restaurant OS PRD 13 (customer identity, reused
directly — see the dependency note in section 1 above).

Full spec: `docs/prd/retail/06-omnichannel.md`.

Build (`apps/api/src/modules/retail-omnichannel`, reuses
`packages/integrations`' `ChannelAdapter` pattern):

- One inventory pool enforced across every channel — no channel ever
  reads/writes a channel-specific stock copy.
- Time-bounded stock reservation for online orders (soft-hold, auto-
  release on abandonment), BOPIS and ship-from-store fulfillment queues,
  return-anywhere (tenant-wide receipt lookup, receiving-branch stock
  credit), social/marketplace commerce webhooks (WhatsApp/Instagram/
  Facebook/marketplace).
- `POST /retail/omnichannel/reserve-stock`,
  `POST /webhooks/retail-commerce/:channel`,
  `GET /retail/fulfillment-queue`.

Acceptance gate: exactly `docs/prd/retail/06`'s acceptance criteria — a
sale on any channel is immediately reflected in every other channel's
stock read; an abandoned reservation releases automatically; a return
at a different branch than purchase correctly credits the receiving
branch.

### R7 — CRM + Reports + BI + AI

Depends on: R1–R6.

Full spec: `docs/prd/retail/07-crm-reports-bi-ai.md`.

Build (`apps/api/src/modules/retail-reports`, `services/ai-ml`):

- Owner/inventory/customer/operations dashboards exactly as master plan
  section 9 groups them.
- ML models: revenue forecasting, demand forecasting, stockout
  prediction, customer churn, CLV, fraud detection, recommendation
  engine, inventory optimization, promotion effectiveness, supplier
  performance prediction.
- Daily retail briefing and the other task-specific agents listed in
  the PRD.

Acceptance gate: exactly `docs/prd/retail/07`'s acceptance criteria —
every report reconciles exactly against its source events; the daily
briefing runs on schedule and produces a factually correct summary for
7 consecutive days before being shown to a real owner; fraud/anomaly
alerts always name the specific threshold crossed.

## 3. Notes On Confidence

Same caveat as `BUILD_WORKFLOW_HOTEL.md` section 3: this sequence is
mechanically derived from each `docs/prd/retail/*.md`'s own stated
Dependencies and Acceptance Criteria, which is low-risk, but the R3/R6
ordering judgment calls above are exactly that — judgment calls, flagged
explicitly rather than presented as the one correct order. Revisit if
implementation reveals a cleaner boundary, particularly R3's position
relative to R2.
