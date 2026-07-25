# TODO

This TODO follows the new master plan. Restaurant OS comes first.

Read `ENGINEERING_CHARTER.md` and `docs/adr/0001-tech-stack.md` before
starting Phase 0 — the backend framework, mobile workflow, and offline
sync engine all changed from what earlier scaffolding may assume.

## Phase 0: Foundation

- [x] Migrate `apps/api` scaffold from Fastify to NestJS (ADR 0001) —
      done 2026-07-20
- [x] Move `apps/pos-mobile` off managed Expo Go to bare/dev-client
      workflow (ADR 0001) — done 2026-07-20
- [x] Move `apps/customer-web` and `apps/developer-portal` off Next.js to
      React + Vite (ADR 0001) — done 2026-07-20
- [x] Scaffold `apps/marketing-web` (Astro) — done 2026-07-20
- [x] Install dependencies with `pnpm install` — done 2026-07-20
- [x] Start local infra with `docker compose up -d` — done 2026-07-20
- [x] Confirm API health endpoint works — done 2026-07-20
- [x] Create Drizzle schema for shared foundation — done 2026-07-20
- [x] Add database migrations — done 2026-07-20
- [x] Add Postgres Row-Level Security policy — done 2026-07-20
- [x] Add tenant context middleware — done 2026-07-20
- [x] Add auth and PIN login — done 2026-07-20
- [x] Add permission checks — done 2026-07-20
- [x] Add audit log writer — done 2026-07-20
- [x] Add seed data for one restaurant — done 2026-07-20
- [x] Close the P2 gap — done 2026-07-20

## Phase 1: Restaurant MVP

- [x] Products and categories — done 2026-07-20 (P3)
- [x] Menu modifiers — done 2026-07-20 (P3)
- [x] Floor plans and tables — done 2026-07-20 (P4)
- [x] Orders and order items — done 2026-07-20 (P5)
- [x] Kitchen tickets — done 2026-07-22 (P6)
- [x] Cash payments — done 2026-07-22 (P7)
- [x] M-Pesa payment intent flow — done 2026-07-22 (P7)
- [x] KRA eTIMS receipt compliance — done 2026-07-23 (P9)
- [x] Receipts — done 2026-07-23 (P9)
- [x] Shift open and close — done 2026-07-22 (P8)
- [x] Basic sales report — done 2026-07-22 (P8)
- [x] POS local SQLite schema — done 2026-07-23
- [x] PowerSync project setup and sync rules — done 2026-07-23
- [x] Offline operation log + upload-queue handler — done 2026-07-23
- [x] Staff attendance — done 2026-07-23

## Phase 2: Restaurant Operations

- [x] Inventory items — done (P12)
- [x] Stock movements — done (P12)
- [x] Purchase orders — done (P12)
- [x] Recipes — done (P12)
- [x] Wastage — done (P12)
- [x] CRM + Loyalty — done (P13)
- [x] QR Table Ordering — done (P10)

---

## URGENT — Audit Fixes (2026-07-24)

Full senior-engineering + security audit found the current uncommitted
`apps/api` work fails `pnpm typecheck` (29 errors) and contains two
critical bugs. Nothing else should be built on top of this work until
it's clean — fix in the order below.

### Build-breaking (`pnpm typecheck` currently fails on all of these)

- [ ] **F1 — Fix missing `APP_INTERCEPTOR` import**
      `apps/api/src/app.module.ts:32` uses `APP_INTERCEPTOR` but only
      imports `APP_GUARD` from `@nestjs/core`. App cannot boot as-is.
      _Effort: Trivial_
- [ ] **F2 — Fix undefined `customers`/`loyaltyAccounts` refs**
      `apps/api/src/modules/qr-order/qr-order.service.ts:407-430`
      (`captureLoyalty()`) references tables never imported from
      `@hospitality-os/database`.
      _Effort: Small_
