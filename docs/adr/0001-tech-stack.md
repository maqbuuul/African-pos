# ADR 0001: Core Technology Stack

- **Status:** Accepted
- **Date:** 2026-07-20
- **Supersedes:** The stack described in `README.md` and
  `HOSPITALITY_OS_MASTER_PLAN.md` section 12 as of 2026-07-18 (Fastify
  backend, Expo-managed mobile, Next.js for all public web surfaces,
  hand-rolled offline sync engine).
- **Decision owner:** Product owner, acting through Claude as CTO for this
  decision.

## Context

The repo was originally scaffolded around Fastify, Expo-managed React
Native, Next.js for every public-facing web surface, and a hand-built
operation-log offline-sync engine (see master plan section 27). Fewer than
25 backend TypeScript files existed when this ADR was written — the cost of
changing direction now is close to zero, and it will only rise from here.

The product owner explicitly rejected that stack without specifying a
replacement and asked for a deliberate, one-decision-at-a-time review of
every layer, done as if by a CTO responsible for a solo/small-team build
targeting African hospitality businesses specifically.

Constraints that shaped every decision below:

- **One builder, not a platform team.** Anything that requires maintaining
  a second language, a second ORM paradigm, or a hand-built distributed
  system is a tax on velocity that a bigger team could absorb but a small
  one cannot.
- **African hosting economics.** Thin margins, price-sensitive customers,
  and the need to keep infrastructure cost low argue against
  Kubernetes-first, multi-region-first, or anything with meaningful
  standing operational overhead.
- **Offline-first is non-negotiable.** A POS terminal that stops working
  when the network drops is a shipped defect for this market, not an edge
  case.
- **This system is unusually SQL/history-heavy.** Append-only ledgers,
  effective-dated price/recipe/menu history, row-level tenant isolation,
  and a future star-schema analytics layer all want a database layer that
  doesn't hide SQL behind a heavy abstraction.

## Decision

