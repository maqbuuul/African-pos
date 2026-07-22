# Infrastructure & DevOps

## Scope

Owns deployment topology, environments, CI/CD pipeline structure, and
operational runbook pointers. `docs/adr/0001-tech-stack.md` already
decided *what* runs where (Neon for Postgres, Fly.io/Hetzner+Coolify for
compute, GitHub Actions for CI/CD) and *when* each piece is introduced
(the rollout-sequencing table) — this volume is the concrete deployment
architecture built on those decisions, not a re-decision of them. PRD 18
owns the pre-launch hardening/DR verification process; this volume owns
the steady-state architecture that process verifies.

## Environments

- **Local development**: Docker Compose (Postgres, Redis, and — once
  introduced per ADR 0001's rollout table — Meilisearch, PowerSync).
  `docker compose up -d` per `TODO.md` Phase 0.
- **Production**: Neon (Postgres) + Fly.io or Hetzner+Coolify (app
  containers: `apps/api`, `services/ai-ml`, background workers).
- **Staging**: not a separate long-lived environment at this project's
  current scale — a solo builder maintaining a third full environment is
  exactly the kind of premature operational overhead ADR 0001 and
  `ENGINEERING_CHARTER.md` argue against. Feature branches deploy to
  ephemeral preview environments where the hosting platform supports it
  (Fly.io/Neon both do); introduce a persistent staging environment only
  when a real multi-person team or a compliance requirement demands it.
- **Sandbox** (PRD 19-specific): hard-separated at the data layer from
  production, not a separate infrastructure environment — a sandbox
  `organization_id` simply cannot be resolved from a production request
  path, enforced in application logic, not by physical environment
  separation.

## Deployment Topology

```text
Cloudflare (CDN, DNS, WAF)
        |
Fly.io / Hetzner+Coolify
        |
        +-- apps/api (NestJS, containerized)
        +-- services/ai-ml (Python/FastAPI, containerized)
        +-- Background workers (BullMQ consumers)
        |
Neon (PostgreSQL, managed)
Redis (Fly.io/Hetzner-hosted, or managed add-on)
Cloudflare R2 (object storage)
PowerSync service (introduced at BUILD_WORKFLOW.md P11)
Meilisearch (introduced only once Postgres full-text search is
  insufficient, per ADR 0001 decision 8)
```

Static/content surfaces (`apps/marketing-web`, once scaffolded) deploy
independently to Cloudflare Pages or an equivalent static host — they
have no runtime dependency on the application containers above and
shouldn't share a deploy pipeline with them.

## CI/CD Pipeline (GitHub Actions)

```text
On PR:
  - Lint + typecheck (turbo run lint / typecheck)
  - Unit + integration tests against a real Postgres service container
    (not mocked-only, per BUILD_WORKFLOW.md's Agent Operating Rules)
  - Build every affected app/package (turbo's dependency-aware caching)

On merge to main:
  - Re-run the above
  - Run database migrations against a migration-check environment
    (verify forward-only, verify a rollback plan exists per
    ENGINEERING_HANDBOOK.md's release-process rule)
  - Deploy to production (Fly.io/Hetzner) on green
  - Deploy apps/marketing-web independently if changed (no coupling to
    the application deploy)
```

No manual production deploys, per `ENGINEERING_HANDBOOK.md`.

## Secrets Management

- Application secrets (database URLs, API keys for M-Pesa/Flutterwave/
  Paystack/WhatsApp/etc., per Module 16's credentials vault) are never
  committed — managed via the hosting platform's secret store (Fly.io
  secrets / Hetzner+Coolify env management) and GitHub Actions'
  encrypted secrets for CI-time credentials.
- **Two Postgres roles, not one.** The schema-owning role (`DATABASE_URL`,
  `pos_user` in dev) runs migrations and seeding and is a superuser on
  managed providers that default to that (including local Docker Postgres,
  where `POSTGRES_USER` becomes a cluster superuser). Superusers
  unconditionally bypass Row-Level Security — `FORCE ROW LEVEL SECURITY`
  has no effect on them. The API itself connects as a second,
  low-privilege, non-superuser, non-`BYPASSRLS` role (`APP_DATABASE_URL`,
  `pos_app` in dev; see `infra/postgres/init.sql`) — this is the role RLS
  actually protects. Any managed Postgres provider (Neon/Supabase) used in
  production must provision this same second role; connecting the API as
  the provider's default admin/owner role silently turns every RLS policy
  in the schema into a no-op.
- JWT signing (`JWT_SECRET`, see `packages/database/src/security/hash.ts`
  and `apps/api/src/core/auth/jwt.ts`) uses a single HMAC secret today —
  revisit key rotation once there's a real deployment to rotate against.
- Tenant-level third-party credentials (a merchant's own Shopify/
  WooCommerce/delivery-platform API keys, PRD 15/16) live in
  `integration_connections`, encrypted at rest at the application/
  database level — a distinct concern from platform-level secrets above,
  and never conflated with them.

## Monitoring & Alerting

Per master plan section 12's observability stack (Sentry, OpenTelemetry,
Prometheus, Grafana, Uptime Kuma) — introduced per the same
rollout-sequencing discipline as ADR 0001's other deferred pieces: error
tracking (Sentry) from day one (cheap, immediately valuable), full
metrics/tracing (OpenTelemetry/Prometheus/Grafana) once there's enough
production traffic for dashboards to be worth building rather than
staring at a mostly-empty graph.

