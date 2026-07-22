# Hotel PRD 05: Maintenance

## Scope

Owns work orders, preventive maintenance, and asset tracking for hotel
properties. Corresponds to master plan section 8 (Maintenance Features)
and section 24 (maintenance ticket state machine). Consumes damage
reports from Hotel PRD 03 (Housekeeping); does not own room status
transitions directly, though a maintenance ticket can cause one.

**Status note:** see Hotel PRD 01 — Year 2+ priority. Build phase:
**H6**, see `BUILD_WORKFLOW_HOTEL.md`.

## Dependencies

Hotel PRD 03 (damage reports create tickets here; room status changes
flow back to it).

## User Stories

- As a **maintenance staff member**, I need a prioritized work-order
  queue, not a verbal list from whoever finds a problem.
- As a **maintenance manager**, I need SLA tracking per ticket priority,
  so a broken AC in an occupied room doesn't wait behind a cosmetic
  issue in an empty one.
- As a **general manager**, I need visibility into recurring maintenance
  patterns per asset, so a failing water heater gets replaced instead of
  repeatedly patched.

## Workflows

### Maintenance ticket state machine

Exactly master plan section 24: `open → assigned → in_progress →
waiting_parts → resolved → closed`.

### Work order lifecycle

```text
Ticket created (manually by any staff member, or automatically from
  Hotel PRD 03's damage report)
  -> Priority assigned (urgent/high/medium/low -- urgency weighted by
     whether the room is currently occupied/sellable, per master plan
     section 8's "priority levels")
  -> Maintenance manager assigns to a staff member -> status: assigned
  -> Work begins -> in_progress
  -> If parts needed and unavailable -> waiting_parts (ticket doesn't
     silently stall with no visible reason)
  -> Work completes -> resolved
  -> Manager/GM confirms and closes -> closed, room released from
     `maintenance` status if it was held (Hotel PRD 03)
```

### Preventive maintenance

```text
Scheduled preventive tasks (per asset type -- e.g. AC service every 6
  months) generate tickets automatically ahead of the due date, not
  waiting for a failure to trigger the first ticket
  -> Maintenance history per asset (Hotel PRD 08's "maintenance
     prediction" ML model consumes this) informs the schedule over time
```

### Asset tracking

```text
Assets (AC units, water heaters, appliances, furniture) tracked with
  install date, warranty, and full maintenance/parts-usage history
  -> A recurring-issue pattern on one asset (three tickets on the same
     unit in 90 days, for example) is visible on the asset's own record,
     not just buried across separate tickets
```

## Screens & UI Behavior

- **Maintenance queue** (maintenance staff): assigned tickets,
  priority-sorted, SLA countdown visible per ticket.
- **Maintenance manager dashboard**: open tickets by priority/SLA
  status, overdue tickets flagged, staff workload.
- **Asset record**: install/warranty info plus full maintenance history
  inline — a manager looking at one asset shouldn't have to search
  tickets separately.

## Permissions

| Action | maintenance_staff | maintenance_manager | general_manager |
| --- | --- | --- | --- |
| Create a ticket | Yes | Yes | Yes |
| Assign/reassign tickets | No | Yes | Yes |
| Update ticket status | Yes (assigned tickets) | Yes | Yes |
| Close a ticket | No | Yes | Yes |
| View asset history/maintenance analytics | No | Yes | Yes |

## Business Rules

- A ticket's priority accounts for room occupancy status — an urgent
  issue in an occupied, in-house room outranks the same issue type in a
  vacant room, computed at ticket creation, not left to the assigning
  manager's memory of which rooms are occupied.
- SLA tracking is per-priority-level, and an SLA breach is a visible,
  escalating signal (dashboard flag, eventually a notification), never a
  silently-missed deadline.
- Every ticket records parts usage against the specific asset it
  concerns — this is what makes asset-level maintenance history and the
  eventual predictive-maintenance model (Hotel PRD 08) possible; a
  ticket resolved without linking to an asset record loses that value.

## Edge Cases & Failure States

- A ticket is closed but the underlying issue recurs within days:
  reopening isn't a separate mechanic — a new ticket is created,
  explicitly linked to the prior one via the asset's shared history, so
  the pattern is visible without needing a formal "reopen" state that
  would complicate the state machine for a rare case.
- Ticket marked `waiting_parts` indefinitely: surfaced as a stale-ticket
  exception after a configurable duration, so a genuinely stuck ticket
  doesn't silently age out of anyone's attention.
- A damage report from housekeeping (Hotel PRD 03) creates a ticket for
  a room that's simultaneously being addressed by a directly-reported
  ticket: duplicate-ticket detection (same room, overlapping issue
  description) flags for the maintenance manager to merge/dedupe rather
  than silently running two parallel work orders.

## Data Model

`DATA_MODEL.md` Later Hotel OS: `maintenance_tickets`. Asset tracking
(`assets`, `asset_maintenance_history`, `asset_parts_usage`) is not yet
itemized in `DATA_MODEL.md` — flagged as a schema gap for implementation.

## Events Emitted

- `MaintenanceTicketCreated` / `MaintenanceTicketAssigned` /
  `MaintenanceTicketResolved` — consumed by: Hotel PRD 03 (room status
  release), Hotel PRD 08 (maintenance reporting).
- `SlaBreached` — consumed by: notification module (manager escalation).

## API Surface

- `POST /hotel/maintenance-tickets`,
  `PATCH /hotel/maintenance-tickets/:id`
- `GET /hotel/assets/:id/history`

## Offline Behavior

Not assumed offline-first — see Hotel PRD 01's same note, though a
maintenance staff member's mobile ticket-update flow is a reasonable
future candidate for offline tolerance, similar to the housekeeper
task-completion note in Hotel PRD 03.

## Acceptance Criteria

- Every damage report from Hotel PRD 03 produces exactly one linked
  maintenance ticket.
- A ticket's SLA countdown correctly reflects its priority level and
  flags breach when exceeded.
- Asset history correctly accumulates every ticket/parts-usage record
  linked to that asset, queryable as one view.

## Non-Goals

- Predictive maintenance model logic itself — Hotel PRD 08 (ML models)
  consumes this module's history data; this PRD only records it.
- Vendor/contractor management for outsourced repairs — later
  enhancement if a property needs it.
