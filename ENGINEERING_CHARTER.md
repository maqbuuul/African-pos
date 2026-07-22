# Engineering Charter

This is Document 00. Read it before writing any other document, any ADR,
or any code. It does not repeat what already exists elsewhere in this
repo — it defines how the document set fits together, what every future
document and every line of code must do to stay consistent, and where the
real gaps still are.

## Why This Document Exists

The product owner asked for the "Document 00 / Master Context / Product
Charter" described at the end of `archive/source-material/chatgpt-chat.md`
— a foundation every future PRD, architecture doc, and database design
references so the whole set stays coherent instead of becoming a pile of
disconnected AI-generated documents.

That source conversation assumed a blank repo. This one isn't blank:
`HOSPITALITY_OS_MASTER_PLAN.md` already contains a mature, 32-section
specification — mission, vision, positioning, product philosophy, platform
strategy, target customers, user types, every shared module, and detailed
build specs per vertical. Duplicating that here would just create two
sources of truth that drift apart. So this charter does the part that
doesn't already exist: **document governance, standing rules for
consistency, and an honest map of what's covered versus what's still
missing.**

## Document Map

Every document in this repo owns exactly one of these concerns. If you're
about to write something and can't find it in this list, that's a sign
either it belongs in an existing doc or it's a genuinely new document —
check before creating a new file.

