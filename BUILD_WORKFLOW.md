# AI Build Workflow — Restaurant OS

This is the execution playbook for coding the Restaurant OS to a fully
production-ready state: POS, table service, QR table ordering, kitchen
display, payments, offline sync, Kenya tax compliance (eTIMS), Shopify,
WooCommerce, delivery platform integrations, and a public developer
platform (API, OAuth apps, webhooks, app marketplace).

[HOSPITALITY_OS_MASTER_PLAN.md](./HOSPITALITY_OS_MASTER_PLAN.md) defines
**what** to build. [DATA_MODEL.md](./DATA_MODEL.md) defines the **schema**.
This document defines **the order to build it in, who/what builds each
piece, and the acceptance gate before moving to the next piece**.

## 0. How To Use This Document

This is written to be handed to an AI coding agent (or a human developer)
one phase at a time.

Rules for executing a phase:

1. Read the phase's `Depends on` list. Do not start a phase until its
   dependencies are merged and passing their acceptance gate.
2. Work only inside the modules/files listed under `Build`. Respect the
   module boundary rule from the master plan section 26: a module owns its
   tables; other modules call its service functions, never its tables
   directly.
3. Every new table follows `DATA_MODEL.md` naming. Every new endpoint
   follows the response envelope and API principles from master plan
   section 12/26.
4. A phase is not done when the code compiles. It is done when its
   `Acceptance gate` passes.
5. Never jump ahead to a later phase to "borrow" a shortcut (e.g. do not
   wire a delivery platform webhook straight into `order_items` before the
   Order Engine phase exists). If a phase seems to need something from a
   later phase, that is a signal the phase order needs revisiting, not a
   reason to skip the boundary.
6. Commit at the end of each completed phase with a message naming the
   phase (`P3: menu and catalog module`), not mid-phase.

## 1. Build Hierarchy

```text
P0  Foundation infra                (Docker, env, CI)
P1  Shared domain + schema core     (org, location, staff, roles, devices, audit)
P2  Auth + permission engine        (PIN login, JWT, RBAC, approval requests)
P3  Menu + product catalog          (products, categories, modifiers, pricing)
P4  Floor plan + tables             (floor plans, tables, table state machine)
P5  Order engine core               (orders, order_items, order state machine)
P6  Kitchen (KDS)                   (stations, kitchen tickets, routing, bump)
P7  Payments core                   (cash, card, mobile money, split, refunds, tips)
P8  Shift + cash drawer             (shift lifecycle, drawer count, reconciliation)
P9  Receipts + notifications        (print, WhatsApp, SMS, email, PDF)
P10 Table ordering (QR)             (customer-web, table sessions, cart, submit)
P11 Offline sync                    (PowerSync download, operation-log upload API)
P12 Inventory + recipes             (stock, recipes, purchase orders, wastage)
P13 CRM + loyalty                   (customers, loyalty, gift cards, credit tabs)
P14 Reports + BI dashboards         (owner/manager/kitchen/customer dashboards)
P15 Commerce integrations           (Shopify, WooCommerce)
P16 Delivery integrations           (Uber Eats, Glovo, Bolt Food)
P17 AI/ML service                   (forecasting, briefings, anomaly, recommendations)
P18 Hardening + launch              (security review, load test, backups, DR)
P19 Developer platform              (public API, OAuth apps, webhooks, marketplace, SDKs)
```

Dependency graph in plain terms:

- Everything depends on **P1** (nothing has a tenant without organizations,
  locations, staff, roles).
- **P2** must exist before any endpoint outside `/health` is real, because
  every mutation requires auth + tenant + permission check.
- **P5 Order engine** is the center of gravity. P6 (kitchen), P7 (payments),
  P10 (QR ordering), P15 (commerce), and P16 (delivery) all create orders
  or order items — they are channels into P5, not replacements for it.
- **P11 Offline sync** can start its device-side schema early but its
  server-side conflict resolution depends on P5 and P7 being stable, since
  it syncs orders and payments.
- **P15/P16 integrations** depend on P3 (catalog, for menu push) and P5
  (orders, for order intake). They are additive channels, built last among
  the core commerce phases on purpose — an unstable order engine makes
  every external integration flaky.
- **P17 AI/ML** depends on there being real transactional data to model
  (P5, P7, P12, P13), so it is deliberately late.
- **P19 Developer platform** depends on P2 (auth, extended outward with
  API keys/OAuth), P3/P5/P7/P12/P13 (every resource the public API and
  webhooks expose), and benefits from P15/P16 already existing since the
  same adapter pattern is reused. It is last on purpose: a public API is a
  stability promise to external developers, and nothing before P18 has a
  frozen-enough contract to promise.

## 2. Phase-By-Phase Workflow

Each phase below lists: goal, dependencies, what to build, key endpoints,
and the acceptance gate that must pass before starting the next phase.

### P0 — Foundation Infra

Depends on: nothing.

Build:

- `pnpm install`, verify workspace resolves.
- `docker compose up -d` for postgres, redis, meilisearch.
- `apps/api` boots and `/health` returns 200.
- CI: typecheck + lint + test on every push (GitHub Actions or equivalent).

Acceptance gate: fresh clone → `pnpm install && docker compose up -d && pnpm dev:api` → `/health` returns 200 in under 5 minutes, no manual steps.

### P1 — Shared Domain + Schema Core

Depends on: P0.

Build (`packages/database/src/schema/shared`, `packages/domain`):

- Tables: `organizations`, `businesses`, `locations`, `users`, `staff`,
  `roles`, `permissions`, `role_permissions`, `staff_roles`, `devices`,
  `audit_logs`, `approval_requests`.
- Drizzle migrations for all of the above.
- Seed script: one demo organization, one location, one owner, one manager,
  one waiter, one cashier, one chef, default roles/permissions.
- `packages/domain`: Zod schemas + TypeScript types matching every table,
  exported for reuse by API and all frontends.

