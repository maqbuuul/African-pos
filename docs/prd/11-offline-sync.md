# PRD 11: Offline Sync

## Scope

Owns making every offline-capable module (PRD 04, 05, 06, 07, 08 above
all) actually work with no connectivity, and reconcile cleanly on
reconnect. This PRD is thinner than most in this backlog by design — the
detailed mechanics already live in master plan section 27 and
`docs/adr/0001-tech-stack.md` decision 6, and this document's job is to
state the product-level guarantees and workflows without re-deriving
that detail. Corresponds to `BUILD_WORKFLOW.md` P11.

## Dependencies

Every prior PRD in this backlog that runs on `apps/pos-mobile` or
`apps/kds-web` depends on this one being correct — this is `BUILD_WORKFLOW.md`'s
explicit note that offline sync "can start its device-side schema early
but its [full implementation] depends on P5, P7 stable" (schema and state
machines frozen enough not to change weekly).

## User Stories

- As a **cashier**, I need the POS to work exactly the same — same
  speed, same functionality — whether the location's internet is up or
  down, because in this market it will go down, regularly, mid-service.
- As an **owner**, I need zero duplicate orders or payments after a
  device reconnects, because a sync bug that double-charges a customer
  or double-counts revenue is a trust-destroying failure, not a minor
  bug.
- As a **branch manager**, I need to know when a device has been offline
  too long or has unsynced data piling up, so I can intervene before it
  becomes a bigger reconciliation problem.
- As a **Kenyan tenant**, I need my eTIMS tax submissions to never
  silently get lost to a dropped connection (`BUILD_WORKFLOW.md` P11's
  explicit requirement) — connectivity gaps must never become compliance
  gaps.

## Workflows

### Download path (PowerSync-owned — see ADR 0001 decision 6)

```text
Device connects -> PowerSync sync rules stream this location's catalog,
prices, tables, settings, and recent order/customer data down to the
device's local SQLite, scoped by the same organization/location
boundaries RLS enforces server-side
  -> This is continuous/incremental once established, not a full
     re-download each reconnect
  -> This path is NOT hand-built (ADR 0001) -- do not re-implement a
     custom pull/cursor endpoint for this; if PowerSync's sync rules
     can't express something this product needs, that's an ADR-worthy
     problem to raise, not a reason to quietly build a parallel path
```

### Upload path (custom, per master plan section 27)

```text
Device performs a write while offline (order item added, payment taken,
void, shift closed, etc. -- any action from PRD 04/05/06/07/08)
  -> Written to local SQLite immediately, UI reflects it immediately
     (offline is a first-class mode, not a degraded one -- master plan
     Product Rule 6)
  -> Operation appended to the local upload queue in the exact shape
     specified in master plan section 27: op_id, tenant_id, location_id,
     device_id, actor_id, entity_type, entity_id, operation, payload,
     created_at, base_version
  -> On reconnect: PowerSync's client-side upload-queue mechanism calls
     the custom upload handler, which POSTs to /sync/push
  -> Server validates tenant/device, applies operations in order,
     returns accepted-ops + local-to-server ID mappings + any conflicts
  -> Device updates local IDs/state from the response; any conflict
     follows the per-entity policy in master plan section 27 (append-
     only merge for order items, stock movements not overwrites, server
     wins for product config, phone-based customer merge, cash-vs-
     mobile-money payment rules)
```

### Reconnection and reconciliation

```text
Device regains connectivity after an offline period
  -> Upload path drains the local queue first (device's own actions take
     priority so its own state becomes authoritative for what it did)
  -> Download path catches the device up on everything that changed
     elsewhere while it was offline
  -> UI surfaces sync status honestly: "X operations pending" while
     draining, not a binary online/offline indicator that hides a large
     backlog
```

### Load-shedding / connectivity-loss UX

```text
Device detects battery discharge rate consistent with mains power loss,
or explicit connectivity loss (Module 18)
  -> Persistent "on battery, ~X min remaining" banner (where battery
     signal is available)
  -> Automatic screen dim, non-essential feature disable (dashboards,
     non-urgent sync) -- a UX layer on top of this PRD's sync engine, not
     a separate offline mode
  -> Automatic mobile-hotspot failover when the primary router's
     connectivity drops, independent of the device's own battery state
```

## Screens & UI Behavior

- **Sync status indicator** (persistent, small, present on every POS/KDS
  screen): online/syncing/offline-with-N-pending, never just a binary
  dot — staff need to know if there's a meaningful backlog, not just a
  connectivity fact.
