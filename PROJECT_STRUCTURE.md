# Project Structure

This repo is organized as a monorepo. The product starts with Restaurant OS,
while the shared platform is designed for Hotel OS and Retail OS later.

```text
.
├── README.md
├── CONTRIBUTING.md
├── ENGINEERING_CHARTER.md
├── HOSPITALITY_OS_MASTER_PLAN.md
├── BUILD_WORKFLOW.md
├── BUILD_WORKFLOW_HOTEL.md
├── BUILD_WORKFLOW_RETAIL.md
├── DATA_MODEL.md
├── ENGINEERING_HANDBOOK.md
├── GTM_PLAYBOOK.md
├── PROJECT_STRUCTURE.md
├── TODO.md
├── apps/
│   ├── api/
│   ├── pos-mobile/
│   ├── manager-web/
│   ├── owner-web/
│   ├── kds-web/
│   ├── customer-web/
│   ├── marketing-web/
│   ├── admin-web/
│   ├── desktop-pos/
│   └── developer-portal/
├── services/
│   └── ai-ml/
├── packages/
│   ├── domain/
│   ├── database/
│   ├── api-client/
│   ├── offline-sync/
│   ├── integrations/
│   ├── ui/
│   └── config/
├── docs/
│   ├── adr/
│   ├── architecture/
│   └── prd/
│       ├── hotel/
│       └── retail/
├── infra/
├── scripts/
├── tests/
└── archive/
    ├── legacy-2026-07-17/    # previous scaffold + superseded research
    └── source-material/      # raw ideation transcript (chatgpt-chat.md)
```

See [README.md](./README.md) for the full annotated index of every root
document and what it covers — this file describes the repo's directory
layout, not the doc set's reading order.

## Apps

### `apps/api`

NestJS TypeScript modular monolith. This is the operational core. See
[docs/adr/0001-tech-stack.md](./docs/adr/0001-tech-stack.md) for why NestJS
over Fastify/Go/Elixir.

Owns:

- Auth
- Multi-tenancy
- Permissions
- Audit logs
- Restaurant workflows
- Orders
- Payments
- Inventory ledgers
- Offline sync
- Reports
- Developer platform (public `/api/v1`, API keys, OAuth apps, webhooks —
  see `apps/developer-portal` for the companion console)

Later it also hosts Hotel OS and Retail OS modules behind the same shared
platform.

### `apps/pos-mobile`

React Native POS app, bare/dev-client workflow (not managed Expo Go — most
POS peripherals need native modules Expo Go doesn't support). This is the
frontline app.

Owns:

- PIN login
- Product grid
- Cart
- Tables
- Orders
- Payments
- Receipts
- Shifts
- Offline SQLite store, synced via PowerSync
- Upload queue for local writes (order/payment/audit operations — see
  `docs/adr/0001-tech-stack.md` decision 6)

### `apps/manager-web`

Vite React app for branch managers.

Owns:

- Approvals
- Live restaurant operations
- Staff
- Inventory
- Payments
- Reports
- Audit review

### `apps/owner-web`

Vite React app for owners and regional managers.

Owns:

- Executive dashboard
- Branch comparison
- Revenue and profit
- Customer intelligence
- Forecasts
- AI briefings

### `apps/kds-web`

Kitchen Display System.

Owns:

- Station tickets
- Timers
- Expo workflow
- Ready queue
- Kitchen status

### `apps/customer-web`

React + Vite customer-facing app, with an explicit performance budget
(small bundle, aggressive code splitting) since this is opened via QR-code
scans and direct links on cheap Android phones over patchy 3G/4G — not
reached via organic search, so Next.js's SSR/SEO strengths don't pay for
their weight here.

Owns:

- QR ordering
- Online ordering
- Receipts
- Feedback
- Loyalty wallet
- Hotel booking later

### `apps/marketing-web`

Astro public marketing site and docs. Separate from `customer-web`
because this surface *does* benefit from SEO/SSR and is mostly static
content — Astro ships near-zero JS by default, which a full Next.js app
wouldn't for content that's 95% static. See
`docs/adr/0001-tech-stack.md` decision 4.

### `apps/admin-web`

Internal support console.

Owns:

- Tenant support
- Device status
- Sync health
- Integration logs
- Feature flags
- Developer app review (scope justification, security checklist before a
  marketplace app is publicly listed — master plan Module 17)

### `apps/desktop-pos`

Future Tauri desktop POS. Intentionally not first.

### `apps/developer-portal`

React + Vite app for the public developer platform (BUILD_WORKFLOW.md P19,
master plan Module 17). Built last, after the internal API contract is
stable — see the P19 dependency note in BUILD_WORKFLOW.md.

Owns:

- App registration console (scopes, redirect URLs, webhook endpoints)
- OpenAPI-generated API reference and Postman collection
- Per-app usage analytics
- App marketplace listing/review/install flow
- Sandbox key and test-event management

## Services

### `services/ai-ml`

Python FastAPI service for intelligence.

Owns:

- Daily briefings
- Revenue forecasting
- Demand forecasting
- Stockout prediction
- Churn
- Recommendations
- Fraud/anomaly detection
- AI assistant tools

## Packages

### `packages/domain`

Shared business types and Zod schemas.

### `packages/database`

Drizzle schema, migrations, seed data, and database helpers.

### `packages/api-client`

Typed client for frontend apps and POS clients.

### `packages/offline-sync`

PowerSync client configuration and sync rules (device-side catalog/table
replication), plus the shared operation-log schemas, per-entity conflict
rules, and upload-queue contracts for the write path that PowerSync does
not cover. See `docs/adr/0001-tech-stack.md` decision 6 for the exact
split.

### `packages/integrations`

Payment, messaging, accounting, delivery, tax, storage, and hardware
adapters, all behind the one `ChannelAdapter`-shaped interface
(BUILD_WORKFLOW.md section 6). Tax adapters cover per-country compliance
(KRA eTIMS first, FIRS and SARS later — master plan Module 18).

### `packages/ui`

Shared web UI components.

### `packages/config`

Shared ports, constants, and environment helpers.

## Infra

Infrastructure is local-first in development. In production: Postgres on
Neon (managed), everything else on Fly.io or Hetzner + Coolify (Docker
containers, no Kubernetes until scale justifies it) — see
`docs/adr/0001-tech-stack.md` decision 9. Not everything below runs from
day one; see the ADR's rollout-sequencing table for what's introduced at
which build phase.

- PostgreSQL (Neon)
- Redis (from P9, first background job)
- PowerSync service (from P11, offline sync)
- Meilisearch (later — only once Postgres full-text search is
  insufficient)
- ClickHouse (later)
- Observability (later)

## Archive

- `archive/legacy-2026-07-17/` — the previous scaffold and the original
  21-file research set, both superseded by the current apps/packages
  layout and by `HOSPITALITY_OS_MASTER_PLAN.md` /
  `docs/architecture/` / `docs/prd/` respectively. The root-level
  `research/` copy of that same research set has been removed now that
  everything in it is consolidated into current docs — read it from
  here instead.
- `archive/source-material/chatgpt-chat.md` — the raw ideation
  transcript that `ENGINEERING_CHARTER.md` traces its Document 00
  origin back to.

Do not delete anything under `archive/` unless the project owner
explicitly asks.