| Layer | Choice | Replaces |
| --- | --- | --- |
| Backend framework | **NestJS** (Node/TypeScript) | Fastify |
| Database / ORM | **PostgreSQL + Drizzle**, Postgres RLS for tenant isolation | (unchanged — reaffirmed) |
| Mobile | **React Native, bare/dev-client workflow** | Expo managed workflow |
| Internal web apps | **React + Vite** (owner/manager/admin/KDS/developer portal) | (unchanged — reaffirmed) |
| Customer-facing ordering apps | **React + Vite**, bandwidth-budgeted | Next.js |
| Public marketing/docs site | **Astro** | Next.js |
| Real-time | **NestJS WebSocket Gateways (Socket.io)** | (new — wasn't previously specified) |
| Domain events | **Postgres transactional outbox** | (unchanged — reaffirmed) |
| Background jobs | **BullMQ + Redis** | (unchanged — reaffirmed) |
| Offline sync | **PowerSync** (Postgres ↔ on-device SQLite sync engine) for the download/replication path | Hand-rolled `GET /sync/pull?cursor=` |
| AI/ML serving | **Python + FastAPI** | (unchanged — reaffirmed) |
| Analytics warehouse | **ClickHouse**, dbt for transforms | (unchanged — reaffirmed; Airflow/lakehouse formats deferred) |
| Search | **Postgres full-text search (`pg_trgm`)**, Meilisearch added only once that's insufficient | Meilisearch from day one (revised 2026-07-20) |
| Object storage | **Cloudflare R2** | (unchanged — reaffirmed) |
| Postgres hosting | **Neon** (or Supabase) — managed, no self-hosted backups/patching | "GCP or similar when scaling" (vague) |
| App compute | **Fly.io or Hetzner + Coolify**, Docker containers, no Kubernetes | "GCP or similar when scaling" (vague) |
| CI/CD | **GitHub Actions** | (unchanged — reaffirmed) |

See "Rollout sequencing" below decision 9 for what actually runs on day
one versus what's introduced only when a build phase needs it — the table
above is the stack's end state, not the starting footprint.

### 1. Backend — NestJS over Fastify, Go, and Elixir/Phoenix

**Alternatives considered:**

- *Go* — excellent raw performance and a single static-binary deploy story
  that would suit low-spec African hosting well. Rejected because its
  ORM/validation/DI ecosystem is meaningfully less mature than Node's,
  meaning more hand-written plumbing, and because it introduces a second
  language alongside the TypeScript frontend and mobile apps — a real cost
  for a solo builder, and one that buys nothing at this traffic scale.
- *Elixir/Phoenix* — the strongest option specifically for live,
  always-on operational state (KDS boards, table status, multi-terminal
  sync), which BEAM's actor model and per-process fault isolation handle
  natively. Rejected for now because the hiring pool and ecosystem are
  much smaller, the learning curve is real, and NestJS's WebSocket
  Gateways cover the near-term real-time needs (live KDS/table updates)
  without a new runtime. Revisit if per-branch fault isolation or
  massive concurrent-connection counts become an actual bottleneck.
- *Fastify* (previous choice) — fast and lightweight, but thinner
  structure than this domain needs: 24 modules (per master plan section
  6-9), DDD boundaries, and an eventual microservice-extraction path
  benefit from Nest's opinionated module/DI/guard system rather than
  assembling that structure by hand on top of a minimal framework.

**Consequence:** One language (TypeScript) now spans backend, both web
tiers, and mobile, so domain types, DTOs, and validation schemas
(`packages/domain`) can be shared end-to-end instead of re-declared per
service. Python is scoped exclusively to `services/ai-ml`.

### 2. Database — PostgreSQL + Drizzle (reaffirmed), RLS tenant isolation (reaffirmed)

**Alternatives considered:** Prisma and TypeORM, both of which pair more
natively with NestJS via existing integration packages. Rejected in favor
of Drizzle because this schema leans hard on raw-SQL territory — RLS
policies, effective-dated history tables (price history, recipe versions,
menu versions), append-only ledgers, and a future star schema for
ClickHouse export. Drizzle stays close to SQL instead of abstracting it
away, which matters when hand-tuning exactly those things. Prisma's
superior CRUD scaffolding DX doesn't offset that here.

**Consequence:** No official NestJS↔Drizzle integration package exists;
the module wiring (a Drizzle provider injected via Nest's DI container)
needs to be hand-built once, early, in `packages/database`.

### 3. Mobile — React Native (bare/dev-client) over Flutter, over Expo managed

**Alternatives considered:** Flutter was the unambiguous pick in the
source planning conversation, and the underlying reasoning is sound —
stronger POS-peripheral plugin ecosystem (thermal printers, barcode
scanners, card readers, NFC), and more predictable 60fps rendering for
kiosk-style screens. Rejected for this build specifically because it adds
a second language (Dart) for a solo builder, breaking the
type-sharing story described in decision 1. Revisit if/when there's a
dedicated mobile engineer, or if peripheral integration proves genuinely
harder in RN than expected.

Staying on Expo's **managed** workflow was also rejected: most real POS
peripherals (thermal printers, barcode/QR scanners, card readers, NFC
badge readers) require native modules that managed Expo doesn't support
without ejecting anyway. Starting on the bare/dev-client workflow from day
one avoids a forced, disruptive mid-project migration.

**Consequence:** Slightly more setup cost up front (native build tooling,
dev client builds) than Expo Go's zero-config start. That cost is paid
once, early, instead of paid later as a disruptive migration.

### 4. Web — React + Vite for internal/console surfaces and customer ordering; Astro for marketing/docs

**Alternatives considered:** Next.js (previous choice) for every
public-facing surface. Rejected as a blanket choice because it conflates
two different problems:

- QR ordering, online ordering, booking, loyalty wallet, digital
  receipts — these are reached via a QR-code scan, a direct link, or a
  WhatsApp message, not organic search. SEO/SSR buys little, and these
  apps are used disproportionately on cheap Android phones over patchy
  3G/4G in-restaurant, where bundle size and time-to-interactive matter
  far more than server rendering. React + Vite, with an explicit
  performance budget, fits better.
- The actual public marketing site and developer/API docs *do* benefit
  from SEO and fast, mostly-static content delivery. Astro is purpose-built
  for that — it ships near-zero JS by default — where Next.js would be
  carrying a full SSR framework for content that's 95% static.

**Consequence:** `apps/customer-web` moves from Next.js to React + Vite
with a defined performance budget (small bundle, aggressive code
splitting). A new `apps/marketing-web` (Astro) is added to the app
inventory for the public site and docs — not yet scaffolded as of this
ADR. `apps/developer-portal` moves from Next.js to React + Vite to match
the other console-style internal apps (it's an authenticated app-registration
console with embedded docs, not a primarily-SEO surface).

### 5. Real-time, events, and jobs

**Decision:** NestJS WebSocket Gateways (Socket.io) for live KDS/table
push updates; the existing Postgres transactional-outbox pattern for
durable cross-module domain events; BullMQ + Redis for background jobs.

**Alternatives considered:** Kafka, floated in the original planning chat
for "later." Rejected for now, explicitly on the chat's own advice against
over-engineering early — outbox + BullMQ comfortably covers thousands of
tenants. Introduce Kafka only when outbox-relay throughput is an actual,
measured bottleneck, not preemptively.

### 6. Offline sync — PowerSync over a fully hand-rolled operation-log engine

This is the highest-novelty, highest-risk-reduction decision in this ADR
and deserves the most precision, because it does **not** replace
everything in master plan section 27 — only the hardest half of it.

**What PowerSync replaces:** the download/replication path — the custom
`GET /sync/pull?cursor=` endpoint and the logic for streaming catalog,
price, table, and settings changes from Postgres down to on-device SQLite.
PowerSync handles this natively (Postgres → on-device SQLite sync rules,
per-tenant scoping compatible with the existing RLS model, automatic
reconnect/retry/backoff) — this is a genuinely hard distributed-systems
problem, and a solo builder hand-rolling it is a real project-risk item,
not a convenience shortcut.

**What stays exactly as specified:** the upload/write path. Local writes
(orders, order items, cash payments, tips, receipts, audit events) still
flow through an upload queue that calls the existing API, still carry the
`op_id` / `base_version` operation shape from master plan section 27, and
are still subject to the same per-entity conflict policy (append-only
merge for order items, stock movements instead of raw overwrites, server
wins for product config, phone-based customer merge, cash-vs-mobile-money
payment rules). PowerSync's client SDK provides the local queueing
mechanism; the business rules that decide what's valid remain fully
custom, implemented in `apps/api/src/modules/sync`.

**Alternatives considered:** ElectricSQL (similar Postgres-sync category,
less mature at evaluation time for this use case) and ELI5-level: continue
hand-rolling. Continuing to hand-roll was rejected because it means a
solo builder owns the hardest, least-differentiated part of the entire
system (bidirectional sync transport, connectivity detection, incremental
catalog replication) with no compounding product value — this is
plumbing, not something a hospitality-OS customer will ever notice or
value being custom-built.

**Consequence:** Master plan section 27 and `BUILD_WORKFLOW.md` P11 are
updated (see below) to mark the download/replication path as
PowerSync-provided, while leaving the operation-log write path and
conflict policy untouched. `packages/offline-sync` now also owns the
PowerSync client configuration and upload-queue handler, not a full
sync-protocol implementation.

### 7. AI/ML and data platform — reaffirmed with explicit sequencing discipline

Python + FastAPI stays for model serving. Postgres outbox → ClickHouse →
dbt stays as the analytics path. Airflow, Spark, and Bronze/Silver/Gold
lakehouse formats are explicitly **deferred** — not rejected, deferred —
until real data volume justifies the operational overhead. dbt running
directly against ClickHouse gets most of the value now at a fraction of
the operational cost.

### 8. Search — Meilisearch, deferred until search UX actually needs it (revised 2026-07-20)

**Revision:** the initial pass reaffirmed standing up Meilisearch alongside
everything else. On review this was more service than a solo builder
needs on day one. Postgres full-text search (`ILIKE` / `pg_trgm`) covers
menu/customer/invoice search adequately until typo-tolerance and ranking
quality become an actual, felt problem — at which point Meilisearch is a
drop-in addition, not a migration. No code or schema decision made now
depends on which one is running, so deferring costs nothing later.
Elasticsearch/OpenSearch remain rejected regardless — pure operational
burden with no upside at this scale.

### 9. Infrastructure — Neon for Postgres, Fly.io or Hetzner + Coolify for compute, over Kubernetes-first

**Alternatives considered:** the prior "GCP or similar when scaling"
language was vague enough to default toward heavier managed infrastructure
than a solo builder needs, and left Postgres hosting itself ambiguous
between managed and self-hosted. Resolved as two separate calls:

- **Postgres hosting:** Neon (or Supabase) over self-hosting on Hetzner.
  Self-hosting Postgres means owning backups, patching, and failover
  personally — real, ongoing attention with no product payoff. A managed
  Postgres provider removes that job entirely for negligible cost at this
  scale. Revisit only if egress/compute costs at real scale make
  self-hosting clearly cheaper.
- **App compute:** Fly.io (good latency characteristics, simple deploy
  model) or Hetzner + Coolify (self-hosted PaaS, lowest raw cost) — both
  explicitly chosen over Kubernetes for the same reason NestJS beat
  Elixir on the ops axis: this is a one-person operation, and Kubernetes'
  operational tax has no offsetting benefit yet. Graduate to managed
  Kubernetes only when scale genuinely demands it — consistent with the
  existing "Kubernetes later only when operationally justified" principle
  already in master plan section 12.

### Rollout sequencing — what runs day one vs. what gets added when a build phase needs it

The decisions above describe the stack's end state, not what a solo
builder stands up on day one. Reading them as one flat list overstates
the starting complexity. The actual rollout, tied to `BUILD_WORKFLOW.md`
phases:

| Layer | Introduced at | Not needed before that because |
| --- | --- | --- |
| NestJS, PostgreSQL, Drizzle, RLS, React + Vite, React Native (bare), R2, GitHub Actions, Neon, Fly.io/Hetzner | Day 1 | The product doesn't exist without them |
| Redis + BullMQ | First background job exists (P9 Receipts + notifications) | Nothing to queue before then |
| WebSocket Gateways | Whichever phase builds live KDS/table push | A page refresh suffices before that; adding a gateway later is one decorator, not new infrastructure |
| PowerSync | P11 Offline Sync, exactly | Development and testing run online against the API directly until this phase |
| Meilisearch | Whenever Postgres full-text search stops being good enough | See decision 8 above |
| ClickHouse + dbt | Whenever Postgres analytics queries genuinely struggle | Postgres directly until then (decision 7) |
| Astro marketing site | Whenever, no dependency on anything else | Zero product risk either way |
| Kubernetes, Kafka, Airflow | Not scheduled — introduced only if a measured bottleneck demands it | Never assumed; would be a new ADR if it happens |

Nothing in this table changes the end-state decisions above — it only
says when each piece earns a place in the running system, which is the
actual lever for keeping day-to-day complexity low without giving up the
scalability the end state provides.

## Consequences (summary)

- TypeScript spans backend, both web tiers, and mobile; Python is scoped
  to AI/ML only.
- PostgreSQL remains the single source of truth; Drizzle keeps the schema
  close to SQL for the history/ledger-heavy domain model.
- The single biggest reduction in code the product owner will have to
  write and maintain personally is PowerSync replacing the download half
  of the offline-sync engine — the upload half and all conflict-resolution
  business rules are unchanged.
- `README.md`, `PROJECT_STRUCTURE.md`, and `HOSPITALITY_OS_MASTER_PLAN.md`
  section 12 are updated in the same change set as this ADR to remove the
  now-superseded stack references. Master plan section 27 and
  `BUILD_WORKFLOW.md` P11 are annotated, not rewritten, to reflect the
  PowerSync split described in decision 6.

## Follow-ups tracked, not yet done

- Master plan section 27 would benefit from a full rewrite once PowerSync
  sync-rule design is actually implemented (current annotation is
  accurate but not exhaustive).
- ~~`apps/marketing-web` (Astro) is not yet scaffolded~~ — done
  2026-07-20, placeholder pages only, needs real content.
- ~~An Engineering Handbook does not exist yet~~ — done, see
  `ENGINEERING_HANDBOOK.md`. The full document set this ADR anticipated
  (per-module PRDs, API specification, frontend design system,
  infrastructure, data platform) is now written — see
  `ENGINEERING_CHARTER.md`'s document backlog for current status.