Acceptance gate: `pnpm db:migrate && pnpm db:seed` produces a queryable
tenant with staff who have roles and permissions. No table lacks
`organization_id`.

### P2 — Auth + Permission Engine

Depends on: P1.

Build (`apps/api/src/core/auth`, `core/permissions`, `core/tenant`):

- `POST /auth/pin` — staff PIN login scoped to a device + location.
- `POST /auth/login` — email/password for owner/manager web.
- `POST /auth/refresh`, `POST /auth/logout`.
- `POST /auth/device/activate` — binds a physical device to a location.
- Tenant resolution middleware: every authenticated request carries
  `organization_id` + `location_id` in request context.
- Permission middleware: declarative `requirePermission('orders:void_item')`
  guard, checked against `role_permissions` for the acting staff member.
- Approval-request flow: when a staff member lacks a permission but the
  action supports manager override, create an `approval_requests` row and
  return `202` with a pending approval id instead of `403`; a manager
  action resolves it.

Acceptance gate: a waiter token cannot call a manager-only endpoint (403
with `permission_denied`); a waiter action that supports override creates
an approval request a manager can approve, after which the original action
completes. Every rejected and every approved action has an audit log row.

### P3 — Menu + Product Catalog

Depends on: P1, P2.

Build (`apps/api/src/modules/products`):

- Tables: `menus`, `menu_categories`, `products`, `modifier_groups`,
  `modifiers`.
- `GET/POST /products`, `PATCH /products/:id`,
  `POST /products/:id/mark-unavailable`, `POST /products/:id/mark-available`.
- Category → default KDS station mapping (used by P6).
- Price book support: base price + currency, staff-meal price, happy-hour
  price as overlays, not separate product rows.
- Postgres full-text search (`pg_trgm` trigram index) on product
  create/update (name, local name, SKU) — Meilisearch is not introduced
  at this phase; see `docs/adr/0001-tech-stack.md` decision 8. Swapping
  in Meilisearch later is an index-sync addition, not a schema change,
  so this phase doesn't need to anticipate it.

Acceptance gate: manager-web can create a category, a product with two
modifier groups, mark it unavailable, and search finds it by local-language
name within 200ms.

### P4 — Floor Plan + Tables

Depends on: P1, P2, P3.

Build (`apps/api/src/modules/restaurant`):

- Tables: `floor_plans`, `restaurant_tables`.
- Table state machine exactly as in master plan section 23: `available →
  seated → ordered → food_ready → eating → bill_requested →
  payment_pending → paid → cleaning → reserved/blocked`.
- `GET/POST /floor-plans`, `GET /tables`, `PATCH /tables/:id/status`.
- Table merge, split, transfer operations.

Acceptance gate: waiter app can render a floor plan, tap an available
table, and the table transitions state correctly; illegal transitions
(e.g. `available → paid`) are rejected with a domain error, not a 500.

### P5 — Order Engine Core

Depends on: P1–P4.

This is the highest-leverage phase. Build it conservatively and test it
hard — every later channel (QR, Shopify, delivery apps) is a producer into
this engine.

Build (`apps/api/src/modules/orders`):

- Tables: `orders`, `order_items`, `order_item_modifiers`, `bills`,
  `bill_items`.
- Order state machine from master plan section 23 (`draft → open →
  sent_to_kitchen → partially_ready → ready → served → bill_requested →
  payment_pending → paid → voided/refunded`).
- Order item state machine (`draft → sent → accepted → in_progress → ready
  → served → void_requested → voided/comped`).
- `orders.channel` enum, extendable, seeded with:
  `pos`, `qr_table`, `kiosk`, `whatsapp`, `online`, `shopify`,
  `woocommerce`, `uber_eats`, `glovo`, `bolt_food`.
- `POST /orders`, `GET /orders/:id`, `POST /orders/:id/items`,
  `PATCH /orders/:id/items/:item_id`, `POST /orders/:id/send`,
  `POST /orders/:id/split`, `POST /orders/:id/void`,
  `POST /orders/:id/close`.
- Discount/comp/void/refund rules exactly as master plan section 23:
  waiter can void own item pre-kitchen-send; post-send void requires
  manager approval via P2's approval flow; paid items require refund, not
  void.
- Price snapshot on every order item: capture product name, price, and
  tax rate at order time so later catalog price changes never alter a
  historical order.

Acceptance gate: full dine-in happy path from master plan section 23 runs
end to end against the real API (open table → add items → send → kitchen
sees items by station → serve → split bill → close) with correct state
transitions and an audit trail for every void/discount.

### P6 — Kitchen (KDS)

Depends on: P3, P5.

Build (`apps/kds-web`, `apps/api/src/modules/restaurant` extended):

- Tables: `kds_stations`, `kitchen_tickets`, `kitchen_ticket_items`.
- Routing: category default station, item-level override, one order can
  fan out into multiple station tickets, expo view combines them.
- `GET /kds/stations/:id/tickets`, `POST /kds/tickets/:id/bump`,
  actions: accept, start item, mark item ready, bump ticket, recall
  ticket, report delay, mark item unavailable (86).
- Ticket timers and the KDS metrics list from master plan section 23.
- Kitchen printer fallback path for when a KDS screen/device is offline.
- KDS intelligence per master plan section 7 Kitchen Features: learned
  cook-time-per-item-per-station (not a static estimate), a cross-station
  delay/rebalance alert, order consolidation so identical items across
  concurrent tickets batch into one cook pass, and rush/VIP visual
  differentiation on the ticket/expo view. Build these as a layer on top
  of the P6 ticket model, not a rewrite of it — they read ticket/item
  history, they do not change the state machine.
- Bar station extension: pour-cost tracking (poured vs. theoretical per
  recipe), tab transfer between bar staff, batch-close-all-tabs.

