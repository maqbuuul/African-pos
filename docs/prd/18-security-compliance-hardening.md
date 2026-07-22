# PRD 18: Security, Compliance & Hardening

## Scope

Owns pre-launch security validation, load testing, backup/disaster
recovery, and staff training materials — the gate every prior PRD passes
through before real merchants depend on the system. Corresponds to
`BUILD_WORKFLOW.md` P18. Also the natural home for the country-specific
compliance requirements from master plan Module 18 (Africa Market
Compliance And Localization) that cut across every other module rather
than belonging to one of them. This PRD is process- and
verification-heavy rather than feature-heavy — it doesn't introduce new
user-facing functionality, it proves the functionality from PRD 00–17
actually holds under adversarial and failure conditions.

## Dependencies

Everything — this is explicitly the last phase before general
availability (`BUILD_WORKFLOW.md`: "Depends on: everything above").

## User Stories

- As an **owner**, I need certainty that another tenant can never see my
  data, under any bug or edge case — not just "we tried to prevent it."
- As an **owner**, I need certainty that a confirmed payment is never
  lost, even if the database itself fails and has to be restored from
  backup.
- As a **new cashier/waiter/manager/chef**, I need training material
  that matches the actual product, not a stale document from an earlier
  build.
- As the **platform**, I need to know the order engine and payment
  webhooks hold up at real transaction volume before a merchant finds
  out the hard way during their Friday dinner rush.

## Workflows

### Security review

```text
Systematic adversarial testing against every prior PRD's stated
guarantees, not a generic checklist:
  - Permission bypass attempts: for every permission key in master plan
    section 22, attempt the gated action as a role that should NOT have
    it, confirm rejection at the API layer (not just hidden in UI)
  - Tenant isolation fuzzing: attempt cross-tenant reads/writes via
    direct API calls with a foreign organization_id/location_id,
    confirm RLS rejects every attempt (PRD 00's core guarantee)
  - Webhook signature verification: attempt to submit unsigned or
    incorrectly-signed webhooks to every integration endpoint (PRD
    07/15/16/19), confirm rejection before any domain command runs
  - Secrets audit: confirm no credentials appear in logs, API
    responses, or version control (PRD 15/16's "credentials encrypted
    at rest, never logged" rule, verified rather than assumed)
```

### Load testing

```text
Order engine (PRD 05) and payment webhooks (PRD 07) tested at target
transaction volume
  -> Identifies the actual bottleneck (database connection pool,
     BullMQ worker throughput, webhook processing) before a real rush
     finds it
  -> Establishes a baseline for future capacity planning, not a one-time
     pass/fail
```

### Backup and disaster recovery

```text
PostgreSQL backup/restore drill: full backup taken, database destroyed,
restored from backup, verified against a known-good checksum of critical
tables (payments, orders, audit_logs above all)

Disaster recovery runbook covers, at minimum:
  - Device loss (PRD 01's device deauthorization + PRD 11's
    "deauthorizing doesn't retroactively invalidate already-synced
    data" behavior, verified in practice)
  - API outage (what happens to in-flight offline devices -- they
    should degrade to fully-offline operation per PRD 11, not error out)
  - Payment provider outage (PRD 07's payment_intent timeout/failure
    path, verified against a real simulated provider outage)
  - Delivery platform outage (PRD 16's integration health
    detection, verified)

Full outage-and-recovery drill: kill the API, kill Postgres, restore
from backup -> must complete with ZERO data loss on already-confirmed
payments, and offline devices must resync cleanly afterward (exact
BUILD_WORKFLOW.md P18 acceptance gate)
```

### Staff training materials

```text
Role-specific training content for waiter, cashier, manager, kitchen
roles -- built against the actual shipped product (screenshots/flows
from the real app, not mockups), covering each role's PRD 05/06/07/08's
narrow workspace (master plan section 20's Product Design Rule)
```

### Country compliance verification (Module 18)

```text
Per launch country, verify:
  - Tax adapter correctness (e.g. Kenya KRA eTIMS -- PRD 09's fiscal
    submission flow tested against the real regulatory requirement, not
    just the internal data model)
  - Load-shedding UX (PRD 11's battery/connectivity banner) tested on
    real target hardware, not just simulated
  - Payment provider availability matches what's actually offered to
    merchants at signup (PRD 00's country-gated signup)
```

## Screens & UI Behavior

No new end-user screens. Internal/support-facing: a security review
findings tracker and a DR runbook document (living, versioned alongside
this PRD, updated as new failure modes are discovered post-launch).

## Permissions

This PRD's activities are performed by the platform team, not exposed to
tenant users at all. The one tenant-facing permission surface it
verifies (rather than defines) is that master plan section 22's full
matrix actually holds under adversarial testing.

## Business Rules

- **Zero data loss on confirmed payments is non-negotiable** — this is
  the single hardest requirement in this entire document set, and the
  DR drill exists specifically to prove it under real failure, not just
  assert it in a PRD.
- Every security finding gets tracked and fixed before launch, or
  explicitly, consciously deferred with a written reason — never
  silently dropped.
- Training materials are treated as a first-class deliverable gating
  launch, not an afterthought — master plan's own framing (Toast/
  Lightspeed-caliber product) assumes frontline staff can actually use
  the product on day one.

## Edge Cases & Failure States

This entire PRD *is* edge-case and failure-state verification for every
other PRD — rather than duplicate that content, the workflows above
enumerate the specific drills; each drill's pass/fail criteria are
defined by the PRD whose guarantee it's verifying (e.g. the DR drill's
zero-data-loss bar is PRD 07's own payment-ledger guarantee, tested
under actual failure rather than assumed from the code).

## Data Model

No new tables. Verifies the integrity guarantees of every table group
already defined across `DATA_MODEL.md` — particularly the append-only/
never-delete tables (`payments`, `refunds`, `audit_logs`,
`stock_movements`, `loyalty_events`) that the DR drill's checksum
verification depends on.

## Events Emitted

- `SecurityFindingLogged` / `SecurityFindingResolved` — internal
  tracking, not a tenant-facing domain event.
- `DrDrillCompleted` (pass/fail, findings) — internal, informs the
  launch go/no-go decision.

## API Surface

None new — this PRD tests existing surfaces (every prior PRD's API)
rather than adding its own.

## Offline Behavior

N/A directly — this PRD verifies that PRD 11's offline guarantees hold
under the specific failure scenarios above (API outage, device loss),
rather than defining new offline behavior itself.

## Acceptance Criteria

Exactly `BUILD_WORKFLOW.md` P18's gate: a full outage-and-recovery drill
(kill the API, kill Postgres, restore from backup) completes with zero
data loss on already confirmed payments, and offline devices resync
cleanly afterward. Additionally: every permission-bypass and tenant-
isolation-fuzzing attempt is rejected, and no credentials appear in logs
or API responses.

## Non-Goals

- Ongoing security operations (SOC monitoring, penetration testing
  cadence post-launch) — this PRD is the pre-launch gate; ongoing
  security posture is an operational practice, not a one-time PRD
  deliverable, and belongs in the Engineering Handbook (this backlog's
  pending Volume) once it exists.
- Formal compliance certification (PCI-DSS, SOC 2) — not assumed as a
  P18/MVP requirement; revisit as an ADR when an enterprise customer or
  payment partner actually requires it.
