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

**Correction (2026-07-25): all of F1-F13 were already fixed by the time of
this pass — the checkboxes just never got ticked. Re-verified by grepping
every cited line/symbol and running
`pnpm --filter @hospitality-os/api exec tsc --noEmit -p .` clean.**

- [x] **F1 — Fix missing `APP_INTERCEPTOR` import** — `app.module.ts:4`
      imports both `APP_GUARD` and `APP_INTERCEPTOR` from `@nestjs/core`.
- [x] **F2 — Fix undefined `customers`/`loyaltyAccounts` refs** — no
      unimported-table references remain in `qr-order.service.ts`.
- [x] **F3 — Fix `GiftCardStatus` undefined** — properly imported from
      `@hospitality-os/domain` in `crm.service.ts:16`.
- [x] **F4 — Fix `tenant_settings` insert/query type errors** — no
      `.where()`-on-insert or bad-iterator errors remain in `crm.service.ts`.
- [x] **F5 — Fix `Cannot find name 'session'`** — `session` is a properly
      declared `const` at every cited call site in `shifts.service.ts`.
- [x] **F6 — Fix `currency` property missing on price-history type** —
      present and typed throughout `inventory.service.ts`.
- [x] **F7 — Fix `PaymentLinkClaims` missing `tokenType`** — set at
      `payments.service.ts:1090`.
- [x] **F8 — Fix `AuthContext` type mismatch for customer actor** —
      `actorType: 'customer'` is a valid `ActorType` value, used
      throughout `qr-order.service.ts`.
- [x] **F9 — Fix `ThrottleException` non-export** — no reference to it
      remains in `token-rate.guard.ts`.
- [x] **F10 — Fix `ReportsService` missing methods** — `ownerDashboard`,
      `managerDashboard`, `kitchenDashboard`, `runDailyAggregation` all
      exist on `ReportsService` and match the controller's calls.
- [x] **F11 — Fix `createdAt` missing on `tenant_settings` read type** —
      resolved; used correctly throughout `reports.service.ts`.
- [x] **F12 — Fix `etims_submission` type comparison** — included in the
      union compared against in `sync.service.ts:52,390`.
- [x] **F13 — Verify clean typecheck, make it a real gate** — confirmed
      clean 2026-07-25; CI runs `pnpm typecheck` as a blocking step.

### Critical security/correctness bugs

**Correction (2026-07-25): S1-S5 were also already fixed — re-verified
against the current code, not re-litigated.**

- [x] **S1 — Fix M-Pesa self-checkout hardcoded `amount: 0`** —
      `payMpesa()` now calls `paymentsService.getOutstandingBalance()` and
      throws `BadRequestException` if there's nothing owed, instead of
      passing a hardcoded amount.
- [x] **S2 — Fix `@Body()` validation-bypass in `crm.controller.ts`** — no
      bare `@Body()` calls remain; all routes use `@ValidatedBody()`.
- [x] **S3 — Add DTOs + `@ValidatedBody` to unvalidated money/points
      fields** — no bare `@Body(key)` extraction without a DTO remains in
      any of the previously-cited controllers.
- [x] **S4 — Add rate-limit guards to remaining public QR routes** —
      `TokenRateGuard` is applied 13 times in `qr-order.controller.ts`,
      covering all customer-facing routes.
