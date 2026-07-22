# TODO

This TODO follows the new master plan. Restaurant OS comes first.

Read `ENGINEERING_CHARTER.md` and `docs/adr/0001-tech-stack.md` before
starting Phase 0 — the backend framework, mobile workflow, and offline
sync engine all changed from what earlier scaffolding may assume.

## Phase 0: Foundation

- [x] Migrate `apps/api` scaffold from Fastify to NestJS (ADR 0001) —
      done 2026-07-20: `NestFactory` bootstrap in `main.ts`, `AppModule`
      wiring `ConfigModule`/`ThrottlerModule`/`HealthModule` and all 15
      domain module stubs as real `@Module()` classes, `/health` and
      `/api/v1/modules` endpoints preserved
- [x] Move `apps/pos-mobile` off managed Expo Go to bare/dev-client
      workflow (ADR 0001) — done 2026-07-20: `expo-dev-client` dependency,
      `android`/`ios` identifiers in `app.json`, native `android/` and
      `ios/` projects generated via `expo prebuild` and committed (root
      `.gitignore`'s blanket `android/`/`ios/` rule, a leftover from the
      managed-workflow assumption, updated to ignore only build artifacts)
- [x] Move `apps/customer-web` and `apps/developer-portal` off Next.js to
      React + Vite (ADR 0001) — done 2026-07-20: `customer-web` fully
      migrated (Vite config, nginx-based Dockerfile, `docker-compose.yml`
      port mapping updated to `3001:80`); `developer-portal` had already
      been de-Next.js'd to a placeholder pending P19 — only its stale
      top-level README referencing Next.js needed fixing
- [x] Scaffold `apps/marketing-web` (Astro) — done 2026-07-20, needs
      real content (currently placeholder pages)
- [x] Install dependencies with `pnpm install` — done 2026-07-20, lockfile
      already up to date
- [x] Start local infra with `docker compose up -d` — done 2026-07-20,
      postgres + redis healthy
- [x] Confirm API health endpoint works — done 2026-07-20, `pnpm dev:api`
      boots all 15 domain modules, `GET /health` and `GET /api/v1/modules`
      both respond
- [x] Create Drizzle schema for shared foundation — done 2026-07-20:
      `packages/database/src/schema/shared/index.ts`, all 13 tables from
      DATA_MODEL.md's Shared Foundation section
- [x] Add database migrations — done 2026-07-20:
      `packages/database/src/migrations/0000_shared_foundation.sql`
- [x] Add Postgres Row-Level Security policy in the same migration as
      every tenant-scoped table (Engineering Charter rule, not a
      follow-up task) — done 2026-07-20, hand-written into the same
      migration file (see its header comment for why, not drizzle-kit
      generated). Found and fixed a real gap while verifying: the
      `pos_user` role Docker's Postgres image creates from `POSTGRES_USER`
      is a cluster **superuser**, which unconditionally bypasses RLS
      regardless of `FORCE ROW LEVEL SECURITY` — the API now connects as a
      second, low-privilege `pos_app` role instead (`infra/postgres/init.sql`,
      `APP_DATABASE_URL`); see `docs/architecture/infrastructure.md`
      "Secrets Management" for the full explanation. Verified with a live
      cross-tenant SELECT/UPDATE/DELETE test against `pos_app`.
- [x] Add tenant context middleware — done 2026-07-20:
      `apps/api/src/core/tenant/` — JWT-derived `authContext` per request,
      `TenantDbService` wraps every query in `SET LOCAL
      app.current_organization_id` via `set_config(...)` (parameterized,
      not string-interpolated)
- [x] Add auth and PIN login — done 2026-07-20:
      `apps/api/src/core/auth/` — owner/admin email+password
      (argon2id) and staff PIN login (verified against every active
      staff row at the claimed location, since PINs are too short to
      index), both issuing short-lived JWTs; `GET /auth/me` returns the
      caller's resolved permissions
- [x] Add permission checks — done 2026-07-20:
      `apps/api/src/core/permissions/` — `@RequirePermission(...)` +
      `PermissionsGuard`, resolved live against DB `role_permissions` /
      `staff_roles` every request (not baked into the JWT, so a role
      change takes effect immediately)
- [x] Add audit log writer — done 2026-07-20:
      `apps/api/src/core/audit/audit-log.service.ts`, wired into every
      auth event (success and failure). `audit_logs` is enforced
      append-only by both RLS (no UPDATE/DELETE policy) and a trigger that
      rejects both outright, independent of RLS.