- `PRD 18`'s security/hardening findings and the DR runbook it
  establishes are the operational documents this monitoring stack feeds
  into and validates — an alert firing in production should map to a
  specific runbook entry, not require improvisation.
- Branch-offline detection (master plan Module 4's operational alert)
  and device sync health (PRD 11) are product-level monitoring surfaced
  to tenants; this volume's monitoring is platform-operator-facing
  (is *our* infrastructure healthy), a distinct concern from PRD 11/14's
  tenant-facing sync/ops visibility.

## Backup & Disaster Recovery

Owned in detail by PRD 18 (the verification process — backup/restore
drills, the DR runbook covering device loss/API outage/payment provider
outage/delivery platform outage). This volume states the infrastructure
that process runs against:

- Postgres: Neon's managed continuous backup/point-in-time-recovery,
  verified (not just assumed) via PRD 18's drill.
- Object storage (R2): versioning enabled for anything PRD 18's DR
  runbook needs to recover (receipts, uploaded invoice photos for PRD
  17's OCR flow).
- Application containers are stateless by design (all durable state
  lives in Postgres/Redis/R2) — a container can be destroyed and
  redeployed from the CI/CD pipeline with zero data implications, which
  is what keeps the DR story simple enough for a solo builder to
  actually execute under pressure.

## Scaling Path

Exactly ADR 0001's stated principle, restated as an infrastructure
decision rule rather than a tech choice: scale the design now (RLS,
DDD module boundaries, append-only ledgers — all already true regardless
of infrastructure), defer scaling the *infrastructure* until a measured
bottleneck demands it. Concretely:

1. Single Fly.io/Hetzner region, single Postgres instance (current).
2. Read replicas (Neon supports this natively) once read load — not
   write load — becomes the bottleneck (reporting/BI queries, PRD 14,
   are the likely first pressure point).
3. Regional deployment (multiple Fly.io regions) once latency to a
   specific market becomes a measured, real problem — not before.
4. Kubernetes, only if/when container orchestration complexity genuinely
   outgrows Fly.io/Coolify's managed model — this is explicitly not
   assumed to ever be necessary; ADR 0001 treats it as the last resort,
   not the eventual destination.

## Non-Goals

- Multi-cloud/cloud-agnostic infrastructure abstraction — deliberately
  coupled to Fly.io/Hetzner/Neon/Cloudflare per ADR 0001; portability is
  not a current requirement and premature abstraction here would be pure
  cost.
- A dedicated staging environment (see Environments above) until team
  size or compliance need justifies it.
