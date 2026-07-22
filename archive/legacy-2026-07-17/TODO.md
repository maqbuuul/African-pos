# Daily TODO — African POS Restaurant OS

> Update every morning. One day at a time.
> See `TIMETABLE.md` for the full plan. See `ARCHITECTURE.md` for technical decisions.

---

## WEEK 1 — FOUNDATION

### ✅ Tuesday June 24 — DONE
- [x] Monorepo structure (Turborepo + pnpm workspaces)
- [x] Docker Compose — PostgreSQL 16, Redis 7, Meilisearch, API, Worker, ML
- [x] App scaffolds — api, worker, manager, dashboard, pos, ml
- [x] Shared package — Zod types, constants, utils
- [x] TIMETABLE.md, TODO.md, ARCHITECTURE.md updated

---

### 🔴 Wednesday June 25 (TODAY) — Database Schema

**Goal: Every table from ARCHITECTURE.md §6.2 exists in Postgres. Migrations run clean.**

**Before you start:**
- [ ] Copy `.env.example` → `.env` (no external keys needed yet — local only)
- [ ] `pnpm install` — verify no errors
- [ ] `docker compose up -d` — verify all services healthy
- [ ] `curl http://localhost:3000/health` → `{"data":{"status":"ok"},...}`

**Schema files to create in `apps/api/src/shared/database/schema/`:**

- [ ] `users.ts` — `users`, `organizations`
- [ ] `businesses.ts` — `businesses`, `locations`
- [ ] `staff.ts` — `staff`, `sessions`
- [ ] `products.ts` — `categories`, `products`, `product_stock`, `price_books`, `price_book_items`
- [ ] `orders.ts` — `orders`, `order_items`
- [ ] `payments.ts` — `payments`
- [ ] `customers.ts` — `customers`, `loyalty_events`, `credit_transactions`
- [ ] `restaurant.ts` — `restaurant_tables`, `reservations`, `kds_stations`
- [ ] `inventory.ts` — `suppliers`, `purchase_orders`, `stock_adjustments`, `recipes`, `recipe_ingredients`
- [ ] `audit.ts` — `audit_log`
- [ ] `tax.ts` — `etims_submissions`
- [ ] `automations.ts` — `automation_rules`
- [ ] Update `schema/index.ts` to export all above

**New tables vs ARCHITECTURE.md (added today for restaurant-only focus):**
- [ ] `recipes` — product_id + name + serving_size
- [ ] `recipe_ingredients` — recipe_id + ingredient name + quantity + unit + cost_per_unit
- [ ] `staff_schedules` — staff_id + location_id + shift_start + shift_end
- [ ] `staff_loans` — staff_id + amount + reason + repaid_amount
- [ ] `gift_cards` — code + business_id + amount + balance + issued_to_customer_id
- [ ] `customer_feedback` — customer_id + order_id + rating + comment + created_at
- [ ] `catering_orders` — links to orders, event_date, deposit_paid, production_notes
- [ ] `cash_float_sessions` — location_id + shift_date + opening_amount + closing_amount

**Migrations:**
- [ ] `pnpm --filter=api db:generate` — generates SQL migration
- [ ] `pnpm --filter=api db:migrate` — applies to local Postgres
- [ ] Verify in psql: `\dt` shows all tables
- [ ] Enable RLS on all tenanted tables
- [ ] Create all indexes (ARCHITECTURE.md §5.3) + new indexes for recipes, schedules

**Analytics (do while waiting for migrations):**
- [ ] Create PostHog Cloud account at posthog.com (free tier, no credit card)
- [ ] Copy Project API Key → add to `.env` as `VITE_POSTHOG_KEY=phc_...`
- [ ] Create Firebase project at console.firebase.google.com
- [ ] Download `google-services.json` → save to `apps/pos/android/app/`

**Commit:** `"feat: complete database schema — all restaurant tables, RLS, indexes"`

---

### Thursday June 26 — Auth Module

**Goal: PIN login works. JWT returned. Protected routes work.**

