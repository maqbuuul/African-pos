# PRD 04: Floor Plan & Tables

## Scope

Owns the physical/logical table layout and the table state machine for
full-service dining. Corresponds to master plan section 7 Front Of House
Features (floor plan, table status, merge/split/transfer) and
`DATA_MODEL.md` (`floor_plans`, `restaurant_tables`). Does not own order
content (PRD 05) — a table's state is driven by its associated order's
lifecycle, but this module owns the table entity and its own transitions
(cleaning, blocked, reserved) that exist independent of any single order.

## Dependencies

PRD 00 (Multi-Tenancy), PRD 01 (Auth/permissions). PRD 05 (Order Engine)
is a peer dependency — table state and order state drive each other, so
both PRDs must be read together; this one owns the table side of that
relationship.

## User Stories

- As a **waiter**, I need to see every table's status at a glance
  (available, seated, food ready, bill requested) so I know where to go
  next without walking the floor.
- As a **host/waiter**, I need to merge two tables for a large party or
  split one table's order across two checks, without losing any items
  already ordered.
- As a **branch manager**, I need to configure the floor plan (add/move/
  remove tables, set capacity) to match how the physical space is
  actually used, including temporary tables for overflow.
- As a **waiter**, I need to transfer a table to another waiter's section
  mid-service (shift handoff, or I'm needed elsewhere) without
  interrupting the guest's experience.

## Workflows

### Table state machine

```text
available -> seated (host/waiter seats a party)
seated -> ordered (first order_item added)
ordered -> food_ready (kitchen bumps all items for this table -- PRD 06)
food_ready -> eating (waiter marks served, or auto-transitions on first
                       item delivery confirmation)
eating -> bill_requested (guest or waiter requests the bill)
bill_requested -> payment_pending (payment flow started -- PRD 07)
payment_pending -> paid (payment completed)
paid -> cleaning (table marked for reset)
cleaning -> available (staff confirms table reset)

Any state -> reserved (a reservation claims the table for a future time)
Any state -> blocked (manager takes a table out of rotation -- maintenance,
                       private event, etc.)
```

Not every transition is linear in practice — a table can go directly
from `eating` back toward more ordering (guest orders dessert after
mains), which doesn't regress the state machine backward; it's handled
as "still eating, new items added," not a state transition.

### Seating a party

```text
Host/waiter selects an available table on the floor plan
  -> Enters party size (validated against table capacity, with an
     explicit override for "seat anyway" if needed)
  -> Table -> seated
  -> Order is implicitly opened for this table (empty order, ready for
     items) -- see PRD 05 for order creation itself
```

### Merge / split / transfer

```text
Merge: waiter selects two+ adjacent tables -> confirms merge
  -> Orders from all merged tables combine into one order
  -> Merged tables show as one logical unit on the floor plan until
     explicitly un-merged at payment/cleaning time
  -> Audit log entry: which tables merged, by whom

Split: waiter selects a table with an existing order -> chooses split
  method (by item, by seat, evenly -- see PRD 05 for the bill-splitting
  logic itself, which this workflow triggers)
  -> Table can end up producing multiple bills without splitting the
     physical table entity itself

Transfer: waiter or manager reassigns a table's assigned server
  -> No order/table state change -- only the assigned-staff reference
     changes
  -> Outgoing and incoming waiter both notified
  -> Audit log entry: table, from-staff, to-staff, by-whom (self-transfer
     vs. manager-initiated)
```

## Screens & UI Behavior

- **Floor plan view** (POS, manager-web): visual table layout,
  color-coded by state (per master plan section 21's design rule: "each
  role gets a narrow workspace" — waiter's floor view shows only their
  section by default, manager sees the whole floor). Target: open table
  loads in under 500ms from local cache (master plan section 21).
- **Table detail**: tapping a table shows its current order summary,
  elapsed time in current state (surfaces slow tables — e.g. "food ready
  8 minutes, not yet served" is a visible signal, not buried), and the
  seat/merge/split/transfer actions.
- **Floor plan editor** (manager-web): drag-and-drop table placement,
  capacity, shape, section assignment. Changes apply immediately, don't
  require a "publish" step (this isn't a high-risk change needing a
  review gate).

## Permissions

| Action | waiter | supervisor | branch_manager |
| --- | --- | --- | --- |
| Seat a party, change own table's state | Yes | Yes | Yes |
| Merge/split tables | Yes (own section) | Yes | Yes |
| Transfer table (self-initiated) | Yes | Yes | Yes |
| Transfer table (reassign another waiter's) | No | Yes | Yes |
| Block a table (maintenance/event) | No | Yes | Yes |
| Edit floor plan layout | No | No | Yes |

## Business Rules

- A table's state is derived primarily from its order's lifecycle events
  (PRD 05) but stored independently, because `cleaning`, `reserved`, and
  `blocked` have no corresponding order state — treat table state as its
  own state machine that *listens* to order events, not as a computed
  view of order state.
- Merging tables combines orders (all items, all seats) but preserves
  each original item's seat/course/timing metadata — merging is a
  presentation/billing convenience, not a data-loss event.
- A blocked table cannot be seated, even by a manager override, without
  first explicitly unblocking it — this prevents an accidental sale on a
  table that's out of rotation for a real reason (e.g. broken).
- Table capacity is a soft limit (warns, doesn't hard-block) — African
  hospitality operations frequently seat above nominal capacity for
  family-style dining; a hard block would be actively wrong for this
  market.

## Edge Cases & Failure States

- Two waiters attempt to seat the same available table simultaneously
  (race condition, especially relevant offline-first with multiple
  devices at one location): first write wins; second waiter's device
  shows an immediate "already seated by [name]" rather than silently
  succeeding into a conflicting state.
- A table transitions to `cleaning` while items are still being added
  (edge case: waiter marks bill_requested prematurely, guest orders
  more): reopening from `bill_requested`/`payment_pending` back to
  active ordering is allowed with a manager-visible flag, not blocked
  outright — real dining doesn't always move forward linearly.
- Merged table's split at payment time: system must be able to
  attribute each item back to its originating table/seat even after
  merge, for correct per-seat billing (PRD 07) — merge must preserve
  seat lineage, not flatten it.

## Data Model

`DATA_MODEL.md` Restaurant MVP: `floor_plans`, `restaurant_tables`,
`table_merges`.

## Events Emitted

- `TableStateChanged` (from, to, table_id) — consumed by: KDS (PRD 06,
  for prioritization signals), reports/BI (table turnover metrics, PRD
  14), notification module (e.g. "table waiting on bill" alerts).
- `TablesMerged` / `TableSplit` — consumed by: order engine (PRD 05,
  order consolidation), reports (accurate table-count metrics that don't
  double-count merged tables).
- `TableTransferred` — consumed by: notification module (waiter
  handoff alert).

## API Surface

- `GET /floor-plans/:location_id`, `POST/PATCH /floor-plans` (layout
  editing)
- `GET /tables`, `PATCH /tables/:id/state`
- `POST /tables/merge`, `POST /tables/split`, `POST /tables/:id/transfer`

## Offline Behavior

Fully offline-capable — floor plan layout is cached reference data;
table state changes are business-critical offline writes following the
same operation-log/conflict-policy pattern as orders (PRD 11). Two
offline devices seating the same table produces a genuine conflict that
surfaces on reconnect rather than being silently resolved, per master
plan section 27's conflict-review pattern for unresolvable conflicts.

## Acceptance Criteria

- A waiter can seat a party, and the table visibly transitions through
  its state machine as the order progresses, matching real kitchen/
  service events (not manually re-clicked at each stage where an event
  already implies the transition).
- Merging two tables preserves all items from both, correctly attributed
  by seat, verified by producing a split-by-seat bill afterward that
  matches pre-merge ordering.
- A blocked table cannot be seated without an explicit unblock action
  first, verified by attempting to seat a blocked table directly.

## Non-Goals

- Reservation booking and waitlist management logic itself (a "reserved"
  state exists here as a table-side effect; the reservation/waitlist
  system that sets it is a separate, later PRD not yet in this backlog's
  P0-P19 critical path since Restaurant OS MVP prioritizes walk-in/QR
  ordering first).
- Kiosk/drive-thru specific UI (later enhancement to this PRD's ordering
  channels, not P4 scope).
