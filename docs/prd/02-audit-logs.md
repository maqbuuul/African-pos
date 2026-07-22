# PRD 02: Audit Logs

## Scope

Owns the immutable record of every sensitive or destructive action across
the entire platform. Corresponds to master plan Module 3 and
`DATA_MODEL.md`'s `audit_logs` table. This module is a sink, not a
source — nearly every other PRD's "Events Emitted" section feeds it, and
this PRD defines the contract they all write against, plus the read/query
side (search, filtering, export).

## Dependencies

PRD 00 (Multi-Tenancy) for scoping, PRD 01 (Auth) for `actor_id`/
`device_id` identity.

## User Stories

- As an **auditor**, I need to see who did what, when, from where, and
  why, for any destructive action, without relying on staff memory or
  paper trails.
- As a **branch manager**, I need to filter audit events to my location
  and a date range, to investigate a specific discrepancy (e.g., a cash
  drawer variance) quickly.
- As the **platform**, I need audit writes to never be optional or
  skippable, because a missing audit entry for a refund or void is a
  compliance and trust failure, not a minor bug.
- As an **owner**, I need to export audit history for a date range, for
  tax authority or investor due-diligence requests.

## Workflows

### Writing an audit event (the pattern every other module follows)

```text
Module performs a sensitive/destructive action (e.g. order voided)
  -> Before or atomically with the action's own write, module writes an
     audit_logs row: actor_type, actor_id, action, entity_type, entity_id,
     old_value, new_value, reason (required for destructive actions),
     device_id, ip_address
  -> If the action requires a reason and none was provided: block the
     action itself, not just the audit write -- an unreasoned void/refund
     must not be possible to perform, not just possible-but-unlogged
  -> Audit row is written in the same database transaction as the action
     it records, so a failed audit write rolls back the action too
```

### Investigating an incident

```text
Auditor/manager opens audit log search
  -> Filters: date range, location, actor, entity_type, action type
  -> Reviews before/after values inline (no need to cross-reference
     another screen for context)
  -> Exports filtered result set as CSV/PDF if needed for external review
```

### Offline audit events

```text
Staff performs a gated action on an offline POS device
  -> Audit event is written to local queue alongside the business action
     itself, using the same operation-log mechanism (PRD 11)
  -> On reconnect, audit events sync with the same ordering guarantees
     as the actions they describe -- an audit entry must never arrive
     detached from, or out of order relative to, the action it records
```

## Screens & UI Behavior

- **Audit log viewer** (admin-web, owner-web, manager-web scoped to own
  location): filterable table — timestamp, actor, action, entity,
  location, device. Row expansion shows before/after diff and reason.
- **Entity-embedded audit trail**: any screen showing a specific order,
  refund, or stock adjustment shows its own audit history inline (e.g.
  an order detail screen shows every void/discount/reopen applied to it)
  — auditors shouldn't have to leave context to see an entity's history.
- **Reason prompt**: appears at the point of action (void, refund, large
  discount, stock adjustment, rate override), not as a separate
  after-the-fact form — capturing intent requires asking in the moment.

## Permissions

| Action | owner | auditor | branch_manager | others |
| --- | --- | --- | --- | --- |
| View audit logs, own location | Yes | Yes (org-wide) | Yes | No |
| View audit logs, all locations | Yes | Yes | No | No |
| Export audit logs | Yes | Yes | Own location only | No |
| Delete/modify an audit entry | **No one, ever** | — | — | — |

## Business Rules

- Audit logs are **immutable** — no `UPDATE` or `DELETE` path exists at
  the API layer, and the database role the application connects as
  should not have `UPDATE`/`DELETE` grants on `audit_logs` at all
  (defense in depth, not just app-layer discipline).
- A reason is **required**, not optional, for the destructive-action list
  in master plan Module 2 (void, refund, large discount, stock
  adjustment, cash drawer adjustment, rate override, credit limit
  increase, permission change, delete/deactivate). The action itself is
  blocked without one.
- Every audit row captures both `old_value` and `new_value` where the
  action is a change, not just "what happened" — a permission change
  audit entry must show the exact before/after role, not just "role
  changed."
- Audit writes are transactional with the action they describe. There is
  no acceptable failure mode where the business action succeeds and the
  audit write silently fails.
- Retention is indefinite by default (never-delete principle applies to
  audit logs most strongly of any table in the system) — data retention
  settings (Module 1) can define an archive-after period for cost
  reasons, but archived audit logs remain queryable, never purged,
  short of an explicit legal requirement in a specific jurisdiction.

## Edge Cases & Failure States

- Audit write fails due to a transient database error mid-transaction:
  the whole transaction (business action + audit write) rolls back — the
  user sees the action failed and can retry, not a silent gap in the
  trail.
- Two conflicting offline actions on the same entity from two devices
  (e.g. two managers reopen the same closed order while both offline):
  both audit entries are preserved with their own timestamps and
  device_ids; the sync conflict resolver (PRD 11) determines which
  business outcome wins, but neither audit trail is discarded — the
  conflict itself becomes visible in the audit history.
- A staff member is later deactivated/deleted-in-spirit: their historical
  audit entries retain their `actor_id` and preserve the staff name at
  time of action (denormalized snapshot), so history doesn't show
  "unknown actor" after someone leaves.

## Data Model

`DATA_MODEL.md` Shared Foundation: `audit_logs`. Reads `staff`/`users`
for actor display name resolution, `devices` for device metadata.

## Events Emitted

Audit logs are themselves largely a *consumer* of other modules' events,
but also emit:

- `AuditLogExported` — consumed by: product analytics (who's actually
  using the compliance features), notification (optional export-ready
  alert for large exports).

## API Surface

- `GET /audit-logs` (filterable: date range, location, actor, entity_type,
  action)
- `GET /audit-logs/:entity_type/:entity_id` (entity-scoped trail)
- `POST /audit-logs/export`

Audit rows themselves are never created via a direct public endpoint —
they're written internally by every module as a side effect of the
action they describe, never by a client-supplied audit payload (which
would make the trail forgeable).

## Offline Behavior

Fully offline-capable for writing (queued via the operation log, PRD 11)
— an offline device must be able to write audit entries for offline
actions. Reading/searching the full audit log requires connectivity;
a device does not cache the full audit history locally.

## Acceptance Criteria

- Every action on master plan Module 2's destructive-action list produces
  exactly one audit entry with a non-empty reason, verified by attempting
  each action without a reason and confirming it's blocked.
- No API path exists that can modify or delete an existing audit_logs
  row (verified by an automated test attempting `PATCH`/`DELETE` against
  the endpoint and against the database role directly).
- An audit entry written offline appears in the server-side audit log
  after sync with its original timestamp and device_id preserved, not the
  sync time.

## Non-Goals

- Real-time audit-anomaly alerting (that's P17's fraud/anomaly detection
  consuming these events, not this module's job).
- Third-party SIEM export (later, if an enterprise customer needs it —
  not MVP).