- [ ] **F3 — Fix `GiftCardStatus` undefined**
      `apps/api/src/modules/crm/crm.service.ts:319`.
      _Effort: Small_
- [ ] **F4 — Fix `tenant_settings` insert/query type errors**
      `crm.service.ts:530,537` — `.where()` doesn't exist on the insert
      builder; iterator error on a nullable result.
      _Effort: Small_
- [ ] **F5 — Fix `Cannot find name 'session'` (4 occurrences)**
      `apps/api/src/modules/finance/shifts.service.ts:264,270,289` —
      likely a renamed/removed local variable.
      _Effort: Small_
- [ ] **F6 — Fix `currency` property missing on price-history type**
      `apps/api/src/modules/inventory/inventory.service.ts:546`.
      _Effort: Small_
- [ ] **F7 — Fix `PaymentLinkClaims` missing `tokenType`**
      `apps/api/src/modules/payments/payments.service.ts:1059`.
      _Effort: Small_
- [ ] **F8 — Fix `AuthContext` type mismatch for customer actor**
      `apps/api/src/modules/qr-order/qr-order.service.ts:273` —
      `actorType: 'customer'` not assignable to `ActorType`.
      _Effort: Small_
- [ ] **F9 — Fix `ThrottleException` — no such export in `@nestjs/common`**
      `apps/api/src/modules/qr-order/token-rate.guard.ts:1`.
      _Effort: Trivial_
- [ ] **F10 — Fix `ReportsService` missing methods called by controller**
      `apps/api/src/modules/reports/reports.controller.ts:56,62,68,141`
      calls `ownerDashboard`/`managerDashboard`/`kitchenDashboard`/
      `runDailyAggregation`, none of which exist on `ReportsService`
      (only `homeDashboard` does) — controller and service are out of
      sync.
      _Effort: Medium_
- [ ] **F11 — Fix `createdAt` missing on `tenant_settings` read type**
      `apps/api/src/modules/reports/reports.service.ts:453,475,485`.
      _Effort: Small_
- [ ] **F12 — Fix `etims_submission` type comparison**
      `apps/api/src/modules/sync/sync.service.ts:52` — compares against
      a union that doesn't include `etims_submission`.
      _Effort: Small_
- [ ] **F13 — Verify clean typecheck, then make it a real gate**
      Confirm `pnpm --filter @hospitality-os/api exec tsc --noEmit -p .`
      returns clean before merging any of the above, then treat
      `pnpm typecheck` as a hard pre-merge gate going forward, not just
      a script that exists.
      _Effort: Trivial_

### Critical security/correctness bugs

- [ ] **S1 — Fix M-Pesa self-checkout hardcoded `amount: 0`**
      `apps/api/src/modules/qr-order/qr-order.service.ts:329-332`
      (`payMpesa()`) must compute the bill's outstanding balance
      server-side instead of passing `amount: 0`, which also bypasses
      `TakeMpesaPaymentDto`'s `@Min(1)` since it's a direct service call
      that skips the controller.
      _Effort: Small_
- [ ] **S2 — Fix `@Body()` validation-bypass regression in `crm.controller.ts`**
      Lines 20 (`CreateCustomerDto`), 72 (`CreateLoyaltyAccountDto`), 126
      (`CreateCreditAccountDto`) use bare `@Body()` instead of
      `@ValidatedBody()`, silently skipping class-validator (see
      standing rule on this exact bug class).
      _Effort: Trivial_
- [ ] **S3 — Add DTOs + `@ValidatedBody` to all unvalidated money/points fields**
      Bare `@Body(key)` extraction with no DTO at all in
      `qr-order.controller.ts`, `sync.controller.ts:76,84`,
      `reports.controller.ts:130,154`, `kds.controller.ts:93,147`,
      `crm.controller.ts` (`addTag`, `mergeCustomers`,
      `redeemLoyaltyPoints`, `redeemGiftCard`, `chargeCreditAccount`,
      `settleCreditAccount`, `setupChamaRouting`),
      `core/staff/attendance.controller.ts:27`, `menus.controller.ts:33`.
      _Effort: Medium_
