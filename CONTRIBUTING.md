# Contributing

Owns onboarding mechanics for anyone joining this repo: local environment
setup, the concrete branch-naming and commit-message schemes, docstring
conventions, and the day-to-day pull-request/review workflow. Everything
here operationalizes rules already decided elsewhere — it does not
restate them. Read the source for the *why*:

- `ENGINEERING_CHARTER.md` — document governance and the standing rules
  every document and every line of code follows (RLS, ledgers, no
  hard-deletes, event outbox, etc.)
- `ENGINEERING_HANDBOOK.md` — coding conventions, git policy, PR
  checklist, testing strategy, release process (the *policy*; this
  document is the *mechanics*)
- `HOSPITALITY_OS_MASTER_PLAN.md` section 28 — Definition of Ready/Done,
  test strategy by layer, non-negotiable rules
- `DATA_MODEL.md` — schema and its 8 data-modeling principles
- `docs/adr/0001-tech-stack.md` — why the stack is what it is

If something here ever conflicts with one of those documents, the other
document wins — fix this file, don't quietly follow the drift.

## Start Here

Reading order for a new contributor, first day:

1. `README.md` — what this product is
2. `ENGINEERING_CHARTER.md` — how the document set fits together
3. This file — how to actually get set up and ship a change
4. `PROJECT_STRUCTURE.md` — what each app/package/service owns
5. `docs/adr/0001-tech-stack.md` — the stack and why
6. Whichever `docs/prd/*.md` covers the phase you're assigned (see
   `TODO.md` and `BUILD_WORKFLOW.md` for what's next)

Don't start writing code from a PRD you haven't read — PRDs exist
specifically so implementers don't have to invent behavior, and skipping
one means re-deriving decisions that are already made.

## Local Development Setup

Requirements: Node 22+, pnpm 9+ (via Corepack), Docker, Python 3.12+
(only if touching `services/ai-ml`).

```bash
git clone git@github.com:maqbuuul/African-pos.git
cd African-pos
corepack enable          # gives you the pinned pnpm version from package.json
pnpm install

cp .env.example .env     # fill in secrets you actually need for your task;
                          # empty payment/messaging/AI keys are fine for
                          # most local work — features degrade, they don't
                          # crash the app

docker compose up -d     # Postgres + Redis. Add --profile search or
                          # --profile analytics only once you actually need
                          # Meilisearch or ClickHouse (see ADR 0001's
                          # rollout-sequencing table — most phases don't)

pnpm --filter @hospitality-os/database db:generate   # after schema changes
pnpm --filter @hospitality-os/database db:migrate    # apply migrations

pnpm dev:api              # NestJS API on :3000
pnpm dev:manager           # or dev:owner / dev:kds / dev:customer / dev:marketing
pnpm dev:pos               # Expo dev client for pos-mobile
```

Whole-repo checks (same commands CI runs):

```bash
pnpm lint       # ESLint across every package (eslint.config.mjs at root)
pnpm typecheck  # tsc --noEmit / astro check per package
pnpm test       # vitest / jest per package
pnpm build      # production build per package
pnpm format     # Prettier, writes
```

Run a single package's script instead of the whole monorepo with
`pnpm --filter <package-name> <script>`, e.g.
`pnpm --filter @hospitality-os/api test`.

`services/ai-ml` isn't part of the pnpm workspace (it's Python):

```bash
cd services/ai-ml
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
ruff check .
pytest
```

### Running The Whole Stack In Docker

`docker compose up -d` (no profile) starts only shared infra — Postgres
and Redis, the two things every phase needs from day one (ADR 0001).
That's the default because day-to-day feature work runs faster against
natively-run apps (`pnpm dev:*`, instant reload) than against
rebuild-on-every-change containers.

Every app and service also has its own `Dockerfile` (multi-stage: `dev`
and `prod` targets), because ADR 0001 commits to Docker containers as
the actual production deploy unit (Fly.io or Hetzner+Coolify) — those
Dockerfiles are not optional local-dev sugar, they're the real deploy
artifact. To run the entire system as containers, the same shape it
runs in production — useful for an end-to-end smoke test before a
release, or for seeing the whole system up without installing Node/
Python locally at all:

```bash
docker compose --profile full-stack up -d --build
```