- [x] Add seed data for one restaurant — done 2026-07-20:
      `packages/database/src/seed/index.ts` (idempotent, `pnpm db:seed`
      from `packages/database`) — seeds the system role/permission
      catalog plus one demo organization ("Izzi Brunch and Cake") with an
      owner login, two staff PINs at different permission tiers, and a
      device
- [x] Close the P2 gap BUILD_WORKFLOW.md's acceptance gate actually
      requires (refresh tokens, logout, device activation, manager-override
      approvals) — done 2026-07-20: `auth_sessions` table + `pnpm
      db:migrate` (0001_p2_sessions_and_approvals.sql, RLS included);
      `POST /auth/refresh` and `POST /auth/logout` (`core/auth/jwt.ts`
      signed refresh JWT + DB-backed session row, rotated every refresh,
      revocable on logout); `POST /auth/device/activate` gated on a new
      `devices:activate` permission; `RequirePermission(key, {
      allowOverride: true })` on `PermissionsGuard` — a missing permission
      either 403s (`permission_denied`, audited) or, when the route allows
      override, creates a pending `approval_requests` row and responds
      `202`; `POST /api/v1/approvals/:id/approve|reject` resolve it
      (resolver must hold the permission themselves, can't self-approve);
      the requester's retry spends the approval exactly once via
      `X-Approval-Request-Id` + `approval_requests.consumed_at`
      (`ApprovalsService.tryConsume`, atomic compare-and-set). First real
      override-gated action: `POST /api/v1/staff/:id/deactivate` /
      `reactivate` (new `core/staff` module, `staff:deactivate`
      permission) — master plan Module 2 explicitly names both "staff
      deactivation" and "delete or deactivate record" as approval-requiring,
      so this closes that module gap too, not just a synthetic demo route.
      Full flow verified against the real running stack (`docker compose
      up -d`, real Postgres): waiter-tier actor denied/overridden with an
      audit row for every deny/request/approve/consume, manager approves,
      retry succeeds, replay of a spent approval creates a fresh pending
      request rather than silently failing or double-spending. Response
      envelope note: `{data, meta}` (master plan section 26) still isn't
      implemented anywhere in the API, including these new endpoints — no
      endpoint has it yet, so this doesn't introduce a one-off
      inconsistency, but it's a real gap the first phase to add a global
      response interceptor should close.

## Phase 1: Restaurant MVP

- [x] Products and categories — done 2026-07-20 (BUILD_WORKFLOW.md P3):
      `apps/api/src/modules/products/` — `menus`/`menu_categories`/`products`
      Drizzle schema + RLS + pg_trgm trigram search index
      (`packages/database/src/migrations/0002_p3_menu_catalog.sql`),
      `GET/POST /menus`, `GET/POST/PATCH /categories`,
      `GET/POST/PATCH /products`, `GET /products/:id/price-history`. Prices
      are never overwritten in place — `POST /products/:id/price` closes the
      current `product_prices` row (enforced by a partial unique index, one
      active row per product) and inserts a new one; a jump beyond a
      per-tenant-configurable threshold (`tenant_settings` key
      `price_change_approval_threshold_pct`, `TenantSettingsService`)
      requires genuine owner sign-off via the P2 approval-request flow
      (`products:approve_large_price_change`, withheld from branch_manager
      even though that role otherwise gets the full permission set — the
      point is a peer manager can't self-approve). `POST
      /products/:id/mark-unavailable` / `mark-available` (86'ing, permission
      `products:toggle_availability`, granted broadly per PRD 03's
      permissions table down to chef) is separate from the product's
      lifecycle `status` enum. New permissions seeded:
      `products:manage`/`products:toggle_availability`/`products:view_price_history`/`products:approve_large_price_change`.
      Found and fixed a real pre-existing bug while verifying the owner-approval
      path live: `approval_requests.approved_by_staff_id`/`requested_by_staff_id`
      had an FK to `staff` only, so a `users`-table owner could never resolve
      an approval — renamed to `approved_by_actor_id`/`requested_by_actor_id`
      with no FK (same dual-target pattern as `audit_logs.actor_id`),
      `packages/database/src/migrations/0003_fix_approval_actor_fk.sql`.
      Full flow verified against the real running stack: manager creates a
      category, a product with two modifier groups, marks it unavailable,
      searches finds it by local-language name in ~20ms; small price change
      applies immediately, large one returns 202 and only applies after the
      owner approves and the manager retries with the approval header
      (self-approval rejected, replay of a spent approval requires a fresh
      one); cashier/chef PIN logins confirmed against the PRD's permission
      matrix (86 allowed, manage/price-history denied).
- [x] Menu modifiers — done 2026-07-20, same P3 work: reusable
      `modifier_groups`/`modifiers` (min/max selection rules), attached to
      products via `product_modifier_groups`
      (`GET/POST/PATCH /modifier-groups`, nested modifier creation in one
      call). Never hard-deleted — `discontinued` status instead, per PRD 03.
- [x] Floor plans and tables — done 2026-07-20 (BUILD_WORKFLOW.md P4):
      `apps/api/src/modules/restaurant/` — `floor_plans`/`restaurant_tables`/
      `table_merges` Drizzle schema + RLS
      (`packages/database/src/migrations/0004_p4_floor_plan_tables.sql`),
      `GET/POST /floor-plans`, `PATCH /floor-plans/:id`,
      `GET/POST/PATCH /tables`, `PATCH /tables/:id/status`,
      `POST /tables/merge`, `POST /tables/:id/unmerge`,
      `POST /tables/:id/transfer`. Table state machine and its legal-transition
      graph (`TABLE_STATE_TRANSITIONS`) live in `packages/domain` as the single
      source of truth PRD 04's exact machine (`available → seated → ordered →
      food_ready → eating → bill_requested → payment_pending → paid →
      cleaning`, plus `reserved`/`blocked` reachable from any state and the
      `bill_requested`/`payment_pending → eating` reopen edge case). Illegal
      transitions are a domain `BadRequestException` (`illegal_table_transition`),
      never a 500. New permissions: `tables:manage` (seat/status/merge/split/
      transfer within one's own section — waiter+), `tables:manage_any_section`
      (cross-section escalation — supervisor+), `tables:block` (its own gate,
      per PRD 04's permission table), `tables:edit_layout` (branch_manager+
      only). "Own section" is enforced by comparing `assignedStaffId` against
      the caller, not a separate section-registry table; seating an unassigned
      table auto-claims it for whoever seats it. Party size is a soft capacity
      warning (`overCapacity` flag in the response), never a hard block —
      African hospitality routinely seats above nominal capacity. "Split" at
      this phase is ending an active merge (`table_merges.unmergedAt`) — actual
      bill-splitting is PRD 05/order-engine scope, explicitly out of P4 per
      that PRD's Non-Goals. `restaurant_tables.orderId` / `table_merges.orderId`
      are forward-reference columns (no FK yet, same pattern as
      `products.taxCategoryId`) for P5 to populate once `orders` exists.
      Seed data: two waiters (`Waiter One`/`Waiter Two`, PINs 1111/2222) and a
      3-table demo floor plan, so the "own section" permission check has a
      real second waiter to deny against.

      While verifying this end-to-end against the real running stack, found
      and fixed a critical **pre-existing, codebase-wide bug**: the global
      `ValidationPipe` (main.ts) silently validated nothing on any endpoint,
      in any module, ever — confirmed live (`POST /auth/owner/login` with `{}`
      reached `AuthService` with `undefined` fields and threw an unhandled
      `TypeError` instead of a 400). Root cause: Nest's `ValidationPipe`
      determines which DTO class to validate a `@Body()` against by reading
      `design:paramtypes` reflection metadata off the controller method, and
      esbuild (tsx's transform — every `dev` script in this monorepo runs on
      tsx) never emits that metadata for method parameters, so the metatype
      Nest read back was always `undefined` and its `toValidate()` guard
      skipped validation outright. Fixed with a new
      `apps/api/src/core/validation/validated-body.decorator.ts`
      (`ValidatedBody(DtoClass)`) that passes the DTO class explicitly instead
      of relying on reflection — validates identically under tsx, ts-node, or
      a compiled build. Applied to all 21 `@Body()` call sites across all 8
      existing controllers (auth, categories, modifier-groups, products,
      menus, floor-plans, tables), not just the new P4 endpoints — bare
      `@Body()` no longer appears anywhere in the codebase. Verified live
      after the fix: malformed bodies now correctly 400 with per-field
      `class-validator` messages on every affected route.
- [x] Orders and order items — done 2026-07-20 (BUILD_WORKFLOW.md P5, the
      order-engine center of gravity every later channel produces into):
      `apps/api/src/modules/orders/` — `orders`/`order_items`/
      `order_item_modifiers`/`order_discounts`/`bills`/`bill_items` Drizzle
      schema + RLS (`packages/database/src/migrations/0005_p5_order_engine_core.sql`),
      order/order-item/bill state machines + transition graphs added to
      `packages/domain` (`ORDER_STATUS_TRANSITIONS`,
      `ORDER_ITEM_STATUS_TRANSITIONS`, `BILL_STATUS_TRANSITIONS`) as the same
      single source of truth pattern P4's table state machine established.
      `POST /orders`, `GET /orders(/:id)`, `POST /orders/:id/items`,
      `PATCH /orders/:id/items/:item_id` (field edits pre-send, or
      voided/comped/served via its `status` field), `POST /orders/:id/send`,
      `POST /orders/:id/discounts`, `POST /orders/:id/split`,
      `POST /orders/:id/void`, `POST /orders/:id/close`. Order items snapshot
      product name/price and modifier name/price at add time — never a live
      join (PRD 05 Business Rules) — and an order already carrying an active
      bill requires new items to name a `billId` explicitly (PRD 05 edge
      case), never defaulted onto "bill 1". Voids/comps/discounts reuse
      P3's changePrice shape: a pre-send void is immediate
      (`orders:void_item`, waiter-level); anything sent, already-served, or a
      comp needs `orders:void_bill` directly or a manager-approved
      `orders:void_after_send`/`orders:comp_item`/
      `orders:discount_above_threshold` approval request
      (`tenant_settings` key `order_discount_large_threshold_pct`, default
      15%) — these three action keys had to become real seeded permissions,
      not just service-level constants, once live testing showed
      `ApprovalsController.resolve` requires the *resolver* to literally hold
      a permission matching the approval's `action` string. Split supports
      by-item/by-seat/evenly (remainder cents to the earliest bills,
      deterministic); split and send both attempt the table's
      P4-established state transitions (`ordered`, `bill_requested`) and
      silently no-op when the table's current state doesn't legally allow it
      yet, rather than erroring the order action. Populated the
      `restaurant_tables.orderId` / order-status forward-reference gaps P4
      explicitly left for this phase to fill. `POST /orders/:id/close`
      deliberately stops at validating every bill is `paid` — PRD 05 hands
      payment capture itself to P7, so the positive path isn't reachable
      until Cash/M-Pesa payments exist; the negative path (rejecting close
      while bills are unpaid, with an honest "P7 not yet built" message) is
      real and was verified live. `tax_amount`/`service_charge_amount` stay 0
      — Module 18's country tax adapter doesn't exist yet, same forward-
      reference gap as `order_items.taxCategoryId`.
      Full flow verified against the real running stack: waiter opens a
      table, adds two items across two courses (with a modifier) as one
      waiter's order, sends to kitchen (table auto-`ordered`), a waiter's
      attempt to void the already-sent item correctly 202s pending, the
      branch manager approves it, and the waiter's retry with the approval
      header both voids the item and recomputes order totals correctly; a
      10% item discount applied directly (below threshold); a whole-order
      void is 403'd for the waiter (missing `orders:void_bill`) and succeeds
      for the manager, and a second void attempt on the same order correctly
      400s as an illegal transition from `voided`; a fresh order split
      evenly two ways with an exact remainder-free amount correctly carries
      `order.status` to `bill_requested`; closing while bills are still
      `open` correctly 400s; a manager comp zeroes an item's net contribution
      and a subsequent void attempt on the now-`comped` item correctly 400s
      as illegal; adding a new item to an already-split order without a
      `billId` correctly 400s. Kitchen ticket routing/acknowledgment,
      "served" order-level aggregation across all items, and payment capture
      are explicitly out of scope here — P6/P7's jobs, next.
- [x] Kitchen tickets — done 2026-07-22 (BUILD_WORKFLOW.md P6): `apps/api/src/modules/restaurant/kds.service.ts` + `kds.controller.ts`, `packages/database/src/migrations/0006_p6_kitchen_kds.sql`, `apps/kds-web/src/app/main.tsx`. Added `kds_stations` / `kitchen_tickets` / `kitchen_ticket_items` schema + RLS + seed data; order fire now creates station-routed tickets from the existing P3 category/product station mapping; expo combines one order across multiple stations; queue responses expose batched identical items for one-pass cooking and visible `attentionFlags` for allergy notes; ticket-item accept/start/bump/recall and whole-ticket `bump-all` sync parent `order_items` and aggregate order readiness (`sent_to_kitchen` → `partially_ready` / `ready`) back into P5; post-send voids now pause in `void_requested` until kitchen acknowledgement (`POST /api/v1/kds/tickets/:ticketItemId/acknowledge-void`) instead of silently disappearing. Printable fallback path: `GET /api/v1/kds/stations/:stationId/printable-tickets` emits a legible plain-text ticket block from the same routing data rather than duplicating printer logic. `apps/kds-web` now has a real owner-login-based KDS surface (station queue, expo, analytics, batching, allergy badges, print view, item actions, token persistence). Verified live against the real stack: one order with two products routed to `hot_kitchen` and `cold_station` produced two station tickets plus one combined expo entry; bumping both tickets drove both parent order items and the order itself to `ready`; recall downgraded a ready item back to `in_progress` / order back to `sent_to_kitchen`; printable fallback returned the expected text block for the cold-station ticket; repeated identical items appear consolidated in the `batches` payload.
- [x] Cash payments — done 2026-07-22 (BUILD_WORKFLOW.md P7): `apps/api/src/modules/payments/`,
      `packages/integrations/src/payments/`, `packages/database/src/migrations/0007_p7_payments_core.sql`.
      Full P7 Payments Core: `integration_connections` (encrypted per-tenant credentials, AES-256-GCM
      via `packages/database/src/security/encrypt.ts`), `payment_intents`, `payments`, `refunds`, `tips`
      schema + RLS; `IdempotencyService` (unique key per org enforced at DB level); `CashAdapter`
      (immediate offline confirm, change calculation), `MpesaAdapter` (Daraja STK push, org-scoped
      shortcode/till, 5-min TTL, Module 18 fraud check on webhook confirmation),
      `PaystackAdapter` (card + Pesalink bank transfer, HMAC-SHA512 webhook signature verification),
      `ManualAdapter` (card terminal slip + manual bank transfer, manager-gated); split-payment support
      (multiple payments per bill, bill auto-paid when confirmed sum >= total, order auto-closed when
      all bills paid — completing P5's explicit handoff gap); refunds (approval-gated per P2 flow,
      never modifies original payment row); tips (linked payment + staff, not merged into bill total);
      9 new permissions seeded across all roles. Verified: 23/23 monorepo typechecks pass, migration
      applied with all 5 tables + RLS confirmed live, API boots with all 12 P7 routes mapped.
- [x] M-Pesa payment intent flow — done 2026-07-22, see above (P7 work item).
- [x] KRA eTIMS receipt compliance — done 2026-07-23 (BUILD_WORKFLOW.md P9, master plan Module 18):
      `apps/api/src/modules/notifications/`, `packages/integrations/src/tax/`,
      `packages/integrations/src/messaging/`,
      `packages/database/src/migrations/0009_p9_receipts.sql`.
      Receipt generation triggers on bill settlement (P7 handoff), KRA eTIMS
      sub adapter, WhatsApp/SMS/Email/print delivery adapters,
      `receipts`/`tax_compliance_submissions`/`notification_preferences` tables.
- [x] Receipts — done 2026-07-23 (BUILD_WORKFLOW.md P9): receipt generation,
      delivery via WhatsApp/SMS/Email/print, BullMQ worker for async delivery
      with retry, 5 new permissions seeded, `POST /receipts/:billId/generate`,
      `POST /receipts/:id/send`, `GET /receipts/:id/status`,
      `POST /receipts/:id/submit-tax`, `POST/GET /notifications/preferences`.
- [x] Shift open and close — done 2026-07-22 (P8)
- [x] Basic sales report — done 2026-07-22 (P8 shift report)
- [ ] POS local SQLite schema (P10 — feature/p10-offline-sync)
- [ ] PowerSync project setup and sync rules (P10 — feature/p10-offline-sync)
- [ ] Offline operation log + upload-queue handler (P10 — feature/p10-offline-sync)

## Phase 2: Restaurant Operations

- [x] Inventory items — done 2026-07-23 (P11, 14 tables: suppliers, inventory_items,
      stock_locations, stock_levels, stock_movements, purchase_orders,
      purchase_order_items, goods_receipts, stock_counts, stock_adjustments,
      recipes, recipe_ingredients, wastage_events)
- [x] Stock movements — done 2026-07-23 (append-only ledger, movement types:
      receive, sale, recipe_deduction, transfer_out/in, adjustment, wastage, return)
- [x] Purchase orders — done 2026-07-23 (draft/sent/partially_received/received lifecycle,
      goods receipt with discrepancy flagging)
- [x] Recipes — done 2026-07-23 (versioned recipes with effective dating,
      recipe_ingredients for deduction-quantity snapshot at order time)
- [x] Wastage — done 2026-07-23 (wastage_events with reason and cost impact,
      creates stock_movement of type wastage)
- [ ] Staff attendance
- [ ] Customer profiles
- [ ] Loyalty basics
- [ ] WhatsApp receipts
- [ ] Manager approvals

## Later

- [ ] AI daily briefing
- [ ] Revenue forecasting
- [ ] Demand forecasting
- [ ] Stockout prediction
- [ ] Developer platform: public API, OAuth apps, webhooks, app
      marketplace, SDKs (BUILD_WORKFLOW.md P19)
- [ ] Hotel OS
- [ ] Retail OS