| Document | Owns |
| --- | --- |
| `ENGINEERING_CHARTER.md` (this file) | Document governance, standing rules for AI/human contributors, ADR practice, gap tracking |
| `HOSPITALITY_OS_MASTER_PLAN.md` | Vision, mission, positioning, product philosophy, target customers, user types, every product module and feature, per-vertical build specs, roadmap, success metrics |
| `docs/adr/*.md` | Technical decisions with rationale, alternatives considered, and consequences — the "why," dated and never silently edited |
| `docs/prd/*.md` | Restaurant OS per-module workflows, screen-by-screen UI behavior, permissions, business rules, edge cases, events, acceptance criteria — one PRD per `BUILD_WORKFLOW.md` phase (P1–P19), see `docs/prd/README.md` for the index and template |
| `docs/prd/hotel/*.md`, `docs/prd/retail/*.md` | Same template, for Hotel OS and Retail OS — phase-sequenced by `BUILD_WORKFLOW_HOTEL.md`/`BUILD_WORKFLOW_RETAIL.md`, still lower confidence than the Restaurant OS set since neither vertical has actually been built (see `docs/prd/README.md`) |
| `BUILD_WORKFLOW_HOTEL.md`, `BUILD_WORKFLOW_RETAIL.md` | Hotel OS (`H1`–`H9`) and Retail OS (`R1`–`R7`) build phase order, dependencies, acceptance gates — same format as `BUILD_WORKFLOW.md`, mechanically derived from the PRDs' own Dependencies/Acceptance Criteria sections |
| `docs/architecture/api-specification.md` | API versioning, auth schemes, request/response conventions, error taxonomy, idempotency, rate limiting, webhook contract |
| `docs/architecture/frontend-design-system.md` | Component library, design tokens, navigation patterns, responsiveness, accessibility |
| `docs/architecture/infrastructure.md` | Deployment topology, environments, CI/CD, secrets, monitoring, backup/DR infrastructure |
| `docs/architecture/data-platform.md` | Analytics pipeline architecture, event-catalog discipline, feature store considerations, reverse ETL |
| `docs/architecture/event-catalog.md` | Every domain event across every PRD, indexed with trigger/payload/consumers — derived from the PRDs, not a second source of truth |
| `GTM_PLAYBOOK.md` | Channel strategy, onboarding/activation execution, sales motion, customer success — first-hypothesis status, unverified against real usage |
| `ENGINEERING_HANDBOOK.md` | Coding conventions, git/branching workflow, PR/code review checklist, testing process, release process (the *policy*) |
| `CONTRIBUTING.md` | Onboarding mechanics for contributors: local dev setup, concrete branch/commit naming, docstring conventions, PR/review day-to-day workflow (the *how*, built on `ENGINEERING_HANDBOOK.md`'s policy rather than restating it) |
| `DATA_MODEL.md` | Database schema |
| `BUILD_WORKFLOW.md` | Phase-by-phase build order (P0–P19), dependencies, acceptance gates |
| `PROJECT_STRUCTURE.md` | Repo layout, what each app/service/package owns |
| `TODO.md` | Current actionable task list, phase-scoped |

**Rule:** vision/features/product decisions go in the master plan.
Technical decisions with real alternatives and consequences go in an ADR.
Schema goes in `DATA_MODEL.md`. Sequencing goes in `BUILD_WORKFLOW.md`.
Never restate one document's content inside another — link to it.

## Standing Rules For Every Future Document

Whether written by a human or generated with AI assistance, every document
added to this repo must:

1. **State what it owns and cross-reference, not duplicate, everything
   else.** Open with a one-line statement of scope and a pointer to
   related docs.
2. **Check the document map first.** If the content already belongs
   somewhere, extend that document instead of creating a new one.
3. **Assume a solo or very small builder team**, not a 20-person
   engineering org. Recommendations should account for who actually has
   to build and maintain the thing — this is why the tech stack (ADR
   0001) optimizes for one-language consistency over marginal performance
   or feature gains that would require a bigger team to exploit.
4. **Design for correctness and clean boundaries now; defer operational
   scale-complexity until it's measured, not assumed.** Row-level
   tenant isolation, append-only ledgers, DDD module boundaries, and
   proper API contracts cost little to get right early and are expensive
   to retrofit — do them now. Kubernetes, Kafka, Airflow, and
   multi-region deployment cost real ongoing attention for no benefit
   until traffic or team size actually demands them — defer them. Don't
   let "design for 100,000 businesses" become an excuse to add
   infrastructure a solo builder then has to operate for zero users.
5. **Challenge the existing plan, don't just extend it.** If a document
   reveals that an earlier decision was wrong or incomplete, say so
   explicitly and either fix the earlier document or write an ADR
   explaining the change — don't silently drift out of sync with it.
6. **Prefer business language over generic names**, per the master
   plan's existing Naming Rule (section 20) — this applies to every
   document, not just code.
7. **Never delete history.** Documents get superseded, not deleted —
   ADRs get a `Status: Superseded by ADR-000X` line; other docs get
   dated edits, and genuinely obsolete material moves to `archive/`,
   exactly as the 2026-07-17 research consolidation already did.

## Standing Rules For Every Line Of Code

These are the technical non-negotiables the master plan's Product Rules
(section 2) and Development Operating Manual (section 20) already
establish at the product level. Restated here with the technical teeth
the new stack (ADR 0001) gives them, because code review should be able
to check these mechanically:

- **Every tenant-scoped table gets a Postgres Row-Level Security policy
  in the same migration that creates the table.** Not a follow-up task —
  the same commit. An app-layer `WHERE organization_id = ?` is a backstop,
  never the primary defense.
- **Financial and inventory state is append-only.** Payments, refunds,
  tips, cash drawer activity, gift card/loyalty balance changes, stock
  movements, recipe deductions, folio charges, and audit events are
  ledger entries, not mutable rows. Summary tables for performance must
  be rebuildable from the ledger.
- **Nothing with business meaning is hard-deleted.** Menu items,
  customers, suppliers, products, employees use lifecycle status fields
  (draft/active/seasonal/discontinued/archived), never `DELETE`. Historical
  orders must still resolve every reference.
- **Price, recipe, and menu changes are versioned, not overwritten.**
  Every order stores which version was active at sale time.
- **Every domain event gets an outbox row.** If another module,
  the analytics pipeline, or a webhook subscriber might ever need to know
  something happened, it's a named event in the transactional outbox
  (`OrderCreated`, `PaymentCaptured`, `StockAdjusted`, etc.) — not an
  in-process side effect only the original module can see.
- **Every write a POS device can make offline gets an operation-log
  entry**, per master plan section 27 and ADR 0001 decision 6 — this is
  true regardless of PowerSync, which only owns the download/replication
  half.
- **Every destructive or sensitive action is permission-checked and
  audit-logged** — refunds, voids, discounts, price overrides, exports,
  role changes. No exceptions for "admin can do anything without a
  trace."

## Architecture Decision Record Practice

- ADRs live in `docs/adr/`, numbered sequentially (`0001-`, `0002-`, ...),
  never renumbered or deleted.
- Write one when a decision has **genuine alternatives with real
  tradeoffs** and will be expensive to reverse later — a new dependency,
  a data-model pattern that touches many tables, a framework or protocol
  choice. Don't write one for a decision with an obvious single right
  answer.
- Required sections: Status, Date, Context, Decision, Alternatives
  Considered (with why each was rejected), Consequences.
- Status lifecycle: `Proposed` → `Accepted` → `Superseded by ADR-000X`
  (never `Rejected` and deleted — a rejected proposal that was seriously
  considered is worth keeping as a record of why).
- `docs/adr/0001-tech-stack.md` is the first entry and the model to
  follow for format and level of detail.

## Document Backlog

What the chat's proposed 12-volume/23-section blueprint asked for, mapped
against what this repo actually has, so nothing gets re-proposed as new
and nothing genuinely missing gets forgotten.

### Already covered — do not duplicate

- Vision, mission, positioning, product philosophy, product principles →
  master plan section 1–2
- Platform strategy, year-by-year focus → master plan section 3
- Target customers, user personas/types → master plan section 4–5
- Complete feature catalogue, every module → master plan section 6–18
- Per-vertical detailed build specs (Restaurant/Hotel/Retail) → master
  plan section 7–9, 23–25
- Database design outline → `DATA_MODEL.md` + master plan section 13
- Roadmap, MVP scope, success metrics → master plan section 15–17
- Build sequencing and acceptance gates → `BUILD_WORKFLOW.md`
- Pricing and monetization model → master plan section 29
- BI dashboard design system → master plan section 30
- UX design principles, performance budgets, onboarding → master plan
  section 32
- Technical architecture / stack → master plan section 12 + ADR 0001
- **Per-module workflows, UI behavior, permissions, business rules, edge
  cases, events, acceptance criteria** (the chat's "Volume 2 — Product
  Requirements" ask) → `docs/prd/00` through `19`, one per
  `BUILD_WORKFLOW.md` phase P1–P19, see `docs/prd/README.md`
- **API specification** (versioning, auth schemes, error taxonomy,
  idempotency, rate limiting, webhook contract) →
  `docs/architecture/api-specification.md`, built on top of — not
  duplicating — master plan section 26's response envelope and core
  endpoint list
- **Frontend design system** (component library, design tokens,
  navigation, responsiveness, accessibility) →
  `docs/architecture/frontend-design-system.md`, built on top of master
  plan sections 30 and 32 rather than restating their interaction rules
- **Engineering Handbook** (coding conventions, git/branching workflow,
  PR/code review checklist, testing process, release process) →
  `ENGINEERING_HANDBOOK.md`, built on top of master plan section 28's
  Definition of Ready/Done, test strategy, and non-negotiable rules
  rather than duplicating them
- **Infrastructure & DevOps** (deployment topology, environments, CI/CD,
  secrets, monitoring, backup/DR infrastructure) →
  `docs/architecture/infrastructure.md`, built on ADR 0001's stack/
  rollout decisions
- **Data platform** (analytics pipeline architecture, event-catalog
  discipline, feature store considerations, reverse ETL) →
  `docs/architecture/data-platform.md`, built on ADR 0001 decision 7
- **Security and compliance** — now distributed rather than a single
  gap: PRD 18 owns the pre-launch verification *process* (security
  review, load test, backup/DR drill), `ENGINEERING_HANDBOOK.md`'s
  Security Requirements section owns day-to-day engineering discipline,
  `docs/architecture/infrastructure.md` owns secrets management
  mechanics. A dedicated standalone security/compliance document is only
  worth writing if an enterprise customer or payment partner requires
  formal certification (PCI-DSS, SOC 2) — not assumed as an MVP need.
- **Schema gaps individual PRDs flagged while being written** — closed
  on 2026-07-20 in a dedicated pass: `DATA_MODEL.md` now has
  `product_prices` (PRD 03's price-history rule), `table_merges` and
  `table_qr_sessions` (PRD 04/10), `recipes` versioning columns (PRD 12),
  `notification_preferences`/`whatsapp_command_log` (PRD 09), and
  `tenant_settings` (a home for every "configurable threshold" referenced
  across PRD 03/05/08/09/12). That same pass also found and corrected
  **false** gap claims in PRD 14/15/16/17/19 — those PRDs were written
  without re-reading `DATA_MODEL.md`'s later sections (Integrations,
  Developer Platform, Reporting And Intelligence), which already had the
  tables in question. Lesson for future document-writing sessions: read
  the *entire* file being cross-referenced, not just the sections
  expected to be relevant — a partial read produces confident-sounding
  gap claims that are actually wrong.

### Closed on 2026-07-20 (second pass — everything previously listed as deferred)

The product owner asked to finish every remaining gap rather than wait
for natural triggers. All of it is now written:

- **Full offline-sync spec rewrite** — master plan section 27 is fully
  rewritten with a concrete PowerSync design: bucket definitions (Sync
  Rules), the upload-queue handler contract, sync-JWT authentication, and
  a Failure Modes subsection. No longer an annotation over a stale
  design — this is a real design, informed by PowerSync's actual
  documented architecture. It should still be revisited once real
  implementation experience either confirms or corrects the bucket
  design, per the same "the map is not the territory" caution that
  applies to every document in this set before code exists.
- **Canonical Event Catalog** → `docs/architecture/event-catalog.md`,
  indexing every event from `docs/prd/00`–`19`'s "Events Emitted"
  sections with trigger, payload fields, and consumers. Explicitly a
  derived index, not a second source of truth — if a PRD's event list
  changes, this document is stale until updated to match, not the other
  way around.
- **`apps/marketing-web` (Astro)** → scaffolded (package.json,
  astro.config.mjs, base layout, placeholder pages). Real content is
  still needed — the scaffold is not a finished marketing site.
- **GTM / customer success / RevOps playbook** →
  `GTM_PLAYBOOK.md`. Explicitly flagged inside that document as a
  first hypothesis, not a validated plan — unlike every engineering
  document in this repo, almost none of it can be checked against
  running code or real users yet, and it says so.
- **Hotel OS and Retail OS PRDs** → `docs/prd/hotel/01`–`08` and
  `docs/prd/retail/01`–`07`, following the same template as the
  Restaurant OS set, built from master plan sections 8/9/24/25.

### Confidence-raising pass (2026-07-20, third pass)

The product owner asked to raise the confidence of the two things the
previous pass had explicitly flagged as lower-confidence: Hotel/Retail
PRDs (no build sequencing) and `GTM_PLAYBOOK.md` (no way to verify
against real usage). Real usage still can't be fabricated, but the build
sequencing gap was directly fixable:

- **`BUILD_WORKFLOW_HOTEL.md`** (`H1`–`H9`) and **`BUILD_WORKFLOW_
  RETAIL.md`** (`R1`–`R7`) — new, same phase/dependency/acceptance-gate
  format as `BUILD_WORKFLOW.md`, mechanically derived from each PRD's
  own Dependencies and Acceptance Criteria sections. Every Hotel/Retail
  PRD's "Status note" now names its real phase instead of "no assigned
  build phase yet." Both new documents carry their own "Notes On
  Confidence" section naming the specific judgment calls involved in the
  phase *ordering* (as opposed to the PRD content, which the phases just
  sequence) — phase order is a reasonable first pass, not a proven one,
  and says so.
- **Spot-check re-verification** of the Hotel/Retail PRDs against master
  plan sections 8/9/24/25 found one real omission: Hotel PRD 04 was
  missing "split folio" (master plan section 8's Hotel Payments list) —
  fixed, with a new workflow, business rule, event
  (`FolioSplit`), and API endpoint added.
- **`docs/architecture/event-catalog.md`** extended to cover Hotel OS
  and Retail OS events — it previously indexed only `docs/prd/00`–`19`,
  written before the Hotel/Retail PRDs existed. This was a real
  completeness gap, not just a confidence one: the event catalog claimed
  to be canonical while silently missing 15 PRDs' worth of events.
- **`GTM_PLAYBOOK.md`** — real usage validation still isn't possible
  before there's a product, so this fix is about precision, not
  certainty: every section now carries an explicit `[Fixed]` /
  `[Grounded]` / `[Hypothesis]` tag instead of one blanket disclaimer at
  the top, so a reader can tell exactly which claims are load-bearing
  (master-plan-decided pricing/onboarding targets), which are
  low-inference consequences of those decisions (a free tier implies a
  self-serve motion), and which are genuine guesses worth testing
  (specific channel priorities, health-score weights).

### Added 2026-07-20 (fourth pass — onboarding other developers)

The product owner is now actually adding other developers to the
project, which is the real, current need the standing gap-management
rule below requires (not speculative ahead-of-need writing):

- **`CONTRIBUTING.md`** — local environment setup, concrete branch-name
  and commit-message schemes (`ENGINEERING_HANDBOOK.md` had the policy
  — "branches live days not weeks," "commits describe why" — but no
  literal naming scheme), a docstring-vs-comment convention (genuinely
  new; the "no comments" rule needed a companion explaining how exported
  package-boundary APIs get documented for a second developer who
  doesn't have the implementation in front of them), a data-modeling
  "adding a table" checklist, and a PR/review process that scales with
  team size (self-review while solo; required approvals the day a
  second collaborator joins, not before).
- **`.github/PULL_REQUEST_TEMPLATE.md`** — turns `ENGINEERING_HANDBOOK.md`'s
  PR checklist from a document a reviewer has to remember to open into
  the actual PR description template.
- **Not done, and deliberately not**: a `CODEOWNERS` file (no named
  collaborators yet to map to directories) and GitHub branch protection
  rules (no `gh` CLI or API token available in the environment this was
  written in — `CONTRIBUTING.md` documents the recommended settings for
  the project owner to apply manually via Settings → Branches once
  collaborators exist).

### Standing gap-management rule

New documents get created only when one of these gaps is actually being
worked on — not speculatively ahead of need, per the "design for
correctness now, defer complexity until measured" rule above. The
2026-07-20 pass above is an explicit, requested exception to that
default, not a reversal of it: closing every open item on request is
different from routinely writing ahead of need, and future sessions
should default back to the lazy-gap-filling rule unless asked otherwise
again.

## Change Management

This charter and the ADR log are the only documents that can override a
technical decision in the master plan (e.g., section 12). Product/feature
decisions always live in the master plan and are changed there directly.
If you find this charter itself is wrong or incomplete, say so and edit
it — it is not exempt from the rules it sets for everything else.