This builds and runs `api`, `ai-ml`, and all the web apps (each web app
served by nginx from its `prod`-target static build, except
`customer-web`, still Next.js pending its Vite migration) wired to the
same Postgres/Redis. No hot reload — re-run the command above after
code changes. Tear down with
`docker compose --profile full-stack down`.

## Repository Map

Full layout and what each directory owns: `PROJECT_STRUCTURE.md`. The
one-line version: `apps/` are deployables, `packages/` are shared
libraries nothing user-facing runs on its own, `services/ai-ml` is the
one non-TypeScript deployable, `docs/` is the full spec set, `archive/`
is superseded material kept for history, never edited going forward.

## Branching Strategy

`main` is always deployable — this is a hard rule, not aspirational.
There is no `develop`/`staging` long-lived branch; this project is small
enough that trunk-based development is the right amount of process (see
`ENGINEERING_HANDBOOK.md`'s Non-Goals — a heavier branching model is
premature ceremony until the team is bigger).

Branches live days, not weeks. One `BUILD_WORKFLOW.md` phase (or one
slice of a phase, if it's large) is a natural branch-sized unit.

Naming:

| Prefix | For | Example |
| --- | --- | --- |
| `phase/` | A full `BUILD_WORKFLOW.md`/`BUILD_WORKFLOW_HOTEL.md`/`BUILD_WORKFLOW_RETAIL.md` phase | `phase/p5-order-engine`, `phase/h3-front-desk` |
| `feat/` | A piece of work smaller than a whole phase | `feat/split-bill-allocation` |
| `fix/` | A bug fix | `fix/tenant-leak-in-reports-query` |
| `chore/` | Tooling, CI, dependency, config changes — no product behavior | `chore/eslint-flat-config` |
| `docs/` | Documentation-only changes | `docs/hotel-prd-folio-split` |

Branch off `main`, open a PR against `main`, delete the branch on merge
(GitHub's "automatically delete head branches" repo setting — turn it
on). Never force-push a branch other people have pulled; never force-push
`main` at all.

## Commit Messages

Format:

```
<type>(<scope>): <summary, imperative mood, under ~72 chars>

<body — why this change, not what it does; the diff already shows what>
```

`type` is one of `feat`, `fix`, `chore`, `docs`, `test`, `refactor`,
`perf`. `scope` is the package/app directory name (`api`, `domain`,
`pos-mobile`, `database`) or a phase id (`p5`) when a commit spans
several packages for one phase.

```
feat(api): reject invalid order state transitions

Orders had a free-text status column, so a client could push any string
and the API would accept it. Added an explicit state machine in the
order service so `paid -> draft` etc. are rejected server-side, not just
hidden in the UI. See docs/prd/05-order-engine.md Business Rules.
```

```
fix(reports): scope sales query by organization_id

Report query joined on location_id only, which let a manager with
access to one location's data see another organization's rows sharing
the same numeric location_id. Caught in review, not by RLS, because
this query used a service-role connection — see the note added to
ENGINEERING_HANDBOOK.md Security Requirements.
```

Squash-merge is fine for a branch with noisy in-progress commits, but the
squashed message on `main` still follows this format — `git log` on
`main` is the record someone reads in six months to understand why a
decision was made.

## Code Style

Enforced mechanically, not just by convention:

- `pnpm lint` (ESLint, `eslint.config.mjs`) and `pnpm format` (Prettier,
  `.prettierrc.json`) — both run in CI (`.github/workflows/ci.yml`); a PR
  that fails either doesn't merge.
- TypeScript strict mode everywhere except `services/ai-ml`; no `any`
  without an inline comment justifying it (ADR 0001, `ENGINEERING_HANDBOOK.md`).
- Business language in code — `order`, `bill`, `stock_movement`,
  `cash_drawer_session` — never `thing`, `data`, `payload`, `misc`
  (master plan section 20's Naming Rule, restated for code in
  `ENGINEERING_HANDBOOK.md`).
- Money is an integer (smallest currency unit) or fixed-precision
  decimal — never a float, anywhere near `payments`, `bills`, or
  `stock_movements` cost fields.
- A NestJS module never imports another module's repository/entity
  directly — only its exported service (master plan section 26's Module
  Boundary Rule).
- `services/ai-ml` uses `ruff` (config already in `pyproject.toml`) —
  same idea, different toolchain.

## Code Documentation: Comments vs. Docstrings

Two different things, easy to conflate:

**Comments** explain a non-obvious *why* — a hidden constraint, a
workaround for a specific bug, a subtle invariant. Well-named
identifiers already explain *what* the code does, so a comment
repeating that is noise, not documentation. This project has zero
tolerance for "increment counter // increments the counter"-style
comments.

```ts
// Bad — repeats what the code already says
// Convert cents to dollars
const dollars = cents / 100

// Good — explains a non-obvious constraint
// M-Pesa callbacks can arrive out of order and can duplicate; the
// idempotency key, not arrival order, is what makes this safe to retry.
const payment = await recordPayment(idempotencyKey, payload)
```

**Docstrings (TSDoc)** document the *public contract* of anything
exported from a package another package or app imports — because the
reader is a different developer at a package boundary, not someone with
the implementation in front of them. Required on exported functions/
classes in `packages/domain`, `packages/api-client`, `packages/database`,
`packages/integrations`, `packages/offline-sync`, and on NestJS
controller route handlers in `apps/api`. Not required on obvious,
well-named exports (a Zod schema like `MoneySchema` doesn't need a
docstring restating its name) or on anything internal to a single
package/app that nothing else imports.

```ts
/**
 * Allocates a bill's total across N payers using the split rule in
 * docs/prd/05-order-engine.md Business Rules — remainder cents go to
 * the first payer, not distributed evenly, to keep the sum exact.
 *
 * @throws {InvalidSplitError} if `payers.length` is 0 or amounts don't
 * sum to the bill total after allocation.
 */
export function splitBill(bill: Bill, payers: Payer[]): PayerAllocation[]
```

`services/ai-ml` (Python) uses Google-style docstrings on every public
function in `src/api` and `src/features/*` — same rule: document the
contract for a caller, skip it for anything private to a module.

## Data Modeling Checklist

`DATA_MODEL.md` owns the schema and its 8 data-modeling principles —
read those first. When adding or changing a table:

1. `organization_id` on every tenant-owned table; `location_id` if
   location-scoped (principles 1–2).
2. Postgres RLS policy **in the same migration** that creates the table
   — not a follow-up PR (`ENGINEERING_CHARTER.md`'s standing rule).
3. Financial/inventory state is append-only — a ledger table, not a
   mutable-quantity column (principle 3–4, and the master plan section
   20 Data Integrity Rules list of what must be a ledger).
4. If the table can hold something with business meaning that a user
   might later want gone, it gets a lifecycle status column, never
   `DELETE` (`ENGINEERING_CHARTER.md`).
5. Generate the migration: `pnpm --filter @hospitality-os/database
   db:generate`, review the generated SQL, then `db:migrate`.
6. Update `DATA_MODEL.md` in the same PR — it's documentation, not a
   database introspection tool; if the PR doesn't update it, the doc is
   already wrong the moment the PR merges.
7. If the table backs a new domain event another module or the
   analytics pipeline needs, add the outbox row and add the event to
   `docs/architecture/event-catalog.md` (same PR).

## Testing

Layers and what's covered by which are master plan section 28's
territory — read that before writing tests, it's the actual spec, not a
suggestion.

Where tests live:

- Unit and integration tests: colocated with source as `*.test.ts`
  (vitest) or `*.test.py`/`test_*.py` (pytest) — not a parallel tree.
- End-to-end and load tests: `tests/e2e/` and `tests/load/` at repo root
  — cross-app flows that don't belong to one package.
- `tests/integration/` at repo root is for cross-service integration
  (e.g., API ↔ ai-ml) that doesn't fit inside one package's own test
  suite.

Rules:

- A PR implementing a PRD's workflow must cover that PRD's own
  "Acceptance Criteria" section — that section *is* the test spec, not a
  separate aspiration (`ENGINEERING_HANDBOOK.md`).
- Tests run against a real running stack (`docker compose up -d`, real
  Postgres) before a phase's acceptance gate is considered passed —
  mocked-dependency unit tests alone don't satisfy it.
- `pnpm test` must exit clean with zero test files present (this is
  wired up as `vitest run --passWithNoTests` / `jest --passWithNoTests`)
  — a package with no tests yet is not a CI failure, a package with
  *failing* tests is.

## Pull Requests & Code Review

1. Open a PR against `main`. The PR template
   (`.github/PULL_REQUEST_TEMPLATE.md`) is the review checklist from
   `ENGINEERING_HANDBOOK.md` — fill it in as you go, not retroactively.
2. CI must pass: both `.github/workflows/ci.yml` jobs ("Lint, typecheck,
   test, build (TypeScript)" and "Lint, test (ai-ml service)"). Once the
   repo has this configured under Settings → Branches, these are
   required status checks — a red PR physically can't merge.
3. Review checklist (full detail in `ENGINEERING_HANDBOOK.md`'s PR/Code
   Review Checklist section): satisfies the relevant PRD's Definition of
   Done, doesn't violate any master-plan-section-28 Non-Negotiable Rule,
   matches the PRD's Business Rules and Edge Cases, ships an RLS policy
   with any new tenant table in the same PR, adds new events to the
   event catalog, and isn't secretly making an architecture decision
   that should be an ADR instead.
4. Squash-merge once approved; delete the branch.
5. **Team-size-dependent review rule:** solo, self-review against the
   checklist above and merge once CI is green. The moment a second
   developer is added as a collaborator, switch on "Require a pull
   request before merging" + "Require approvals: 1" under branch
   protection, and add a `CODEOWNERS` file mapping directories to
   reviewers — don't do either preemptively for a team of one, per
   `ENGINEERING_CHARTER.md`'s "assume a solo or very small builder team"
   rule; do it the day it actually applies.

Recommended `main` branch protection once collaborators exist (GitHub →
Settings → Branches → Add rule; not something this repo can configure
from the command line, no `gh` CLI / API token available in this
environment — apply manually):

- Require a pull request before merging
- Require status checks to pass (both CI jobs above)
- Require branches to be up to date before merging
- Do not allow force pushes; do not allow deletions

Equivalent via `gh` CLI, once the workflow has run at least once on
`main` (branch protection status checks can only reference checks
GitHub has already seen run):

```bash
gh api repos/maqbuuul/African-pos/branches/main/protection \
  --method PUT \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_status_checks[strict]=true \
  --field 'required_status_checks[contexts][]=Lint, typecheck, test, build (TypeScript)' \
  --field 'required_status_checks[contexts][]=Lint, test (ai-ml service)' \
  --field enforce_admins=false \
  --field restrictions=null
```

Drop `required_pull_request_reviews` while solo — add it back the day a
second collaborator joins, per the team-size-dependent rule above.

## Documentation — What To Update, When

| You changed | Update |
| --- | --- |
| A module's workflow, screens, permissions, or business rules | The relevant `docs/prd/*.md` |
| A schema table or column | `DATA_MODEL.md`, same PR as the migration |
| An architectural decision with real alternatives | A new `docs/adr/000X-*.md` |
| A new domain event | `docs/architecture/event-catalog.md` |
| Repo layout (new app/package/service) | `PROJECT_STRUCTURE.md`, and `README.md` if it changes the doc index |
| Build phase order or acceptance gates | The relevant `BUILD_WORKFLOW*.md` |
| A coding/git/testing/release convention | `ENGINEERING_HANDBOOK.md` |
| This onboarding process itself | `CONTRIBUTING.md` (this file) |

`ENGINEERING_CHARTER.md`'s Document Map is the authority on which
document owns which concern — check it before creating a new document;
most things belong in an existing one.

## Release Process

Full detail in `ENGINEERING_HANDBOOK.md`'s Release Process section.
Short version: deploy via GitHub Actions only, never manually; a phase's
acceptance gate must pass before that phase ships to production
(merging to `main` and releasing are allowed to be different moments);
migrations are forward-only, with "fix forward" as the rollback strategy
for anything touching a ledger table.

## First Week Checklist

- [ ] Read `README.md`, `ENGINEERING_CHARTER.md`, this file
- [ ] Local setup working: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass on a clean clone
- [ ] `docker compose up -d`, confirm `apps/api`'s `/health` endpoint responds
- [ ] Read the PRD for your assigned phase end to end, including Edge Cases
- [ ] Open a small first PR (a `chore/` or a narrow `feat/` slice) to exercise the branch → PR → CI → review → merge loop before taking on a full phase
