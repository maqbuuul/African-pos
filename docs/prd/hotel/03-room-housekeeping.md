# Hotel PRD 03: Room & Housekeeping Management

## Scope

Owns room inventory, room status state machine, and the housekeeping
task lifecycle. Corresponds to master plan section 8 (Room Management
Features, Housekeeping Features) and section 24 (room and housekeeping
task state machines, Housekeeping Workflow). Does not own maintenance
tickets in detail (Hotel PRD 05, though this module creates them when
housekeeping finds damage) or folio/rate data (Hotel PRD 01/04).

**Status note:** see Hotel PRD 01 — Year 2+ priority. This PRD's scope
splits across two build phases in `BUILD_WORKFLOW_HOTEL.md`: room
state machine and static room/room-type data is **H1** (foundational,
built before reservations); the housekeeping task workflow (assignment,
checklist, inspection) is **H5** (built after front desk, since checkout
is what triggers it).

## Dependencies

Hotel PRD 01 (room types feed reservation availability), Hotel PRD 02
(checkout triggers dirty-room/housekeeping-task creation).

## User Stories

- As a **housekeeping manager**, I need to assign cleaning tasks by
  priority (a dirty room with an arrival in 30 minutes outranks one with
  no arrival today).
- As a **housekeeper**, I need a clear checklist per room, not a vague
  "clean it" instruction.
- As an **inspector**, I need to approve or fail a cleaned room before
  it's sellable again, with a record of what failed if it fails.
- As a **front office manager**, I need real-time room status (available,
  occupied, dirty, cleaning, inspected, maintenance, out of order) to
  drive check-in decisions accurately.

## Workflows

### Room state machine

Exactly master plan section 24: `available → reserved → occupied →
dirty → cleaning → inspected → available`, with `maintenance` and
`out_of_order` reachable from any state (a room can break at any time,
not only between guests).

### Housekeeping task state machine

Exactly master plan section 24: `pending → assigned → in_progress →
done → inspected`, with `failed_inspection` looping back to `assigned`
for re-cleaning.

### Housekeeping workflow

Exactly master plan section 24:

```text
Checkout creates a dirty room (Hotel PRD 02's automatic trigger)
  -> Housekeeping manager assigns the cleaning task (priority-ordered:
     rooms with a near-term arrival first, per master plan section 8's
     "priority rooms" feature)
  -> Housekeeper starts cleaning, works through the checklist:
     change linen, clean bathroom, restock amenities, check minibar,
     check lights and AC, report damage, upload photo (optional)
  -> Room -> cleaning_done (task.status = done)
  -> Inspector reviews -> approves (room -> available, task -> inspected)
     or fails (task -> failed_inspection, back to a housekeeper for
     re-cleaning, with the specific failure reason recorded)
```

### Damage reporting during cleaning

```text
Housekeeper reports damage found during cleaning (checklist item)
  -> Maintenance ticket created automatically (Hotel PRD 05), linked to
     the room and the housekeeping task that found it
  -> Room may transition to maintenance if the damage makes it
     unsellable, decided by the housekeeping manager/inspector, not
     auto-inferred from the report alone
```

### Minibar and linen tracking

```text
Housekeeper records minibar consumption during the checklist
  -> Consumed items post as a folio charge (Hotel PRD 04) against the
     in-house guest, if any
  -> Linen usage tracked for inventory/laundry planning (a lightweight
     count, not a full Restaurant-OS-style stock-movement ledger unless
     a property specifically needs that level of tracking)
```

## Screens & UI Behavior

- **Housekeeping dashboard** (housekeeping manager): assigned rooms,
  cleaning status, inspection queue, delayed rooms, maintenance
  blockers — exactly master plan section 8's Housekeeping dashboard
  spec.
- **Housekeeper task view** (mobile/tablet, per-housekeeper): assigned
  rooms for the shift, checklist per room, damage-report/photo-upload
  action.
- **Room status board** (front desk, housekeeping manager): grid of
  every room, color-coded by state (green = available, per Restaurant
  OS's fixed color semantics extended to this vertical, master plan
  section 30).

## Permissions