Acceptance gate: an order with items in two categories produces two
correct station tickets plus a combined expo ticket; bumping all items on
a ticket flips the parent order item states to `ready`; printer fallback
produces a legible physical ticket when the KDS device is simulated
offline; a repeated identical item across two concurrent tickets on the
same station shows as one consolidated cook instruction, not two.

### P7 — Payments Core

Depends on: P5.

Build (`apps/api/src/modules/payments`, `packages/integrations` payment
adapters):

- Tables: `payment_intents`, `payments`, `refunds`, `tips`.
- `POST /orders/:id/payments/cash`,
  `POST /orders/:id/payments/mobile-money`,
  `POST /orders/:id/payments/card`, `POST /payments/:id/refund`,
  `POST /payments/webhooks/:provider`.
- Idempotency key required on every payment-creating call.
- M-Pesa STK push adapter first (Kenya priority), Airtel Money second,
  card via a provider adapter (Stripe/Flutterwave/Paystack — integrate,
  do not build a processor).
- Split payment: multiple payments against one bill, sum must equal bill
  total before bill can close.
- Waiter payment permission model exactly as already agreed: waiters can
  take payment on their own tables; refunds, cancelling a confirmed
  payment, and reopening a paid order all require manager approval through
  the P2 approval flow.
- Bar tabs: open a tab against a card pre-authorization or a mobile-money
  deposit hold, accumulate charges against it, settle (capture) at close
  — per master plan section 7/Module 6 embedded-tab spec. Model as a
  `payment_intents` row in `authorized`/held state that charges/orders
  attach to, not a parallel ledger.
- Dual pricing / cash-card surcharging: a product's displayed price can
  carry a card surcharge percentage; the receipt shows both the cash and
  card price actually charged, per master plan section 7 Front Of House
  Features.
- Split-check WhatsApp payment links: `POST /orders/:id/split/:split_id/payment-link`
  generates a per-seat/per-split payment link delivered via WhatsApp
  (reuses the P9 messaging adapter), so each diner can pay their own share
  from their own phone without a shared device.