- **Conflict review queue** (manager-web, admin-web): the small subset of
  operations that couldn't auto-resolve (per master plan section 27's
  conflict policy — e.g. a genuinely simultaneous edit to the same
  entity) surfaces here for manual resolution, not silently dropped or
  silently auto-resolved in a way that could be wrong.
- **Device sync health** (admin-web): per-device last-sync time, pending
  operation count, across all of a tenant's devices — support/ops
  visibility for catching a device that's been offline unusually long.

## Permissions

Sync itself isn't a permission-gated user action — every offline write
still goes through the originating module's own permission checks
(PRD 01) before it's queued. Specific to this module:

| Action | branch_manager | admin (internal) |
| --- | --- | --- |
| View device sync health (own location) | Yes | Yes |
| Resolve a flagged conflict | Yes | Yes |
| View sync health across all tenants | No | Yes |

## Business Rules

- Every offline-capable write across every module follows the **same**
  operation-log shape and idempotency guarantee — this PRD defines that
  contract once; individual module PRDs (04/05/06/07/08) reference it
  rather than each defining their own offline behavior from scratch.
- `op_id` is globally unique (per master plan section 27) and the
  `/sync/push` endpoint is idempotent — a retried push (e.g. due to a
  connection drop mid-sync) must never double-apply.
- Conflict resolution is per-entity and explicit (master plan section
  27's table), never a single generic "last write wins" rule applied
  uniformly — financial and inventory data specifically must never
  silently overwrite; they merge as append-only events.
- PowerSync owns replication transport; it does not own business
  conflict rules. That distinction is permanent, not just a bootstrapping
  choice — see ADR 0001 decision 6 for why this split exists and what it
  would mean to change it.

## Edge Cases & Failure States

Master plan section 27's "Sync Conflict Policy" subsection is the
authoritative source for per-entity edge cases (orders, inventory,
products, customers, payments) — not restated here to avoid the two
documents drifting apart. This PRD adds:

- A device offline long enough that its cached catalog is meaningfully
  stale (e.g. days, not hours): on reconnect, the download path must
  fully catch up before the device is considered "trustworthy" for new
  price-sensitive actions — a device shouldn't sell at a week-old price
  it hasn't yet learned was changed, so the UI should indicate "catching
  up" distinctly from "fully synced" rather than treating any
  connectivity as equivalent to full sync.
- A device is lost/stolen while holding unsynced offline data: this is
  a PRD 01 (device deauthorization) concern more than a sync-engine one
  — deauthorizing a device doesn't retroactively invalidate data it
  already synced, but does prevent it from syncing anything further.

## Data Model

No new tables beyond what master plan section 27 and `DATA_MODEL.md`'s
`operation logs and idempotency keys` principle already imply. The
upload-queue's operation-log shape is a wire format, not necessarily a
standalone server-side table — implementation detail for whoever builds
P11, informed by PowerSync's actual client SDK shape.

## Events Emitted

- `SyncCompleted` / `SyncConflictDetected` — consumed by: admin-web
  device health view, notification module (persistent conflict backlog
  alert to branch manager).
- Every event described in PRD 04/05/06/07/08's own "Events Emitted"
  sections still fires from offline-originated actions once synced —
  this module doesn't introduce a parallel event stream, it's the
  delivery mechanism for the same events under degraded connectivity.

## API Surface

- `POST /sync/push` (upload path, idempotent, ordered)
- PowerSync's own sync-rule-driven download path is not a
  hand-built REST endpoint — configured via PowerSync's service, not
  listed here as a custom API.
- `GET /sync/device-health` (admin/manager visibility)

## Offline Behavior

This entire PRD *is* the offline-behavior specification for the rest of
the platform — see each dependent PRD's own "Offline Behavior" section
for what specifically works and what specifically requires connectivity
(e.g. mobile money/card payments in PRD 07 cannot complete offline by
design; cash payments can).

## Acceptance Criteria

Exactly `BUILD_WORKFLOW.md` P11's acceptance gate: a device taken fully
offline can open a table, take a full cash-paying dine-in order, and
reconcile cleanly once reconnected, with no duplicate orders or payments
and a correct shift report. A device simulated on low battery shows the
remaining-time banner and disables non-essential features without
interrupting an in-progress sale.

## Non-Goals

- Re-implementing a hand-built replication/download engine — explicitly
  rejected in ADR 0001 decision 6.
- Multi-device real-time collaborative editing guarantees beyond what
  the per-entity conflict policy already provides (e.g. this is not a
  CRDT-based system; simultaneous edits to the same entity are a
  reviewable conflict, not seamlessly merged in every case).
