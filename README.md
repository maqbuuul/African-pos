# African Hospitality OS

AI-powered Hospitality and Commerce Operating System for Africa.

This repository is being rebuilt around a restaurant-first strategy:

1. Build the shared platform foundation.
2. Ship Restaurant OS first.
3. Add AI, ML, BI, and operational depth.
4. Add Hotel OS later.
5. Add Retail OS later.

The old scaffold and research docs are preserved in `archive/legacy-2026-07-17/`.

## Canonical Plan

Read [ENGINEERING_CHARTER.md](./ENGINEERING_CHARTER.md) first — it explains
how this document set fits together and the standing rules every other
document and every line of code must follow. Then
[HOSPITALITY_OS_MASTER_PLAN.md](./HOSPITALITY_OS_MASTER_PLAN.md).

Supporting development docs:

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md) — local setup, branch/commit
  conventions, docstrings, PR/code review workflow for anyone joining
  the project
- [DATA_MODEL.md](./DATA_MODEL.md)
- [BUILD_WORKFLOW.md](./BUILD_WORKFLOW.md) — Restaurant OS phase-by-phase
  build order and acceptance gates (P0–P19), including table ordering,
  Kenya tax compliance (eTIMS), Shopify, WooCommerce, delivery platform
  integrations, and the public developer platform (API, OAuth apps,
  webhooks, marketplace)
- [BUILD_WORKFLOW_HOTEL.md](./BUILD_WORKFLOW_HOTEL.md) (`H1`–`H9`) and
  [BUILD_WORKFLOW_RETAIL.md](./BUILD_WORKFLOW_RETAIL.md) (`R1`–`R7`) —
  same format, for Hotel OS and Retail OS once they enter the build
  queue
- [docs/adr/](./docs/adr/) — Architecture Decision Records, starting with
  [0001-tech-stack.md](./docs/adr/0001-tech-stack.md)
- [docs/prd/](./docs/prd/) — one Product Requirements Document per
  `BUILD_WORKFLOW.md` phase (P1–P19): workflows, screen-by-screen UI
  behavior, permissions, business rules, edge cases, events, and
  acceptance criteria for every Restaurant OS module, plus
  [docs/prd/hotel/](./docs/prd/hotel/) and
  [docs/prd/retail/](./docs/prd/retail/) for those verticals, phase-
  sequenced by the two build workflow docs above but still lower
  confidence than Restaurant OS since neither vertical has been built
  yet (see `docs/prd/README.md`). Start at
  [docs/prd/README.md](./docs/prd/README.md) for the index and template.
- [docs/frontend-plan.md](./docs/frontend-plan.md) — the canonical
  frontend build plan: role→app surface matrix, per-app screen flows, and
  build order for every FOH and BOH frontend
- [docs/architecture/](./docs/architecture/) — cross-cutting technical
  volumes: [api-specification.md](./docs/architecture/api-specification.md),
  [frontend-design-system.md](./docs/architecture/frontend-design-system.md),
  [infrastructure.md](./docs/architecture/infrastructure.md),
  [data-platform.md](./docs/architecture/data-platform.md),
  [event-catalog.md](./docs/architecture/event-catalog.md)
- [ENGINEERING_HANDBOOK.md](./ENGINEERING_HANDBOOK.md) — coding
  conventions, git workflow, PR/code review checklist, testing and
  release process
- [GTM_PLAYBOOK.md](./GTM_PLAYBOOK.md) — channel strategy, onboarding/
  activation, sales motion, customer success (first-hypothesis status,
  unlike the engineering docs above — see the document's own Scope
  section)
- [TODO.md](./TODO.md)

## Stack

```text
TypeScript runs the business.
Python runs the intelligence.
PostgreSQL protects the truth.
SQLite protects the frontline.
ClickHouse powers analytics once scale arrives.
```

Full rationale and alternatives considered: [docs/adr/0001-tech-stack.md](./docs/adr/0001-tech-stack.md).

Core choices — this is the stack's end state; see
[docs/adr/0001-tech-stack.md](./docs/adr/0001-tech-stack.md) for what
actually runs on day one versus what's added only when a build phase
needs it:

- Monorepo: pnpm + Turborepo
- Operational API: NestJS + TypeScript
- ORM: Drizzle
- Main database: PostgreSQL, hosted on Neon (managed, no self-hosted
  backups/patching), Row-Level Security for tenant isolation
- Offline POS database: SQLite, synced via PowerSync (added at build
  phase P11, not day one)
- Real-time: NestJS WebSocket Gateways (Socket.io)
- Background jobs: Redis + BullMQ
- Search: Postgres full-text search (`pg_trgm`) first; Meilisearch added
  only once that's insufficient
- Internal apps (owner/manager/admin/KDS/developer portal): React + Vite
- Customer ordering apps (QR/online ordering, booking, loyalty wallet): React + Vite, bandwidth-budgeted
- Public marketing/docs site: Astro
- Mobile POS: React Native (bare/dev-client workflow, not managed Expo Go)
- AI/ML service: Python + FastAPI
- Analytics: Postgres outbox → ClickHouse, dbt for transforms
- Storage: Cloudflare R2
- App hosting: Fly.io or Hetzner + Coolify (Docker, no Kubernetes until justified)
- CI/CD: GitHub Actions

Every deployable app/service has its own multi-stage `Dockerfile`
(`dev`/`prod` targets) — this is the real production deploy unit, not
optional local sugar. `docker compose up -d` runs shared infra only
(Postgres, Redis); `docker compose --profile full-stack up -d --build`
builds and runs the whole system in containers. See CONTRIBUTING.md's
"Running The Whole Stack In Docker" section.

## First Product

The first product is Restaurant OS:

- POS
- Tables
- KDS
- Orders
- Payments
- Receipts
- Shifts
- Staff
- Inventory basics
- Customers
- Reports
- Offline sync
- Kenya tax compliance (KRA eTIMS)
- Developer platform (public API, webhooks, app marketplace) — later
  phase, see BUILD_WORKFLOW.md P19