- [ ] `apps/api/src/modules/auth/auth.schema.ts` — Zod schemas
- [ ] `apps/api/src/modules/auth/auth.service.ts` — PIN verify, bcrypt, JWT sign
- [ ] `apps/api/src/modules/auth/auth.routes.ts` — Fastify route registrations
- [ ] `POST /api/v1/auth/pin` — verifies 4-digit PIN, returns `{ access_token, refresh_token }`
- [ ] `POST /api/v1/auth/refresh` — rotates refresh token
- [ ] `POST /api/v1/auth/logout` — deletes session
- [ ] `POST /api/v1/auth/otp/send` — sends WhatsApp OTP (stub — WhatsApp not connected yet)
- [ ] `apps/api/src/shared/auth/middleware.ts` — Fastify preHandler: validates JWT, sets `request.businessId`
- [ ] Tests: correct PIN → 200 + token. Wrong PIN → 401. Expired token → 401. Wrong business → 403
- [ ] Commit: `"feat: auth module — PIN login, JWT, refresh, session management"`

---

### Friday June 27 — Products API + Audit Log

**Goal: Products API works. Audit log built first. RLS verified.**

**Audit log first (never build a destructive endpoint without it):**
- [ ] `apps/api/src/modules/audit/audit.service.ts`
  - `log({ businessId, staffId, action, entityType, entityId, oldValue, newValue, reason })`
  - Inserts to `audit_log`. Never throws — logs its own errors to Pino.

**Products API:**
- [ ] `GET /api/v1/products` — cursor-paginated list for business
- [ ] `GET /api/v1/products/:id` — single product
- [ ] `POST /api/v1/products` — create (admin:write)
- [ ] `PUT /api/v1/products/:id` — update (admin:write) + audit log
- [ ] `DELETE /api/v1/products/:id` — soft delete, sets `deleted_at` (admin:write) + audit log
- [ ] `POST /api/v1/products/:id/86` — mark unavailable for service (manager:write)
- [ ] `GET /api/v1/categories` — list categories for business
- [ ] `POST /api/v1/categories` — create category (admin:write)

**RLS verification test:**
- [ ] Create 2 businesses (A and B) with test tokens
- [ ] Confirm: token A cannot see products from business B (403 from RLS, not app layer)

**Analytics — wire PostHog into API:**
- [ ] `pnpm --filter=api add posthog-node`
- [ ] Create `apps/api/src/shared/analytics/client.ts`
- [ ] Capture first server-side event: `product_created` after POST /products

**Weekly review (Friday evening):**
- [ ] `docker compose up` starts clean from scratch?
- [ ] All migrations run?
- [ ] `POST /auth/pin` returns JWT?
- [ ] `GET /products` returns data (with RLS)?
- [ ] PostHog receiving events?
- [ ] Any blockers for Week 2?

**Commit:** `"feat: products API + categories + audit log + PostHog server-side"`

---

## WEEK 2 PREVIEW (June 30 – July 4) — Orders

- Orders API: create order, add items, update status, course management
- Customers API: create by phone, auto-create on M-Pesa payment
- Cash payment flow
- POS App: PIN login + product grid + cart + checkout
- Start: `apps/api/src/modules/orders/`, `modules/customers/`, `modules/payments/`

---

## BACKLOG — When Time Allows

- [ ] ESLint config (`eslint-config-turbo` + strict rules)
- [ ] Prettier config (root `.prettierrc`)
- [ ] Husky pre-commit hook (`pnpm husky init`)
- [ ] GitHub Actions CI (typecheck + test on push)
- [ ] Playwright E2E setup (manager + dashboard)
- [ ] Swagger UI at `/docs` (`@fastify/swagger-ui`)
- [ ] Rate limiting on auth routes (10 req/min per IP)
- [ ] Sentry DSN configured in API + worker
- [ ] Meilisearch product index (for fast product search in POS)
- [ ] `posthog-js` integrated in manager app (install is done — just needs `posthog.init()`)
- [ ] Firebase Analytics first events in POS app