- [ ] **S4 — Add rate-limit guards to remaining public QR/order/payment routes**
      `TokenRateGuard` only covers 2 of 13 customer-facing routes
      (`refreshMenu`, `getOrderStatus`) — add it (or equivalent) to
      `submitOrder`, `payMpesa`, `requestBill`, `payWithWaiter`,
      `captureLoyalty`, `requestWaiter`, `submitFeedback`, `rateDish`,
      `fireCourse`, and `createSession` itself.
      _Effort: Small_
- [ ] **S5 — Replace `TokenRateGuard`'s in-memory `Map` with Redis-backed limiting**
      Current implementation has no eviction (unbounded memory growth)
      and doesn't work once the API runs more than one instance.
      _Effort: Medium_

### Data/migration integrity

- [x] **M1 — Delete or renumber the orphaned `0010_p11_inventory.sql` migration**
      Done 2026-07-24 — deleted. Confirmed via diff that every table it
      created is already covered by the tracked `0009_p9_receipts.sql`
      and `0016_p12_inventory.sql`.
- [x] **M2 — Generate missing migration snapshots**
      Done 2026-07-24 — turned out to be much bigger than "regenerate
      bookkeeping." Migrations 0000-0019 had **never been applied to a
      real database before** — verified by actually doing it (fresh
      Postgres via docker compose), which surfaced real bugs no
      snapshot-diffing alone would have caught:
      - `0014_p13_crm_loyalty.sql` and `0012_p10_staff_notifications_feedback.sql`
        both created `customer_feedback` — 0012 runs first and guards
        with `IF NOT EXISTS`, 0014 didn't, so a fresh migrate run failed
        outright. Removed the duplicate from 0014.
      - `purchase_order_items` and `recipe_ingredients` were missing
        `organization_id` entirely — in **both** the TS schema and the
        migration SQL — so their `CREATE POLICY ... USING (organization_id
        = ...)` RLS statements failed with "column does not exist" on a
        clean apply. Fixed in the schema, the migration, and the two
        service-layer insert call sites that needed the new field.
      - `cook_time_samples` (KDS cook-time learning) has a TS schema
        definition but no migration ever created it — added, with RLS.
      - 13 columns across 8 tables (`kds_stations`, `kitchen_ticket_items`,
        `kitchen_tickets`, `order_items`, `payment_intents`, `payments`,
        `products`, `staff_notifications`) exist in the TS schema for
        already-shipped features (bar tabs, card surcharging, fraud
        flagging, rush/VIP flagging, QR course labels) but were never
        migrated — added, plus 3 missing indexes and the `held` status
        added to `payment_intents_status_check`.
      - Added `0020_reconcile_schema_drift.sql` + a correct
        `0020_snapshot.json`. Verified end-to-end: fresh Postgres →
        `drizzle-kit migrate` (all 21 migrations, zero errors) →
        `drizzle-kit generate` reports "No schema changes, nothing to
        migrate" — the schema and migration history are now provably in
        sync, for the first time.

### Architecture follow-ups (not blocking, but flagged)