- Staff mobile-money fraud detection (master plan Module 18): every
  M-Pesa/mobile-money payment confirmation is checked against the
  business's registered till/paybill/phone numbers
  (`integration_connections` for the tenant's payment provider); a
  payment confirmed against an unregistered number raises an immediate
  manager alert instead of silently reconciling.

Acceptance gate: a bill can be paid by a single cash payment, by a
cash+mobile-money split summing to the total, and a webhook-confirmed
M-Pesa payment updates the payment row from `pending` to `paid` without
manual polling. A duplicate payment request with the same idempotency key
does not double-charge. A mobile-money payment confirmed against a number
outside the tenant's registered numbers raises a manager alert within the
same request cycle that records the payment, never silently.

### P8 — Shift + Cash Drawer

Depends on: P7.

Build (`apps/api/src/modules/finance` or `staff`, per module boundary
already declared in `PROJECT_STRUCTURE.md`):

- Tables: `shifts`, `cash_drawer_sessions`.
- Shift lifecycle: `draft → open → closing → closed → reconciled`.
- Shift close workflow exactly as master plan section 23: block close on
  open orders, pending payments, uncounted drawer, or unsynced offline
  financial events (unless manager override).
- Shift report: gross/net sales, tax, discounts, voids, refunds, cash
  expected vs counted vs variance, mobile money summary, tips, sales by
  staff.
- Denomination-aware cash handling (master plan Module 18): a change
  calculator that works in the local currency's actual note/coin
  denominations for every cash sale, plus a mid-shift alert if the same
  cashier makes 3+ change-calculation errors in one shift — in addition
  to the denomination-by-denomination count already required at shift
  close.

Acceptance gate: attempting to close a shift with an open order is
rejected with a specific error naming the blocking order; a clean shift
close produces a locked, immutable shift report and an audit event; a
cashier's third change error in one shift produces a manager-visible
alert before the shift closes, not only in the after-the-fact report.

### P9 — Receipts + Notifications

Depends on: P7, P8.

Build (`apps/api/src/modules/notifications`, `packages/integrations`
messaging and tax adapters):

- Tables: `receipts`.
- Receipt content exactly as master plan section 23 (business name, tax
  PIN, receipt/order number, staff, items, tax, payment method, tip,
  loyalty points, QR code where required).
- **KRA eTIMS compliance (Kenya launch market — master plan Module 18,
  treat as launch-blocking, not a follow-on task)**: every receipt for a
  Kenya tenant includes the business's KRA PIN, the ETR serial number, and
  a KRA-issued QR code; every completed sale is submitted to eTIMS in real
  time, or queued as a sync-tracked operation (same operation-log pattern
  as P11) and submitted the moment connectivity returns — never silently
  dropped; a daily Z-report is submitted automatically. Build the tax
  adapter behind the same `ChannelAdapter`-style interface as section 6 so
  Nigeria (FIRS) and South Africa (SARS) are additive later, not a
  rewrite.
- Delivery channels: thermal print (local network/Bluetooth/USB), WhatsApp
  (Business API), SMS, email, PDF download. WhatsApp and print both
  support the customer's or business's selected local language (master
  plan Module 18).
- BullMQ worker for async delivery with retry.

Acceptance gate: closing a paid order produces a receipt deliverable via
at least thermal-print-simulated output and WhatsApp; a failed WhatsApp
send retries and does not block the order from closing. For a Kenya
tenant, a closed order produces an eTIMS-compliant receipt (KRA PIN, ETR
serial, KRA QR code present) and the eTIMS submission is visible in a
`sent`/`queued`/`failed` state — a submission that fails or cannot reach
eTIMS is retried, never lost, and never blocks the receipt from reaching
the customer.

### P10 — Table Ordering (QR)

Depends on: P3, P4, P5, P7.

See section 3 below for the full technical workflow. This is a first-class
phase, not a variant of P5 — build it as a channel into the order engine.

Build (`apps/customer-web`, `apps/api/src/modules/orders` extended):

- Table QR token issuance and validation.
- Public, unauthenticated-but-scoped customer session against one table.
- Cart, submit, pay-now-or-later, request-waiter, feedback.
- Multi-phone shared basket: multiple table-session tokens can attach to
  the same open order; each session's added items are tagged with the
  originating session/seat so later per-seat bill splitting (section
  3.4) and per-session "pay only my items" both work off the same tag.
- "Fire next course": a guest-triggered action for multi-course orders
  that sends the next held course to the kitchen, distinct from the
  initial order submit — reuses `SendOrderToKitchen` scoped to one
  course's items, not a new command.
- Post-serve dish rating, written against the specific order item and fed
  to the AI review/sentiment feature (P17) and menu engineering (master
  plan section 7) in near-real-time, not batched into the next report
  cycle.

Acceptance gate: scanning a table's QR on a phone loads the live menu,
lets a customer build an order, submit it, and see it land in the same
kitchen ticket flow as a waiter-entered order, with the correct table and
`channel = qr_table`.

### P11 — Offline Sync

Depends on: P5, P7 stable in phases above (schema and state machines
frozen enough not to change weekly).

Build (`apps/pos-mobile`, `packages/offline-sync`,
`apps/api/src/modules/sync`):

- PowerSync sync rules for the download path — catalog, prices, tables,
  and settings streamed from Postgres to on-device SQLite. This replaces
  the previously-planned `GET /sync/pull?cursor=` endpoint; see
  `docs/adr/0001-tech-stack.md` decision 6 for exactly what PowerSync
  does and does not cover.
- Device-side SQLite schema mirroring the cached tables listed in master
  plan section 27 (PowerSync-managed).
- Operation log format exactly as specified (`op_id`, tenant, location,
  device, actor, entity, operation, payload, `base_version`) for the
  upload path — this stays fully custom.
- `POST /sync/push` (idempotent, ordered, returns local→server id mapping
  and conflicts), called from PowerSync's client-side upload-queue
  handler.
- Conflict policy exactly as master plan section 27: append-only merge for
  order items, stock movements not raw overwrites, server wins for product
  config, phone-based customer merge, cash payments sync offline while
  mobile money/card require online confirmation.
- Load-shedding detection/UX (master plan Module 18): battery discharge
  rate (and mains-power-loss signal where the terminal exposes one)
  drives a persistent "on battery, ~X min remaining" banner, automatic
  screen dim, and non-essential feature disable (dashboards, non-urgent
  sync) — a UX layer on top of the offline-sync engine above, not a
  separate offline mode. Also wire automatic mobile-hotspot failover when
  the primary router's connectivity drops, distinct from a device's own
  battery state.
- eTIMS submissions (P9) queue through this same operation log when
  offline — they are sync-tracked operations, not fire-and-forget calls,
  so a Kenya tenant never loses a tax submission to a dropped connection.

Acceptance gate: a device taken fully offline can open a table, take a
full cash-paying dine-in order, and reconcile cleanly once reconnected,
with no duplicate orders or payments and a correct shift report. A device
simulated on low battery shows the remaining-time banner and disables
non-essential features without interrupting an in-progress sale.

### P12 — Inventory + Recipes

Depends on: P3, P5 (recipe deduction happens on order item state
transitions).

Build (`apps/api/src/modules/inventory`):

- Tables: `suppliers`, `inventory_items`, `stock_locations`,
  `stock_levels`, `stock_movements`, `purchase_orders`,
  `purchase_order_items`, `goods_receipts`, `stock_counts`,
  `stock_adjustments`, `recipes`, `recipe_ingredients`, `wastage_events`.
- Every stock change is a `stock_movements` row; `stock_levels` is a
  materialized projection, never written directly.
- Recipe deduction fires when an order item reaches `served` (or `paid`,
  pick one and document it) — not on order creation, to avoid deducting
  stock for items later voided pre-kitchen.
- Informal-sector mode (master plan Module 18): no-barcode item entry
  (photo + name + price in place of a SKU lookup) and bulk/loose selling
  priced by weight, both as alternate input paths onto the same
  `inventory_items`/`products` tables, not a parallel catalog.
- Supplier credit reminders: a due-schedule per `purchase_orders`/supplier
  balance with a WhatsApp reminder sent ahead of the due date (P9
  messaging adapter), extending the existing `supplier credit` bullet with
  a concrete schedule/notification mechanic.

Acceptance gate: selling a product with a recipe deducts the correct
ingredient quantities; a stock count that disagrees with system stock
creates a variance requiring approval, never a silent overwrite.

### P13 — CRM + Loyalty

Depends on: P5, P7.

Build (`apps/api/src/modules/crm`):

- Tables: `customers`, `customer_identities`, `customer_tags`,
  `loyalty_accounts`, `loyalty_events`, `gift_cards`,
  `customer_credit_accounts`, `customer_feedback`.
- Phone number as primary identity merge key across POS, QR ordering,
  WhatsApp, and later Shopify/WooCommerce/delivery channels.
- Loyalty point accrual and redemption as append-only ledger events, never
  a mutable balance column alone.
- Customer credit tab ("Oweame") mechanics (master plan Module 18):
  per-customer credit limit set by a manager (approval-gated increases via
  P2), automatic WhatsApp statement on the 1st of each month, and a
  credit-risk flag on any balance outstanding more than 30 days.
- Chama/SACCO auto-routing: a configurable percentage of daily net profit
  routed to a linked savings account, built as another `payments`-adjacent
  scheduled transfer, not a new ledger type.
- Review/sentiment monitoring: ingest Google/delivery-platform reviews and
  QR dish ratings (P10), alert on a new negative review, and surface
  trending complaints — feeds `customer_feedback` and the AI daily
  briefing (P17).

Acceptance gate: the same phone number ordering once at the counter and
once via QR resolves to one customer profile with combined order history
and one loyalty balance. A customer with a credit balance over 30 days old
shows the credit-risk flag on their profile without a manual query.

### P14 — Reports + BI Dashboards

Depends on: P5, P7, P8, P12, P13.

Build (`apps/manager-web`, `apps/owner-web`, `apps/kds-web` dashboards,
`apps/api/src/modules/reports`):

- Tables: `events`, `report_snapshots`, `daily_location_metrics`,
  `product_sales_metrics`, `staff_performance_metrics`.
- Full report list from master plan section 23 (sales, operations,
  inventory, staff, customer, finance).
- `GET /reports/sales`, `/reports/payments`, `/reports/inventory`,
  `/reports/staff`, `/reports/audit`, `POST /reports/:id/export`.
- Competitive benchmarking (master plan section 7): anonymized peer
  aggregation by city/category/price-tier, hard-enforced minimum-10-tenant
  group size before any benchmark is shown, positive-framing copy layer.
- Real-time shift P&L view (revenue/labor-cost/food-cost/gross-profit
  mid-service), distinct from the after-the-close shift report in P8.
- Dashboards follow the BI Dashboard Design System (master plan section
  30): Three Questions test, One Number Principle, fixed color semantics,
  skeleton-not-spinner loading, and an always-visible 3-state
  online/syncing/offline indicator.
- Automated report cadence and two-way WhatsApp command interface
  (`SALES`, `STOCK`, `STAFF`, `VOID`, `ORDER`, `QUERY`, `OK`, `STOP`,
  `HELP`) exactly as master plan section 31 — real-time event-triggered,
  daily 30 minutes after close, weekly Sunday 7 PM, monthly on the 1st;
  PDF generation via headless-Chrome rendering off the same report data
  the dashboards use.

Acceptance gate: owner dashboard shows live revenue, branch comparison,
and a correct shift-level cash/mobile-money reconciliation that matches
P8's shift report to the cent. Replying `SALES` to the business's
WhatsApp number returns today's sales summary within seconds, and a peer
benchmark only renders once the peer group has at least 10 tenants.

### P15 — Commerce Integrations: Shopify + WooCommerce

Depends on: P3, P5, P7, P9 (receipts/notifications reused for order
confirmations).

Full technical spec in section 4 below.

Acceptance gate: a product created in the POS catalog appears in the
connected Shopify/WooCommerce store within the configured sync interval;
an order placed on the Shopify/WooCommerce storefront appears as a real
order in the same order engine, routes to the kitchen if it contains
kitchen items, and its payment status reconciles against the
storefront's own payment record.

### P16 — Delivery Platform Integrations

Depends on: P3, P5, P6, P7.

Full technical spec in section 5 below.

Acceptance gate: an order placed on a connected delivery platform arrives
as a kitchen ticket within seconds, status updates (accepted, preparing,
ready for pickup) push back to the platform, and the commission/payout
figures reconcile against the platform's settlement report.

### P17 — AI/ML Service

Depends on: enough real transactional volume from P5/P7/P12/P13 to train
or meaningfully baseline models (can start on seed/synthetic data, but
gate to production on real data).

Build (`services/ai-ml`): forecasting, churn, menu engineering, anomaly
detection, recommendations, and daily briefings exactly as cataloged in
master plan section 14/7, plus the concrete additions below that make
these models Africa-specific rather than generic:

- Feature engineering for revenue/demand forecasting includes
  `days_after_payday`, `is_school_term`, `is_rainy_season`, local
  market-day flags, and Ramadan/Iftar calendar effects, not just day-of-
  week/holiday/weather (master plan section 7 Restaurant ML Models).
  Fall back to a simple moving average for any location with under 14
  days of history.
- Stockout prediction outputs a tiered alert (Critical/Warning/
  Planned/Watch), consolidated to a maximum of 3 stock alerts per merchant
  per day.
- Anomaly detection is threshold-driven and explainable: sales drop ≥40%
  vs. the same weekday's 4-week average, food-cost spike ≥8% above
  baseline, staff void rate ≥3x location average (or >5% of that staff
  member's revenue), cash variance over a configured amount, transaction
  ≥5x the location's average order value — every anomaly alert names the
  specific threshold crossed.
- Waste/prep-hold intelligence: predict sell-through of a prepped batch
  pre-service and recommend a hold-back quantity.
- Supplier invoice OCR: photograph a paper invoice, extract line
  items/prices, flag any price that changed vs. the same supplier's last
  invoice.
- Organize as task-specific agents (promotions, pricing, scheduling,
  waste, staff coaching, daily digest) each producing structured output
  for the briefing/notification layer, per master plan section 7 — not one
  general-purpose prompt handling every request.
- Competitive benchmarking model: percentile rank of this location against
  its anonymized peer group (min. 10 tenants) on average ticket, table
  turnover, revenue per seat, food cost %, and attach rate.

Acceptance gate: daily briefing generation runs on a schedule and produces
a factually correct summary (spot-checked against the same day's reports
from P14) for at least 7 consecutive days before being shown to a real
owner. A stockout-risk day produces at most 3 consolidated alerts, never
one alert per at-risk item; an anomaly alert always names the threshold it
crossed.

### P18 — Hardening + Launch

Depends on: everything above.

- Security review (permission bypass attempts, tenant isolation fuzzing,
  webhook signature verification, secrets audit).
- Load test the order engine and payment webhooks at target transaction
  volume.
- Backup/restore drill for PostgreSQL.
- Disaster recovery runbook: device loss, API outage, payment provider
  outage, delivery platform outage.
- Staff training materials for waiter, cashier, manager, kitchen roles.

Acceptance gate: a full outage-and-recovery drill (kill the API, kill
Postgres, restore from backup) completes with zero data loss on already
confirmed payments, and offline devices resync cleanly afterward.

### P19 — Developer Platform

Depends on: P2 (auth, extended outward), P3, P5, P7, P12, P13 (every
resource the public API/webhooks expose), P18 (a public contract needs a
stable system behind it).

Full technical spec in section 7 below.

Build (`apps/api/src/modules/developer-platform`, new `apps/developer-portal`):

- Tables: `developer_apps`, `api_keys`, `oauth_grants`, `oauth_tokens`,
  `webhook_subscriptions`, `webhook_deliveries`, `api_usage_logs`,
  `marketplace_listings`, `marketplace_installs`.
- `/api/v1/...` public resource surface (orders, products, customers,
  inventory levels, payments, reports) behind API-key and OAuth 2.0 auth,
  scope-checked per master plan Module 17.
- `POST/GET/DELETE /api/v1/webhooks` developer-facing subscription
  registry, HMAC-SHA256 signed outbound delivery, retry with backoff.
- Rate limiting (60 req/min standard, 600 req/min bulk-sync tier) and
  mandatory `Idempotency-Key` on every write.
- Sandbox mode: per-app test tenant, `sk_test_`/`sk_live_` key prefixing,
  "send test event" per webhook subscription.
- Developer portal: OpenAPI-generated docs, app registration console,
  per-app usage analytics, Postman collection, JS/TS and Python SDKs
  generated from the same OpenAPI spec.
- App marketplace: install/uninstall flow, scope review at install,
  revenue-share billing hook, app review/approval workflow before public
  listing.

Acceptance gate: a third-party test app can register, request scopes, get
a merchant's OAuth grant in sandbox, create a test order via
`/api/v1/orders`, and receive a signed `order.created` webhook for it —
end to end, without any core-team code change. Revoking an API key fails
every subsequent call from that key immediately. A key/token from one
tenant can never read or write another tenant's data (fuzz-tested, same
bar as P18's tenant-isolation gate).

## 3. Table Ordering (QR) — Full Technical Workflow

This is what "customer can scan and order without waiting for the waiter"
means end to end.

### 3.1 QR Token Model

- Each `restaurant_tables` row has a durable `qr_slug` (stable, printed
  once) and the QR image encodes a URL:
  `https://order.<tenant-domain>/t/<qr_slug>`.
- The slug is not a session — scanning it starts a new session server-side.
  This means a lost/stolen printed QR never leaks an active order.
- On scan, `apps/customer-web` calls
  `POST /public/table-sessions { qr_slug }`. The API validates the table
  belongs to an open, non-blocked location and table, and returns a
  short-lived signed `table_session_token` (JWT, scoped to
  `organization_id + location_id + table_id`, ~2 hour expiry, refreshable
  while the table is occupied).
- All subsequent public endpoints require this token and are rate-limited
  per token to prevent abuse.

### 3.2 Customer Flow

```text
Customer scans table QR
Customer-web requests a table session
Customer-web loads menu (categories, products, modifiers, availability,
  local-language names, photos)
Customer builds cart (items + modifiers + notes)
Customer optionally joins loyalty (phone number)
Customer submits order
API creates or appends to the table's open order with channel=qr_table
API creates kitchen tickets exactly as a waiter-entered order would
Customer sees live order status (received, in kitchen, ready, served)
Customer requests waiter (creates a low-priority staff notification)
Customer requests bill
Customer pays now (mobile money / card) or marks pay-with-waiter
Customer leaves feedback after payment
```

### 3.3 API Surface (public, table-session-scoped)

- `POST /public/table-sessions`
- `GET /public/table-sessions/:token/menu`
- `POST /public/table-sessions/:token/orders` (creates/appends order items)
- `GET /public/table-sessions/:token/order` (poll or SSE/WebSocket for
  live status)
- `POST /public/table-sessions/:token/request-waiter`
- `POST /public/table-sessions/:token/payments/mobile-money`
- `POST /public/table-sessions/:token/feedback`

Internally these call the exact same `orders` module commands as the
waiter app (`CreateOrder`, `AddOrderItem`, `SendOrderToKitchen`,
`TakePayment`) — the QR flow is a thin, permission-restricted client of
P5/P7, not a parallel implementation. This is why P10 depends on P5 and P7
being complete, not the other way around.

### 3.4 Guardrails Specific To QR Ordering

- A customer session can only add items, never void, discount, comp, or
  modify another guest's items at the same table — those remain
  staff-only actions gated by P2.
- If two customers at the same table submit simultaneously, both append to
  the same open order; item ownership (which seat/device added it) is
  recorded for later bill-splitting by seat.
- Items marked unavailable/86ed by the kitchen disappear from the QR menu
  in near-real-time (same event that updates KDS availability).
- If the customer device goes offline mid-session, the cart persists
  client-side and resubmits when connectivity returns; it never silently
  drops items.
- Pay-now via QR still produces a normal `payments` row and receipt
  through P7/P9 — no separate payment ledger.

## 4. Commerce Integrations: Shopify + WooCommerce

These exist for businesses that also run (or want to run) an online store
for retail/merch/packaged-goods sales alongside the restaurant, and for
multi-location brands that already have a Shopify/WooCommerce presence
before adopting this POS. Build both behind one shared interface (section
6) so a third platform can be added later without rework.

### 4.1 Direction Of Truth

- **Catalog**: POS catalog (P3) is the source of truth. Products created
  or updated in the POS push to the connected store. Do not build
  bidirectional catalog sync for v1 — it invites conflicting price/name
  edits. If the tenant insists on managing products in Shopify/WooCommerce
  instead, that is a config flag that flips the push direction, not a
  live two-way merge.
- **Orders**: the storefront is the source of truth for orders it
  originates. Every storefront order is pulled/pushed into the P5 order
  engine as a new order with the appropriate `channel`. The POS never
  writes orders back to the storefront except to update fulfillment/paid
  status.
- **Inventory**: stock movements from P12 push level updates outward
  (decrement on storefront sale is received inbound; decrement on
  in-store sale is pushed outbound). Treat this as eventually consistent,
  not transactional — a brief oversell window is acceptable for v1,
  reconciled by a periodic full-sync job.

### 4.2 Shopify

- Build as a Shopify Partner app (custom app is fine for single-tenant
  pilots; public app only if this becomes a listed integration).
- Auth: OAuth install flow per tenant, store access token encrypted in
  `integration_connections` (section 6).
- Outbound (POS → Shopify): Admin GraphQL API to create/update products,
  variants, and inventory levels.
- Inbound (Shopify → POS): register webhooks for `orders/create`,
  `orders/updated`, `orders/cancelled`, `products/update`,
  `inventory_levels/update`. Verify HMAC signature on every webhook before
  processing.
- Order mapping: `orders/create` payload → `CreateOrder` command with
  `channel = 'shopify'`, `external_reference = shopify_order_id`, line
  items mapped through `channel_product_mappings`.

### 4.3 WooCommerce

- Auth: REST API consumer key/secret generated by the store owner in
  WordPress admin, entered once per tenant, encrypted in
  `integration_connections`.
- Outbound: WooCommerce REST API (`/wp-json/wc/v3/products`) for
  catalog/inventory push.
- Inbound: WooCommerce webhooks (`order.created`, `order.updated`,
  `product.updated`) posted to a tenant-specific webhook URL; verify the
  `X-WC-Webhook-Signature` HMAC before processing.
- Same order/product mapping approach as Shopify, same target commands.

### 4.4 New Schema For Section 4/5

Add to `DATA_MODEL.md` under a new "Integrations" section when this phase
starts:

- `integration_connections` — one row per tenant per external system
  (`provider`, encrypted credentials, status, last_synced_at).
- `channel_product_mappings` — `internal_product_id` ↔
  `external_product_id`/`external_variant_id`.
- `channel_order_mappings` — `internal_order_id` ↔ `external_order_id`.
- `channel_sync_logs` — append-only log of every push/pull attempt,
  success/failure, and payload hash, used for debugging and for the admin
  console's "integration health" view.

## 5. Delivery Platform Integrations

Priority order for the East Africa/Kenya-first market: **Glovo, Bolt
Food, Uber Eats**. Build Glovo or Bolt Food first (whichever
has better partner-API access in the target city), then generalize.

### 5.1 Why This Is Late On Purpose

Every delivery platform integration is a webhook producer into the order
engine plus a status-update consumer back out. If P5/P6/P7 are not fully
stable, every delivery-platform bug looks like an order-engine bug and
debugging becomes ambiguous. Building this after P5–P9 are proven with
real dine-in/counter traffic means the order engine is already trusted
when delivery orders start landing in it.

### 5.2 Flow

```text
Menu is pushed to the delivery platform (products, prices, availability,
  photos) via that platform's menu/catalog API
Customer orders on the delivery platform's own app — not ours
Delivery platform sends an order webhook to our API
API verifies signature, maps external items to internal products via
  channel_product_mappings, creates an order with
  channel=<platform>, external_reference=<platform order id>
Order routes to kitchen exactly like any other order (P6)
Kitchen bumps items as normal
API pushes status updates back to the platform (accepted, preparing,
  ready for pickup/courier assigned, picked up) via that platform's
  order-status API
Platform handles courier dispatch — not our responsibility
Payment: platform-collected orders settle via the platform's own payout,
  not our payment module; record them as a payments row with
  method=platform_settlement and provider=<platform> so shift/day
  reports still balance, reconciled against the platform's payout report
  rather than confirmed in real time
```

### 5.3 Guardrails

- If a delivery platform pushes an item no longer available (an 86'd
  item, a sync lag), auto-reject that specific line via the platform's
  API and notify the manager — never silently substitute.
- If the API cannot reach the platform to push a status update, retry
  with backoff via BullMQ; do not block the kitchen workflow on the
  external call succeeding.
- Menu push failures must surface in the admin console's integration
  health view (`channel_sync_logs`), not fail silently — a stale delivery
  menu selling an unavailable or wrongly priced item is a direct revenue
  and reputation risk.
- Commission/payout reconciliation is a report (P14 extension), not a
  blocker to closing a shift — delivery platform settlement typically
  lags by days.
- During a rush window (configurable per location), throttle incoming
  delivery orders per platform rather than accepting an unbounded queue
  the kitchen cannot physically fulfil — reject/pause new platform orders
  past the configured per-15-minute cap and surface this as a deliberate
  manager-visible state, not a silent kitchen backlog.

### 5.4 Platform-Specific Notes

- **Uber Eats**: use the Direct or Marketplace API depending on courier
  model (their own couriers vs. restaurant's own delivery); order webhook
  + status-update endpoints are both documented in their Partner API.
- **Glovo**: Partner API is menu + order webhook based; commonly used by
  aggregators across Africa/Europe; verify current partner-onboarding
  requirements before building, as access is partner-gated, not
  self-serve.
- **Bolt Food**: similar Partner API shape to Glovo; strong presence in
  Kenya/East Africa, good second or first target after Glovo.

Treat all three behind the one adapter interface in section 6 so adding or
dropping a platform is a config + adapter change, not an order-engine
change.

## 6. Integration Module Pattern

All of P15 and P16 (and future integrations — accounting, tax, hardware)
live in `packages/integrations`, already scaffolded with categories
`payments`, `messaging`, `accounting`, `delivery`, `hospitality_channels`,
`commerce`, `tax`, `hardware`. Every adapter in every category implements
the same shape so the API layer never special-cases a provider:

```text
interface ChannelAdapter {
  connect(tenantId, credentials): Promise<ConnectionResult>
  pushCatalog(tenantId): Promise<SyncResult>       // commerce/delivery only
  pushInventory(tenantId, deltas): Promise<SyncResult>
  handleWebhook(tenantId, rawPayload, signature): Promise<WebhookResult>
  pushOrderStatus(tenantId, orderId, status): Promise<SyncResult>  // delivery only
  healthCheck(tenantId): Promise<HealthResult>
}
```

Rules:

- Credentials are always encrypted at rest (`integration_connections`),
  never logged, never returned in API responses after initial save.
- Every inbound webhook is signature-verified before any domain command
  runs.
- Every adapter call writes a `channel_sync_logs` row, success or
  failure — this is what powers the admin console's integration health
  view and what you will need when a restaurant owner asks "why didn't my
  Glovo order show up."
- An adapter never writes directly to `orders`/`products`/`stock_levels`.
  It calls the same P3/P5/P7/P12 module commands every other channel
  uses. This is the module boundary rule applied to external systems, not
  just internal ones.

## 7. Developer Platform — Full Technical Workflow

Full feature spec lives in master plan Module 17. This section is the
concrete build sequence and request flow, matching the level of detail
sections 3-5 give QR ordering and the commerce/delivery integrations.

### 7.1 Auth Flows

```text
API key (server-to-server):
  Merchant generates a key in the owner dashboard
  Key is scoped at creation (subset of the full scope list)
  Every request: `Authorization: Bearer <key>` -> resolves to one
    organization_id + its granted scopes
  Merchant can revoke at any time; revocation takes effect on the next
    request, not on a cache TTL

OAuth 2.0 (installed marketplace app):
  Developer registers an app, sets requested scopes + redirect URL
  Merchant clicks "install" from the marketplace
  Standard authorization-code redirect: merchant approves the exact
    scopes shown -> code -> app exchanges code for access + refresh token
  Access token is short-lived; app refreshes silently
  Merchant can uninstall from their dashboard at any time, which revokes
    every token issued to that app for that tenant immediately
```

### 7.2 Request Flow (Any `/api/v1` Write)

```text
Request arrives with Authorization header + Idempotency-Key
Middleware resolves token -> organization_id + granted scopes
Requested operation checked against granted scopes (403 scope_denied
  if missing, same error shape as internal permission_denied)
Idempotency-Key checked against api_usage_logs; a repeat returns the
  original result, does not re-run the effect
Rate limiter checks the token's tier bucket; 429 with Retry-After if
  exceeded
Request maps to the exact same module command an internal client would
  call (CreateOrder, AddOrderItem, UpdateProduct, ...) — the public API
  is a thin, scope-restricted client of P3/P5/P7/P12/P13, never a
  parallel write path
Response uses the standard envelope (section 26 of the master plan)
api_usage_logs row written (endpoint, token, latency, status)
```

### 7.3 Webhook Delivery Flow

```text
Domain event fires internally (order.created, payment.completed, ...)
Event bus (Module 16) fans out to: internal listeners (KDS, reports) AND
  any webhook_subscriptions matching this tenant + event type
For each matching subscription:
  Build payload, sign it (HMAC-SHA256, subscription's secret)
  POST to the subscriber's URL with signature header
  2xx within 30s -> record success in webhook_deliveries
  Non-2xx or timeout -> retry with exponential backoff (bounded attempts)
  Repeated consistent failure -> auto-pause the subscription, notify the
    developer in the portal (never fail silently forever)
```

### 7.4 Guardrails Specific To The Developer Platform

- A scope grant is never implicit. An app with `orders:read` cannot call
  any `orders:write` endpoint even if the merchant also granted that
  scope to a different app.
- Sandbox and production are hard-separated at the data layer — a sandbox
  token cannot resolve to a production `organization_id` under any
  request path.
- Every credential (API key secret, OAuth client secret, webhook signing
  secret) is stored encrypted at rest and shown in full exactly once, at
  creation time; every later view is masked.
- Public API and webhook contracts follow the same "we own P3/P5/P7
  module boundary" rule as section 6: the developer platform calls
  existing module commands, it does not grow its own write path into
  `orders`/`products`/`stock_levels`.

## 8. Agent Operating Rules

If an AI coding agent is executing this playbook autonomously across
multiple sessions:

- Start every session by reading `TODO.md` and this file's phase list to
  confirm which phase is current.
- Do not mark a phase's TODO items done until its acceptance gate passes
  against a real running stack (`docker compose up -d`, real Postgres),
  not just unit tests with mocked dependencies.
- When a phase's acceptance gate fails, fix within that phase before
  advancing — do not carry a broken gate forward "to fix later."
- Update `TODO.md` and `DATA_MODEL.md` as each phase lands so they stay
  the living index; this file stays the stable playbook and should only
  change when the build order itself changes.
- If a requirement surfaces that does not fit an existing phase (e.g. a
  new payment method, a new delivery platform), add it to the relevant
  existing phase's `Build` list rather than inventing a new phase — most
  net-new work is additive within P7/P15/P16, not a new layer.

## 9. Definition Of "Fully Production Ready"

Not done until all of the following are true, not just P0–P19 checked off:

- Multi-tenant isolation is fuzz-tested: no query path can return another
  organization's data given a valid token for a different tenant,
  including third-party API keys and OAuth tokens issued through P19.
- Every Kenya-market tenant's closed orders produce a valid eTIMS
  submission (or a visibly queued/retried one, never a silently dropped
  one) — this is launch-blocking for the Kenya market, not a
  nice-to-have.
- Peer-benchmark and any cross-tenant aggregate feature enforces the
  minimum-10-tenant privacy threshold in every environment, not only in
  the reference implementation.
- Every money-moving endpoint is idempotent and has been tested against
  duplicate/replayed requests.
- Offline dine-in and counter-service both survive a full device outage
  and resync losslessly.
- Shift reports balance to the cent against payment provider statements
  for at least one full real trading week.
- Delivery and commerce integrations degrade gracefully (queued retries,
  visible health status) rather than silently failing.
- Backups are automated, restore has been drilled, and RPO/RTO are
  written down.
- Staff-facing permission model has been walked through with a real
  waiter/cashier/manager, not just tested by the engineering team.
- Support tooling (`apps/admin-web`) can answer "why did this order/
  payment/sync fail" without a database console session.
