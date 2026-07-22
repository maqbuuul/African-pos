# Engineering Handbook

## Scope

Owns coding conventions, git/branching workflow, PR/code review
checklist, and release process — the engineering-*process* layer that
`ENGINEERING_CHARTER.md`'s document backlog flagged as missing.
Deliberately does not duplicate what already exists in real depth
elsewhere: master plan section 28 (Development Acceptance Criteria)
already owns Definition of Ready/Done, test strategy by layer, and the
platform's non-negotiable rules — read that section, not a copy of it
here. `ENGINEERING_CHARTER.md` owns the standing rules for documents and
the ledger/RLS/audit non-negotiables. This handbook is what's left:
how code actually gets written, reviewed, and shipped, day to day.

## Coding Conventions

- **TypeScript everywhere except `services/ai-ml`** (ADR 0001) — strict
  mode on, no `any` without an explicit inline justification comment.
- **Business language in code**, per master plan section 20's Naming
  Rule: `order`, `bill`, `stock_movement`, `shift`, `cash_drawer_session`
  — never `thing`, `record`, `data`, `payload`, `misc`. This applies to
  variable names and function names, not just table names.
  `ENGINEERING_CHARTER.md`'s document-naming rule is the same principle
  applied one level up.
- **Module boundaries are enforced by the DDD/module structure NestJS
  gives us** (ADR 0001) — a module never imports another module's
  repository/entity directly; it calls that module's exported service,
  per master plan section 26's Module Boundary Rule.
- **No comments explaining what code does** — well-named identifiers do
  that. A comment is justified only for a non-obvious *why*: a hidden
  constraint, a workaround for a specific bug, a subtle invariant. This
  mirrors this project's own documentation philosophy
  (`ENGINEERING_CHARTER.md`) applied to code.
- **Money is never a floating-point number.** Store amounts as integers
  (smallest currency unit — cents, or the local equivalent) or a decimal
  type with explicit precision — never `float`/`double` for anything
  that touches `payments`, `bills`, or `stock_movements` cost fields.
- **Every append-only table's insert path is the only write path** — no
  `UPDATE`/`DELETE` grants on `payments`, `refunds`, `audit_logs`,
  `stock_movements`, `loyalty_events` at the database-role level, not
  just enforced in application code (`ENGINEERING_CHARTER.md`'s ledger
  rule, given its actual database-permission teeth here).
- **Every NestJS constructor-injected dependency needs an explicit
  `@Inject(Token)`, even for plain class injection.** `apps/api` runs on
  `tsx` (esbuild) in dev, and esbuild's `emitDecoratorMetadata` doesn't
  reliably produce `design:paramtypes` for undecorated constructor
  params — Nest then silently injects `undefined` instead of throwing a
  clear "can't resolve dependency" error at bootstrap, which only
  surfaces as a `Cannot read properties of undefined` at request time
  (found the hard way building `core/auth`, `core/tenant`,
  `core/permissions`). `@Inject(SomeClass) private readonly x: SomeClass`
  everywhere sidesteps it entirely.

## Git & Branching

See `CONTRIBUTING.md` for the concrete branch-naming scheme and
commit-message format — this section is the policy those mechanics
implement.