- [x] **A1 — Wire the transactional outbox into orders/payments/inventory**
      Done 2026-07-24. The infrastructure itself had three bugs beyond
      "nobody calls it," found via an actual running-API smoke test (not
      just typecheck):
      - `OutboxService.persistAndEmit` opened its **own** transaction
        instead of joining the caller's — an outbox row could commit even
        if the business change it described later rolled back. Now takes
        the caller's `Db` handle.
      - `OutboxWorker` used the tenant-scoped `APP_POOL` with a fake
        `'system'` org id (would either throw on the RLS UUID cast or see
        zero rows across every tenant), polled `WHERE isNull(events.data)`
        (a column that's never null — matches nothing), and was never
        actually started (`.start()` had no caller). Fixed: added a real
        `SYSTEM_POOL` (RLS-bypassing, admin-only) provider, added an
        `events.processed_at` column (new migration `0021`), rewrote the
        poll query, and wired `OnModuleInit`/`OnApplicationShutdown` so it
        self-starts.
      - Wired real emit call sites: `OrderOpened` (orders.service.ts),
        `PaymentConfirmed` (all 7 places payments.service.ts actually
        inserts a `payments` row — cash, card terminal, bank transfer,
        M-Pesa webhook, Paystack webhook, bar tab charge, bar tab settle),
        `StockMovementRecorded` (all 6 places inventory.service.ts and
        orders.service.ts's recipe-deduction path insert `stockMovements`).
      - Verified for real: booted the API against a freshly migrated +
        seeded database, logged in, created an order via HTTP, and
        confirmed the `events` table got the `OrderOpened` row with
        `processed_at` set by the background worker within its 5s poll
        interval — not just "typechecks."
      - That same smoke test caught two unrelated, pre-existing, and
        serious bugs this pass wouldn't have found any other way:
        `ResponseEnvelopeInterceptor` and **both `CrmController` and
        `QrOrderController`** used plain constructor DI (`private readonly
        x: Y`) instead of this codebase's mandatory `@Inject(Y)` pattern —
        under tsx/esbuild this resolves to `undefined` at runtime, so
        every response was crashing (interceptor) or **the entire CRM
        module and the entire customer-facing QR ordering flow were
        completely broken**, 500ing on every single request. Fixed all
        three, plus a health-check double-envelope bug found along the
        way. A systematic scan of every constructor in `apps/api/src`
        confirmed no other instances of this bug remain.
- [x] **A2 — Enforce module boundaries**
      Done 2026-07-25, in the dedicated session this item called for.
      Each module's `owns: [...]` manifest is the authoritative source of
      truth — reading it directly overturned the original framing:
      `bills`/`bill_items` are orders-owned (`orders.module.ts`), not
      payments-owned, so the real violations ran the other way from what
      the note above implied.
      - Added `db`-first methods (take the caller's already-open
        transaction handle, matching the existing `OutboxService`/
        `KdsService.createTicketsForSentItems` convention) to the owning
        service for every foreign write and business-logic-gating read:
        `ProductsService`/`ModifierGroupsService`/`CategoriesService`
        lookups, `TablesService.setStatusInTx`/`assignOrder`,
        `InventoryService.deductForRecipeSale`, a new
        `StaffNotificationsService` (homed in `notifications` — the
        `staff_notifications` table had no owner in any manifest),
        `StaffService.getActiveMember`, and several new `OrdersService`
        methods (`markBillFullyPaid`, `applyPaymentCompletion`,
        `getProductIdsForBillItems`, `syncItemStatusFromKitchen`,
        `recomputeReadinessAndTotals`, `createDraftOrderWithItems`,
        `getOrderItemById`, `sendCourse`, `requestBillInTx`,
        `markForWaiterPayment`) plus `CrmService` db-first extractions
        (`findOrCreateByPhoneInTx`, `createFeedbackInTx`,
        `findOrCreateLoyaltyAccountInTx`).
      - `orders.service.ts`, `payments.service.ts`, `kds.service.ts`, and
        `qr-order.service.ts` were rewritten to call these instead of
        touching foreign tables directly.
      - One genuine module cycle fell out of this: `kds.service.ts`
        (kitchen-initiated bump/recall/void) needs to write
        order/order-item status, and `orders.service.ts` already needed
        `KdsService`/`TablesService`. Resolved with `forwardRef()` on both
        module imports and both service injections — standard NestJS
        pattern, first use of it in this codebase, verified safe by
        booting the API and confirming Nest resolves the DI graph (a
        `forwardRef` mistake fails at boot, not at typecheck).
      - Along the way, the new validation on `orders.service.ts`'s status
        writes caught a real pre-existing bug: the staff-facing cash/card
        payment flow never transitioned an order through the
        `payment_pending` step the domain state machine requires between
        `bill_requested` and `paid` (only the QR flow did) — it worked
        before only because `payments.service.ts` wrote `orders.status`
        directly with zero validation. Fixed in
        `OrdersService.finalizeOrderPaid`.
      - Scope explicitly excludes read-only reporting/aggregation queries
        (`reports.service.ts`, `whatsapp-reports.service.ts`,
        `staff-report.service.ts`, `crm.service.ts`'s revenue join,
        `shifts.service.ts` reconciliation reads, `payments.service.ts`'s
        own single-record `loadBill`/`loadBillForRead`) — an accepted
        exception, consistent with the pre-existing `receipts.service.ts`
        precedent, since converting every own-workflow read into a
        service round-trip trades a real architecture fix for a much
        larger, higher-risk rewrite than "enforce boundaries" calls for.
      - Verified for real, not just via typecheck (per the standing lesson
        from the 2026-07-24 audit): booted the API against a freshly
        seeded database and drove both flows over HTTP — staff POS (seat
        table → create order → add item → send to kitchen → bump/accept/
        start/ready through KDS → mark bill split → pay both bills in
        cash → confirm order flips to `paid` and table releases) and QR
        customer ordering (create table session → browse menu → submit
        order → fire a course → request waiter → submit feedback/rate a
        dish → capture loyalty → pay-with-waiter). A couple of *separate*,
        pre-existing gaps surfaced during this (QR orders never leave
        `draft` because nothing transitions them to `open`; the table
        state machine has no automatic `food_ready` → `eating` step) —
        both faithfully preserved as-is (confirmed identical in the
        pre-refactor code), not fixed here since they're unrelated to
        module boundaries.
      _Effort: Large (refactor)_
      **Follow-up (2026-07-25):** the "accepted exception" above is now
      closed for everything except `reports.service.ts`/
      `whatsapp-reports.service.ts` reads, which stay a *permanent,
      enforced* allowlist rather than an unenforced exception. Added
      `scripts/check-module-boundaries.mts` — a blocking CI step
      (`pnpm check:boundaries`) that statically parses every module's
      `owns` manifest against `packages/database/src/schema`, and fails
      on any cross-module table read/write outside the reports allowlist.
      Fixed the real violations it found in `crm.service.ts`,
      `finance/shifts.service.ts`, `notifications/receipts.service.ts`,
      `payments.service.ts`, `restaurant/tables.service.ts`/
      `kds.service.ts`, `sync/sync.service.ts`, `staff-report.service.ts`,
      and reworked `qr-order.service.ts` (previously bypassed
      Restaurant/Products/Orders' services entirely despite importing
      them correctly). Also fixed manifest drift the checker caught:
      `staff` claimed nonexistent `staff_sessions`/`attendance` (real
      table is `staff_attendance`, core-owned); `notifications` claimed
      nonexistent `notification_templates`/`notification_deliveries`;
      `retail` duplicate-claimed `stock_counts` (inventory's, stale
      copy-paste); `product_modifier_groups`/`cook_time_samples`/`users`/
      `tenant_settings`/RBAC tables were unclaimed by any module.
      Introduced a new Notifications↔Payments `forwardRef` cycle
      (`ReceiptsService` now reads confirmed payments via
      `PaymentsService`); this revealed that a longer (4+ module) ES-import
      cycle needs `forwardRef()` on *every* edge in the cycle, not just the
      edge with a direct service-to-service dependency — `payments.module.ts`
      wrapping only `NotificationsModule` and leaving its `OrdersModule`
      import plain caused a real boot-time `ReferenceError: Cannot access
      'OrdersModule' before initialization` (TDZ on a circular ESM import,
      distinct from NestJS's own DI-resolution ordering) once Notifications
      started importing both Orders and Payments — fixed by also wrapping
      `OrdersModule` in `payments.module.ts`/`notifications/index.ts` and
      `NotificationsModule` in `restaurant.module.ts`. Verified by booting
      the API (`Nest application successfully started`, zero DI errors) and
      a live `GET /health` → `200`; full seeded-DB business-flow driving
      (shift close, QR order, receipt generation, offline sync, chama
      routing, scheduled reports) was not re-run this session — recommended
      before merge, per the verified-for-real standard above.
- [x] **A3 — Add dependency-vulnerability and secret-scanning jobs to CI**
      Done 2026-07-24 — new `security` job in `.github/workflows/ci.yml`:
      `pnpm audit --audit-level=high` (moderate/low findings are common
      in transitive deps with no fix yet and would make CI flaky for
      reasons outside a PR's control, so only high/critical fail the
      build) and `gitleaks` (via the official Docker image, full git
      history, no license/account needed). Gitleaks verified locally —
      43 commits scanned, no leaks found (matches the earlier audit
      finding that `.env` was always properly gitignored).
      **Heads up:** `pnpm audit --audit-level=high` will fail on the very
      next push as configured — the dependency tree currently has 24
      high + 2 critical advisories (verified locally). Nearly all are
      transitive: `drizzle-orm` declares `expo-sqlite` as a peer
      dependency, which pulls in the full Expo/React Native build
      toolchain (`@expo/cli`, `@expo/metro-config`, and their own `tar`/
      `multer`/`lodash`/`postcss`/`sharp`/etc. transitive deps) into
      `apps/api`'s resolved tree even though `apps/api` never imports the
      expo-sqlite driver — not real runtime attack surface for the API,
      but `pnpm audit` can't tell that from the lockfile alone. A few are
      real and need an actual version bump with regression testing
      (`@nestjs/core`, `drizzle-orm` itself, `astro`). Deliberately not
      fixed in this pass — silently bumping core framework versions to
      make a CI gate green is a separate, higher-risk piece of work than
      "add the gate," and doing it carelessly just to satisfy a check
      would be worse than leaving it red with this note attached.
      _Effort: Small_

---

## CRITICAL GAPS (Blocks User-Facing Value)

### Gap A: Frontend — 6 of 10 apps are empty shells

- [ ] **A1 — Build `pos-mobile` waiter POS UI** (React Native)
      API is complete but the POS has no screens for: PIN login, floor plan,
      table selection, order entry, cart, payment, tips, shift management.
      Currently only shows sync status. This is the #1 gap.
      _Effort: Very Large (entire app to build)_

- [ ] **A2 — Build `manager-web`** (React + Vite)
      Currently a 53-line shell with `alert()` buttons. Needs screens for:
      operations dashboard, approvals queue, staff management, shift
      management, inventory views, reports, audit log. Backend is fully ready.
      _Effort: Very Large_

- [ ] **A3 — Build `owner-web`** (React + Vite)
      Currently a 53-line shell with dead links. Needs: executive dashboard,
      branch comparison, P&L, customer intelligence, AI briefings, billing.
      _Effort: Large_

- [ ] **A4 — Build `admin-web`** (React + Vite)
      Currently a 64-line shell with hardcoded stats. Needs: tenant management,
      device status, sync health, integration logs, feature flags.
      _Effort: Medium_

- [ ] **A5 — Build `marketing-web`** (Astro)
      Currently 2 placeholder pages. Needs real marketing content.
      _Effort: Medium_

- [ ] **A6 — Refactor `customer-web` out of monolith**
      797 lines in one file. No component extraction, no routing despite
      `react-router` being a dependency. Feature directories empty.
      _Effort: Medium_

### Gap B: Shared Packages — 2 packages empty, 2 incomplete

- [ ] **B1 — Build `packages/ui` design system** (shadcn/ui + Tailwind)
      Zero components. Every frontend app needs: Button, Input, Card, Modal,
      DataTable, MetricTile, ConfirmDialog, Skeleton, StatusBadge,
      ConnectivityIndicator, PINPad, ProductGrid, etc.
      _Effort: Large (foundational)_

- [ ] **B2 — Build `packages/api-client` typed client**
      Zero generated clients. Every frontend manually constructs fetch calls
      with no types, no error handling, no auth header injection.
      _Effort: Medium_

- [ ] **B3 — Wire real tax/messaging adapters in `packages/integrations`**
      KRA eTIMS returns fake data. WhatsApp/SMS/Email log instead of sending.
      Print adapter is simulated. These must be real before launch.
      _Effort: Medium (provider-specific)_

- [ ] **B4 — Add PowerSync runtime to `packages/offline-sync`**
      Conflict engine + op-log + PowerSync YAML exist but no actual sync
      transport, no PowerSync SDK dependency, no push/pull service.
      _Effort: Medium_

---

## HIGH PRIORITY

- [ ] **C1 — Write tests across the entire monorepo**
      Zero tests. No unit, integration, or e2e tests anywhere. API is at
      highest risk — every module has complex business logic with state
      machines, approval flows, and audit trails.
      _Effort: Very Large_

- [ ] **C2 — Add missing DTOs to audit, reports, qr-order, staff modules**
      These modules accept raw body params instead of validated DTOs.
      _Effort: Small_

- [ ] **C3 — Add missing migration snapshots for migrations 12-19**
      Only snapshots 0000-0011 exist in `meta/`. Could cause schema drift.
      _Effort: Small_

- [ ] **C4 — Add `logging` core module**
      `apps/api/src/core/logging/` is empty (only `.gitkeep`).
      _Effort: Small_

---

## MEDIUM PRIORITY

- [ ] **D1 — Add remaining payment adapters**
      Airtel Money, Flutterwave, Stripe defined in domain types but no
      implementation in `packages/integrations`.

- [ ] **D2 — Wire Paystack refund endpoint**
      Currently returns `requiresManualSettlement: true` with "contact
      Paystack support" message.

- [ ] **D3 — Add connector config to `packages/config`**
      Only `appPorts` exists. No env var schemas, feature flags, or
      meaningful constants.

- [ ] **D4 — Refactor `kds-web` out of monolith**
      971 lines in one file. Zustand dependency unused despite being listed.
      Feature directories are empty `.gitkeep`.

---

## LOW PRIORITY (Documented as Deferred)

- [ ] E1 — Hotel OS vertical (schema + API modules are placeholders)
- [ ] E2 — Retail OS vertical (schema + API modules are placeholders)
- [ ] E3 — Desktop POS (Tauri — explicitly deferred)
- [ ] E4 — Developer Portal (React + Vite — P19 phase)
- [ ] E5 — AI/ML service (Python FastAPI — P17 phase)
- [ ] E6 — Commerce integrations (Shopify, WooCommerce — P15 phase)
- [ ] E7 — Delivery integrations (Uber Eats, Glovo, Bolt Food — P16 phase)

---

## BRANCH NAME GUIDE

| BUILD_WORKFLOW Phase | Branch | Status |
|---|---|---|
| P10 — QR Table Ordering | `feature/p10-qr-ordering` | ✅ Complete |
| P11 — Offline Sync | `feature/p11-offline-sync` | ✅ Complete |
| P12 — Inventory + Recipes | `feature/p12-inventory-recipes` | ✅ Complete |
| P12a — Staff Attendance | `feature/p12a-staff-attendance` | ✅ Complete |
| P13 — CRM + Loyalty | `feature/p13-crm-loyalty` | ✅ Complete |
| P14 — Reports + BI | `feature/p14-reports-bi` | ❌ Not started |
| P15 — Commerce | `feature/p15-commerce` | ❌ Not started |
| P16 — Delivery | `feature/p16-delivery` | ❌ Not started |