| Action | housekeeper | housekeeping_manager | front_office_manager |
| --- | --- | --- | --- |
| Complete a checklist item | Yes (assigned rooms) | Yes | No |
| Assign/reassign tasks | No | Yes | Yes |
| Approve/fail inspection | No | Yes (if also inspector-certified) | No |
| Take a room out of order | No | No | Yes |

## Business Rules

- Room status is driven by events (checkout, inspection outcome,
  maintenance report), never manually set to an arbitrary state by
  front desk staff — this mirrors Restaurant OS PRD 04's "table state is
  derived from events, not free-form staff input" rule applied to rooms.
- A room cannot skip `inspected` on the way back to `available` unless a
  location explicitly configures self-inspecting housekeepers (a
  location-level policy, not a per-room shortcut a housekeeper can take
  unilaterally).
- Priority rooms (near-term arrival) are surfaced, not silently sorted
  — the housekeeping dashboard shows *why* a room is prioritized (e.g.
  "VIP arrival 2pm"), consistent with the platform-wide principle that
  the system explains, never just dictates (Restaurant OS master plan
  Product Rule 9, applied here).

## Edge Cases & Failure States

- Housekeeper reports damage severe enough to require immediate
  maintenance hold, but no housekeeping-manager is available to confirm:
  the room transitions to `maintenance` automatically if the damage
  report is flagged "unsellable," with the housekeeping manager notified
  to confirm/reverse — the guest-facing sellability risk (double-booking
  a broken room) is worse than a possibly-premature hold.
- Inspection fails repeatedly on the same room: after a configurable
  number of failed inspections, escalates to the housekeeping manager
  directly rather than looping indefinitely back to the same
  housekeeper.
- Checkout creates a dirty-room task while the room is already mid-
  cleaning from a prior guest's early checkout edge case (rare, but
  possible with same-day turnover): tasks queue rather than overwrite
  — the system never loses track of a room needing attention because a
  second trigger arrived.

## Data Model

`DATA_MODEL.md` Later Hotel OS: `rooms`, `room_types`,
`housekeeping_tasks`, `maintenance_tickets` (created here, owned by
Hotel PRD 05).

## Events Emitted

- `RoomStateChanged` — consumed by: Hotel PRD 01 (availability), Hotel
  PRD 02 (check-in readiness checks), Hotel PRD 08 (housekeeping
  productivity reporting).
- `HousekeepingTaskAssigned` / `HousekeepingTaskCompleted` /
  `InspectionFailed` — consumed by: Hotel PRD 08 (housekeeping
  dashboard/productivity), notification module (delayed-room alerts).
- `DamageReported` — consumed by: Hotel PRD 05 (maintenance ticket
  creation), Hotel PRD 04 (minibar/damage folio charge).

## API Surface

- `GET /hotel/rooms`, `PATCH /hotel/rooms/:id/status`
- `POST /hotel/housekeeping-tasks`, `PATCH /hotel/housekeeping-tasks/:id`
- `POST /hotel/housekeeping-tasks/:id/inspect` (approve/fail)

## Offline Behavior

Housekeeper task views benefit from offline tolerance (housekeepers
often work in areas with poor in-building signal) more than front-desk
screens do — worth an explicit offline-capable design for the
housekeeper task-completion flow specifically, following Restaurant
OS's operation-log pattern (PRD 11), even if front desk itself stays
online-only. Flagged here as a design decision to make explicitly when
this PRD is actually built, not assumed either way.

## Acceptance Criteria

- Checkout reliably creates exactly one housekeeping task per dirty
  room, never zero (a guest silently leaves an uncleaned room
  unnoticed) or duplicated.
- A room cannot become `available` without passing inspection, unless
  the location has explicitly configured self-inspection.
- Priority ordering on the housekeeping dashboard correctly surfaces
  near-term-arrival rooms first, verified against a test dataset with
  mixed arrival times.

## Non-Goals

- Laundry/linen full inventory management — lightweight tracking only,
  per Business Rules above; a full Restaurant-OS-style stock ledger for
  linens is a later enhancement if a property needs it.
- Maintenance work-order detail — Hotel PRD 05.