- [x] **S5 — Replace `TokenRateGuard`'s in-memory `Map` with Redis** —
      now backed by `ioredis`, shared across API instances.

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
      **Follow-up (2026-07-25, later same day):** ran the recommended
      seeded-DB business-flow pass over live HTTP against the running API —
      staff POS (seat table → order → send to kitchen → accept/start/bump
      through KDS → split → pay cash → shift close), receipt generation,
      offline sync push, chama routing setup+process, and scheduled-report
      aggregation. Found and fixed five real bugs the module-boundary work's
      typecheck/build/boot verification couldn't have caught (none are
      boundary regressions — all pre-date A2, surfaced only by driving real
      requests against a real DB):
      - `shifts.service.ts#getVarianceThreshold` called `JSON.parse` on a
        value `TenantSettingsService.get` already returns pre-parsed from
        `jsonb` — every shift close 500'd (`"[object Object]" is not valid
        JSON`) once a `cash_variance_threshold` tenant-setting row existed,
        which the seed always creates. Fixed by reading the object
        directly, no parse.
      - `ShiftsService.close`'s `uncounted_drawer` pre-close check read
        `cashDrawerSessions.countedAmount`, but that column is only ever
        written by the same `close()` call being gated — the check could
        never pass, forcing every close through `force=true`. Removed it;
        `dto.countedAmount` being mandatory already covers the intent (PRD
        08: counting the drawer and closing the shift are one action).
      - Receipts never rendered line items — `content.items` was hardcoded
        `[]` since the original P9 commit, and the printed-text renderer had
        a dead blank-line placeholder where items should print. Added
        `OrdersService.getBillItemsForReceipt` (billItems→orderItems join)
        and wired it through both.
      - `sync/dto/push-operations.dto.ts`'s `PushOperationsDto.operations`
        was missing `@Type(() => PushOperationItem)` — the one `@ValidateNested`
        array in the codebase missing it (checked all seven others). Without
        it every `POST /api/v1/sync/push` 400'd with "an unknown value was
        passed to the validate function". While chasing this, found
        `ValidatedBody`'s error formatting only read `error.constraints`,
        never `error.children` — any nested/array DTO validation failure
        anywhere in the app came back as a bare 400 with an empty message
        array. Fixed both (recursive `flattenConstraints` helper).
      - `sync_operations`/`sync_conflicts`' `entity_type` CHECK constraints
        (migration 0013, P11) were hardcoded to a singular-noun list
        (`order`, `payment`, `tip`, `shift`, `audit_event`, ...) that never
        matched `SyncEntityTypeSchema` in `packages/domain` (plural nouns:
        `orders`, `payments`, `products`, `customers`, `inventory_items`,
        ..., `etims_submission`) — the only enum application code validates
        a push against. Every legal `entityType` value therefore violated
        the DB constraint outright; offline sync push was 100% broken for
        every possible input. Added migration `0022_fix_sync_entity_type_check.sql`
        aligning both constraints to the domain enum (confirmed no code path
        ever used the old DB-only values — they were audit-log entity-type
        string literals in unrelated code, a naming coincidence).
      Also fixed one unrelated pre-existing lint failure blocking
      `pnpm lint` (`apps/manager-web/src/app/main.tsx`, unescaped apostrophe).
      Verified: `pnpm typecheck`/`build`/`check:boundaries` clean across the
      monorepo after fixes; re-ran shift close (zero variance) and receipt
      generation live against the API and confirmed both fixes hold.
      **Found but deliberately not fixed at the time** (large, pre-existing,
      out of scope for A2's pass) — **fixed 2026-07-25, in a dedicated pass**:
      - QR ordering's payment path is fixed end-to-end. Four cooperating bugs,
        all in `apps/api/src/modules/orders/orders.service.ts` unless noted:
        1. `createDraftOrderWithItems` created an eager `open` bill with every
           amount hardcoded to `0` and never linked `billItems` — removed;
           bill creation is now solely `requestBillInTx`'s job (matching its
           own pre-existing doc comment), and `recomputeOrderTotals` now runs
           right after item insertion so `order.totalAmount` is correct
           immediately (customer cart view), well before any bill exists.
        2. `packages/domain/src/index.ts`'s `ORDER_STATUS_TRANSITIONS.draft`
           didn't include `sent_to_kitchen`, even though `sendCourse` (the
           QR-ordering equivalent of `send()`) already had a
           `fromStatus === 'draft'` branch written for exactly this case —
           the domain enum just didn't permit it, so the branch was silently
           dead code and QR orders could never leave `draft`. Added
           `sent_to_kitchen` to `draft`'s allowed transitions.
        3. `sendCourse` filtered items by `orderItems.course` — the
           staff-POS/KDS kitchen-display field, set only via
           `AddOrderItemDto`, never exposed to QR customers. QR ordering's
           actual per-item field is `sessionLabel` (added by
           `0020_reconcile_schema_drift.sql` specifically "for fire-course
           support" per its own comment) — `sendCourse` was still querying
           the wrong column, so no QR-submitted item could ever match any
           `courseName` and `fireCourse` always 400'd with `no_items_for_course`.
           Fixed to filter on `sessionLabel`.
        4. `requestBillInTx` only populated a bill's totals in its
           bill-didn't-exist-yet branch — dead code once bug 1's eager bill
           always pre-existed. Rewrote: new helper
           `linkUnbilledItemsAndRecomputeBillTotals` inserts a `billItems`
           row (join, not copy — `allocatedAmount = totalAmount - discountAmount`,
           matching the existing pattern in `addItem`/`split`) for every
           non-voided order item not yet linked to any bill on the order,
           then recomputes the bill's `subtotalAmount`/`totalAmount` from
           what's actually linked. Idempotent by construction (checks
           existing links first), called whether the bill is new or existing.
        Verified for real, not just typecheck: booted the API against the
        seeded dev DB, drove the full flow over HTTP (create table session →
        submit order → fire course → request bill), and confirmed via direct
        DB query that the bill lands with correct `subtotal_amount`/
        `total_amount` (2400, matching 2× a 1200 item) and exactly one
        correctly-linked `bill_items` row — then confirmed the QR M-Pesa
        payment endpoint gets *past* the old `outstandingAmount <= 0` hard
        failure (now correctly computes 2400 owed) and only stops at
        `integration_not_configured`, an unrelated seed-data gap (this test
        org has no M-Pesa credentials), not a code bug. Test data cleaned up
        from the dev DB afterward. `pnpm typecheck`/`check:boundaries` clean.
      - `apps/customer-web` has 24 pre-existing `@typescript-eslint/no-explicit-any`
        lint errors (untouched since the same 4bf1d70 commit as the
        manager-web fix above) — `pnpm lint` still fails on this package.
        Real fixes need per-call-site type investigation; left as-is rather
        than mass-changing types without test coverage to catch mistakes.
      - Realtime P&L's `laborCost` (`reports.service.ts`) assumes every
        active staff member worked a full 8h shift at a flat default rate —
        it doesn't read actual clock-in/attendance data despite P12 Staff
        Attendance existing. Working as coded, just a known simplification;
        not touched.
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

- [x] **C3 — Migration snapshot gap investigated (2026-07-25), not a real bug**
      Intermediate snapshots for 0009,0010,0012-0019 are still missing
      from `meta/` (hand-written migrations skipped `drizzle-kit
      generate`), but this doesn't cause drift: `drizzle-kit check`
      reports "Everything's fine" and `drizzle-kit generate` reports "No
      schema changes, nothing to migrate" against the real schema — the
      last real snapshot (`0022`) is accurate, which is all drizzle-kit's
      tooling actually reads for future diffs. `0020_reconcile_schema_drift.sql`
      (see M2 above) is what actually closed the drift risk. Hand-crafting
      fake historical snapshot JSON for the gap was considered and
      rejected — getting drizzle-kit's internal id/prevId hash chain
      wrong by hand risks turning a cosmetic gap into a real one, for a
      purely archival benefit.

- [ ] **C4 — Add `logging` core module**
      `apps/api/src/core/logging/` is empty (only `.gitkeep`).
      _Effort: Small_

---

## MEDIUM PRIORITY

- [x] **D1 — Add remaining payment adapters** — Done 2026-07-25.
      Added `airtel-money.adapter.ts`, `flutterwave.adapter.ts`, and
      `pesapal.adapter.ts` to `packages/integrations/src/payments/adapters/`
      (real `fetch()`-based implementations following the existing
      mpesa/paystack pattern — OAuth2 + STK-style push for Airtel, payment
      link + server-side re-verification for Flutterwave, bearer-token
      order submission + unsigned-IPN-so-re-verify-via-GetTransactionStatus
      for PesaPal) and registered them in `payment-provider.factory.ts`
      plus `PaymentProviderSchema` (`packages/domain`) and
      `ConnectIntegrationDto`'s allowlist. Package + full monorepo
      typecheck clean, `check:boundaries` clean.
      **A Stripe adapter was also built in this same pass, then removed the
      same day** on the user's explicit call — "it doesn't work with
      African businesses" (migration `0025_remove_stripe_provider.sql`:
      deleted `stripe.adapter.ts`, dropped `stripe` from
      `PaymentProviderSchema`/`ConnectIntegrationDto`/the DB `provider`
      CHECK constraints; verified zero existing rows referenced it before
      dropping). Correct call — Stripe has no African card-scheme/mobile-
      money settlement or bank payout rails, so it would never have been a
      real acquiring option for this business's actual customers, only
      dead weight.
      **Not done, and a real follow-up**: these adapters are reachable via
      `getPaymentAdapter()` (so refunds work generically once a payment
      exists) but nothing in `apps/api` can actually *create* a
      Flutterwave/Airtel/PesaPal payment yet — `takeMpesa`/`takeCard` are
      the only "take payment" service methods, both hardcoded to their one
      provider. Adding `takeFlutterwave`/`takeAirtelMoney`/`takePesapal`
      (DTOs + controller routes + service methods, mirroring `takeCard`)
      plus a webhook route per provider (mirroring
      `PaymentsWebhookController`'s existing `mpesa/:orgId` and
      `paystack/:orgId` handlers) is its own contained task, deliberately
      not bundled into this pass — untested third-party credentials for 3
      more providers is a bigger, different kind of risk than writing the
      adapters themselves. PesaPal also needs a one-time IPN URL
      registration step per merchant (`POST /URLSetup/RegisterIPN`) before
      its adapter can be used — not yet wired into the connect-integration
      flow, so `ipnId` must currently be obtained and supplied manually.

- [x] **D1a — Add M-Pesa C2B (Paybill/Till manual payment)** — Done
      2026-07-25 (researched earlier the same day, then built same-day on
      request). Adds the flow STK Push doesn't cover: a customer dials the
      M-Pesa menu themselves and types a Paybill+account number or Till
      number, no push involved.
      - `registerMpesaC2BUrls`/`validateC2BPayload` added to
        `mpesa.adapter.ts` (exported directly from `packages/integrations`,
        not through `getPaymentAdapter` — C2B isn't a per-payment call, it's
        a one-time-per-shortcode setup call plus two passive webhook
        handlers, a different shape from the rest of `PaymentAdapter`).
      - New table `mpesa_c2b_transactions` (migrations 0023-0024) — a
        staging/reconciliation ledger, since a C2B payment arrives with no
        `payment_intent` to confirm against, unlike every other payment
        path in this codebase. `location_id` is nullable (unlike every
        other payment table) because the incoming payload carries no
        location — resolved transitively once matched to a bill.
      - `PaymentsService`: `registerMpesaC2b` (staff setup,
        `payments:connect_integration`), `handleMpesaC2bValidation` (fast
        accept/reject before settlement — Safaricom disables this by
        default on most shortcodes), `handleMpesaC2bConfirmation` (lands
        the payment; auto-matches if `BillRefNumber` is an exact bill/order
        UUID, else stays `unmatched`), `listUnmatchedMpesaC2b` /
        `matchMpesaC2b` (staff reconciliation, `payments:reconcile`).
      - Routes: `POST /payments/mpesa-c2b/register`,
        `GET /payments/mpesa-c2b/unmatched`,
        `POST /payments/mpesa-c2b/:transactionId/match`, plus two
        unauthenticated webhook routes on `PaymentsWebhookController`
        (`mpesa/c2b/validation/:orgId`, `mpesa/c2b/confirmation/:orgId`).
      - Added `PUBLIC_URL` to `.env.example` — needed to build the absolute
        webhook URLs handed to Safaricom at registration time; didn't exist
        before (one payments.service.ts call site already read it
        undocumented for split-payment links).
      - **Found and fixed two bugs along the way, unrelated to C2B itself
        but caught while building and verifying it:**
        1. `scripts/check-module-boundaries.mts`'s table-name regex was
           `[a-z_]+` — silently fails to match any table name containing a
           digit (e.g. `mpesa_c2b_transactions`). Widened to `[a-z0-9_]+`.
        2. The Stripe/Flutterwave/PesaPal adapters added earlier this
           session had a real money bug: `input.amount` is whole currency
           units throughout this codebase (e.g. 1200 = KES 1,200 — confirmed
           against M-Pesa's own Daraja `Amount` field, which takes this
           value unconverted), not cents as their doc comments claimed.
           Flutterwave/PesaPal's `/100` would have undercharged 100x; Stripe
           not converting at all would also have undercharged 100x (Stripe
           genuinely wants cents). Fixed all three adapters' initiate/
           verify/refund amount conversions.
      - Verified for real against the seeded dev DB, not just typecheck:
        booted the API, POSTed synthetic Validation and Confirmation
        payloads shaped like Safaricom's real callback, confirmed the
        transaction landed `unmatched` in the DB, manually matched it to a
        real bill via the staff endpoint (partial payment — bill correctly
        stayed `open`), confirmed re-matching an already-matched transaction
        is rejected, then separately drove a second confirmation with
        `BillRefNumber` set to an exact bill id and confirmed it
        auto-matched and flipped the bill straight to `paid`. Also
        discovered and fixed a stale bookkeeping gap in this dev DB's
        `drizzle.__drizzle_migrations` table (migration 0022 had been
        applied by hand in an earlier session and was never recorded,
        which didn't break anything functionally but would have confused
        future `drizzle-kit migrate` runs) — backfilled both missing hash
        rows. `pnpm typecheck` (23/23 packages) and `check:boundaries` (77
        tables) both clean; all test data cleaned from the dev DB
        afterward.
      **Not done, a real follow-up**: `registerMpesaC2b` was written and
      typechecks but its actual Safaricom API call was never exercised
      live (no sandbox credentials available in this session) — only the
      inbound webhook/reconciliation half was verified end-to-end.

- [x] **D1c — Generalize take-payment/webhook routes across providers** —
      Done 2026-07-25, user's explicit call after being shown the tradeoff
      (touches working M-Pesa/Paystack code vs. keeps per-provider
      boilerplate growing forever). Every `PaymentAdapter`-based provider
      (`mpesa_daraja`, `paystack`, `airtel_money_api`, `flutterwave`,
      `pesapal`) now goes through one route each instead of one route per
      provider:
      - `POST /bills/:billId/payments/:provider` replaces the old
        `.../mpesa` and `.../card` routes — `takeMpesa`/`takeCard` deleted,
        replaced by one `PaymentsService.takePayment()`. Cash,
        card-terminal, and bank-transfer are NOT part of this — no external
        round-trip/webhook, so they keep their own dedicated
        methods/routes/DTOs. Registered *after* those static routes in the
        controller — Express matches in registration order, so the dynamic
        `:provider` segment would otherwise shadow `/cash` etc.
      - `POST /webhooks/:provider/:orgId` replaces `.../mpesa` and
        `.../paystack` — `handleMpesaWebhook`/`handlePaystackWebhook`
        deleted, replaced by one `PaymentsService.handleProviderWebhook()`.
        The M-Pesa-only Module 18 fraud check stays as a
        `provider === 'mpesa_daraja'` branch inside the generic method —
        an honest small escape hatch rather than a forced fake abstraction.
      - Repurposed the existing (previously unused, comment said "not used
        directly by any endpoint") `take-payment.dto.ts` into the real
        generic DTO instead of adding a new file. Deleted
        `take-mpesa-payment.dto.ts`/`take-card-payment.dto.ts` — Kenyan-
        phone-number-format validation moved from DTO annotation to the
        adapter runtime (`mpesa.adapter.ts`'s `formatPhone`, which already
        threw a clear error on a bad number).
      - Authorization preserved exactly: waiters have `payments:take_mobile_money`
        but not `payments:take_card` (cashier/manager have both) in the
        seed data. A single route can't statically vary
        `@RequirePermission` by the `:provider` param's runtime value, so
        the route requires the floor permission
        (`take_mobile_money`) and `takePayment` additionally checks
        `take_card` in-service when the resolved payment method needs it —
        verified live as a waiter: blocked on `paystack` with a clear
        `permission_denied`, allowed through on `mpesa_daraja` (proceeding
        to `integration_not_configured`, i.e. past the permission gate).
      - Fixed a real gap along the way: `TakeCardPaymentDto.tipAmount` was
        collected but never actually applied anywhere for the
        webhook-confirmed (Paystack) path — only cash/card-terminal/
        bank-transfer's *immediate*-confirm paths ever inserted a `tips`
        row. Generic `takePayment` now stashes tip info on the intent's
        `metadata` and `handleProviderWebhook` applies it once the payment
        actually confirms.
      - Fixed a second, more severe pre-existing gap while generalizing the
        two webhook handlers into one: found that `handleMpesaWebhook`
        looked up the intent by `eq(paymentIntents.providerReference,
        result.providerReference)`, but M-Pesa's `verifyWebhook` sets
        `providerReference` to the **receipt number** on success (only
        falls back to the original `CheckoutRequestID` on failure) — while
        the intent was stored under `CheckoutRequestID` at creation. **A
        successful M-Pesa STK payment could never be matched to its bill**,
        so `settleBillIfFullyPaid`/`emitPaymentConfirmed` would never fire
        even though the customer's money had genuinely arrived. Verified
        this was really happening (not a refactor-introduced bug) by
        reproducing it against the untouched original code path before
        fixing. Root cause: the interface's `paymentIntentId` field (with
        its own comment — "the adapter returns [this] as the lookup key")
        was designed for exactly this lookup and was simply never used;
        the code used `providerReference` instead. Also found the fix
        isn't uniform across adapters — Paystack/Flutterwave put *our own*
        `payment_intents.id` in `paymentIntentId` (echoed back via
        metadata), while M-Pesa/Airtel/PesaPal put *their* tracking
        reference there (matching what's in `providerReference` at
        creation). Fixed with one `OR` in the lookup query, guarded so the
        `id` branch only runs when the value is actually UUID-shaped
        (Postgres throws, not just "no match," comparing a non-UUID string
        against a `uuid` column — M-Pesa's `CheckoutRequestID` never is).
      - Verified for real, not just typecheck: booted the API, drove the
        generic route with an unsupported provider (clean 400), with
        `mpesa_daraja` (reached `integration_not_configured`, same as the
        old dedicated route), connected a real (test-value, properly
        AES-256-GCM-encrypted via the actual connect-integration endpoint)
        `mpesa_daraja` integration, manually seeded a `processing` intent,
        and POSTed a Safaricom-shaped successful STK callback to the new
        generic webhook route — confirmed `status: confirmed`, the bill
        flipped to `paid`, and the final `payments` row correctly stored
        the receipt number while the lookup matched via the
        `CheckoutRequestID` path. Also confirmed the static `/cash` route
        still works unshadowed. All test data cleaned from the dev DB
        afterward. `pnpm typecheck` (23/23) and `check:boundaries` (77
        tables) clean.
      - Incidentally discovered and documented (not fixed further — out of
        scope) that local dev never had `CREDENTIALS_ENCRYPTION_KEY` set at
        all; connecting any payment integration has been throwing a clear
        "must be set to exactly 64 hex characters" error this whole time.
        Added a generated key to the local (gitignored) `.env` to unblock
        this session's verification, and documented the var properly in
        `.env.example` (it existed as an undocumented requirement before).

- [ ] **D1b — Kenyan bank/terminal payment options researched, not built
      (2026-07-25)**. User asked what else exists beyond the 5 gateway
      adapters — physical terminals and direct bank APIs specifically.
      Findings, in case any of these become worth building:
      - **Physical terminals** (Safaricom Lipa Na M-Pesa POS, DPO Network
        POS, Pesapal POS) are hardware SKUs of payment accounts we already
        have API access to (Pesapal) or are simply out of our software's
        scope (Safaricom's own rented terminal). The one genuinely new
        *pattern* worth building later: **tap-to-phone** (KCB's version
        turns a waiter's own Android device into a card reader, no
        dedicated hardware) — that's a `pos-mobile` app feature, not a
        backend adapter.
      - **Kopo Kopo** — real standalone candidate for a 7th adapter.
        Kenya-native, STK-push-shaped API (`api-docs.kopokopo.com`, same
        request/callback pattern as our M-Pesa adapter), 10,000+ merchants,
        Safaricom-partnered since 2011.
      - **Equity Jenga API** (developer.jengahq.io) and **KCB Buni API**
        (buni.kcbgroup.com) — both full payment gateways (cards + all
        Kenyan mobile money + bank transfer) tied to a single bank. Worth
        it only for a merchant who specifically banks there and wants to
        skip a 3rd-party aggregator's cut.
      - **Co-operative Bank** (Co-opConnect) and **NCBA** (IPN API) have
        public developer portals too, more payout/account-data-focused
        than card acquiring.
      - **Stanbic**, **Absa Kenya**, **Family Bank** — no clean, self-serve
        public developer portal found; likely enterprise-sales-led
        integration, not a quick adapter to write.
      - **PesaLink** (real-time interbank transfer network, 80+ Kenyan
        institutions, up to KES 999,999/transaction) is **already reachable
        through the existing Paystack adapter** — Paystack added PesaLink
        checkout in Kenya, so once a merchant enables it on their Paystack
        account, our hosted-checkout flow offers it with zero extra code.
        Direct integration would mean going through a member bank or an
        aggregator like Cellulant instead.
      - **Cellulant Tingg** — pan-African reach (200+ payment methods
        across the continent), relevant if the business expands beyond
        Kenya.
      Recommended build order if picked up: Kopo Kopo first (closest to
      code we already have), then Equity/KCB only if a specific merchant
      needs it.

- [x] **D2 — Wire Paystack refund endpoint** — Done 2026-07-25. Replaced the
      stub with a real `POST /refund` call (transaction reference + amount +
      currency); falls back to `requiresManualSettlement: true` only on an
      actual API failure or account without refund access, same as before.

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