- `main` is always deployable. No long-lived feature branches — branches
  live days, not weeks, matching the phase-by-phase `BUILD_WORKFLOW.md`
  structure (one phase's work is a natural branch-sized unit).
- Commit messages describe *why*, not *what* the diff shows — the diff
  already shows what changed.
- Never force-push to `main`. Never rewrite published history.
- A branch's commits should tell a coherent story; squash-merge is fine
  for noisy in-progress commits, but the final `main` history should be
  legible to someone reading `git log` six months later trying to
  understand why a decision was made — pair with an ADR (`docs/adr/`)
  for any decision substantial enough to need one.

## Pull Request / Code Review Checklist

Every PR, before merge, is checked against:

1. **Does it satisfy master plan section 28's Definition of Done** for
   the feature it implements? (Backend command exists, API validation
   exists, permission checks exist, audit logs exist where required, UI
   happy path works, error states are visible, offline behavior is
   handled or explicitly blocked, tests cover core business rules,
   report data is captured, product analytics event is emitted,
   documentation is updated.)
2. **Does it violate any of master plan section 28's Non-Negotiable
   Rules?** (No payment deletion, no inventory overwrite without a
   movement record, no destructive action without an audit event, no
   cross-tenant reads, no order total calculated client-side only, no AI
   recommendation without source metrics, no feature that blocks cash
   sales when offline, no manager override without approver identity, no
   report untraceable to source data.) Any violation blocks merge, no
   exceptions.
3. **Is the relevant PRD's "Business Rules" and "Edge Cases" section
   actually reflected in the implementation?** — the PRD is the spec;
   review checks the code against it, not against the reviewer's memory
   of the conversation that produced it.
4. **Does a new tenant-scoped table have an RLS policy in the same PR**
   that creates it (`ENGINEERING_CHARTER.md`'s rule — same commit, not a
   follow-up)?
5. **Does a new domain event get an outbox row and appear in the
   relevant PRD's "Events Emitted" list** (update the PRD if the
   implementation revealed a new event that belongs there)?
6. **Is anything here a workaround that should be an ADR instead?** — if
   a PR silently makes an architectural choice the reader has to
   reverse-engineer, stop and write the ADR first.

## Testing Strategy

Test layers and specific required coverage are master plan section 28's
territory (unit: pricing/tax/permission/state-transition/split-bill/
inventory-movement calculations; integration: order→payment,
send-to-KDS, void-with-approval, close-shift, receive-stock, sync-
offline-order; end-to-end: role-specific full flows; load: search,
order creation, payment webhook, KDS subscription, report generation,
sync batch upload) — this handbook adds only the process rule:

- A PR implementing a PRD's workflow must include tests for that PRD's
  own "Acceptance Criteria" section, not just generic coverage — the
  PRD's acceptance criteria *are* the test spec, not a separate
  aspiration.
- Tests run against a real running stack (`docker compose up -d`, real
  Postgres) before a phase is considered done, per `BUILD_WORKFLOW.md`'s
  Agent Operating Rules — mocked-dependency unit tests alone don't
  satisfy a phase's acceptance gate.

## Observability

- Every mutating request logs: `request_id`, `organization_id`,
  `actor_id`, endpoint, latency, status — this is the backbone of the
  `api_usage_logs`/audit correlation that lets a support engineer
  reconstruct "what happened" from logs alone.
- Structured logging (Pino, per master plan section 12) — no
  string-concatenated log lines that can't be queried.
- Every domain event emission is itself a loggable, traceable action —
  if an event fired but its consumer never processed it, that gap must
  be visible in logs/metrics, not silently discovered by a user
  reporting a missing notification.

## Security Requirements

Restated as day-to-day engineering discipline (PRD 18 owns the
pre-launch verification of these; this is what to do while writing the
code in the first place):

- Never log a credential, token, or PIN — not even at debug level.
- Every new endpoint gets a permission check before it gets an
  implementation — write the `permission_denied` test case first if it
  helps enforce this.
- Every new external integration credential goes through the encrypted-
  at-rest credentials vault (master plan Module 16) — never a plaintext
  environment variable holding a live tenant credential.

## Release Process

- Deploy via GitHub Actions (ADR 0001) — no manual production deploys.
- A phase's acceptance gate (`BUILD_WORKFLOW.md`) must pass before that
  phase's work ships to production, not just before it merges to `main`
  — merging and releasing are allowed to be different moments,
  especially for a phase that depends on a not-yet-stable upstream
  phase.
- Database migrations are forward-only and reversible in principle
  (a rollback plan exists for every migration), but the actual rollback
  path for financial/ledger tables is "fix forward," never "undo the
  migration and lose data" — consistent with the never-delete principle
  running through this entire document set.

## Non-Goals

- A generic style guide for languages this project doesn't use.
- Formal RFC process — at this project's current size (solo/small team,
  `ENGINEERING_CHARTER.md`'s stated assumption), an ADR is the right
  weight of process for a real architectural decision; a full RFC
  process is premature ceremony until there's a team large enough to
  need it.
