# PRD 08: Shift & Cash Drawer

## Scope

Owns the operational shift lifecycle and cash drawer reconciliation —
open, count, close, variance detection. Corresponds to master plan
section 7 (shift summary, close shift report, real-time shift P&L) and
`DATA_MODEL.md` (`shifts`, `cash_drawer_sessions`). Consumes payment
events from PRD 07; does not own payment capture itself.

## Dependencies

PRD 01 (Auth) — shift and drawer actions are staff-scoped and
permission-gated. PRD 07 (Payments) — cash payments/refunds/tips feed
this module's expected-cash calculation.

## User Stories

- As a **cashier**, I need to open my shift with a starting cash float
  and close it with a count, so my personal accountability for the
  drawer is clear and bounded to my own shift.
- As a **branch manager**, I need to see a live shift P&L (revenue, food
  cost, labor cost, gross margin) while the shift is still running, not
  only after close.
- As a **branch manager**, I need cash variance flagged immediately at
  close, with the size and direction visible, so a pattern of small
  losses is catchable before it becomes a big one.
- As an **owner**, I need every shift's close report reconciled to the
  cent against payments and refunds recorded during it, so "did the
  cashier get it right" is a computed fact, not a trust exercise.

## Workflows

### Opening a shift

```text
Cashier (or the first staff member on a device that shift) opens shift
  -> Enters starting cash float (counted, not assumed)
  -> shift created: status=open, opened_by_staff_id, opened_at
  -> cash_drawer_session created: starting_amount = counted float
  -> Device is now "in shift" -- sales can proceed
```

### During the shift

```text
Every cash payment, cash refund, and cash tip-out event (PRD 07) updates
this shift's cash_drawer_session.expected_amount incrementally --
expected cash = starting float + cash sales - cash refunds - cash paid
out (e.g. petty cash, supplier COD)
  -> Non-cash payments (mobile money, card) do not affect the drawer's
     expected cash, but DO count toward the shift's revenue totals for
     the live P&L
  -> Manager can view live shift P&L at any point: revenue so far, food
     cost (from recipe deductions, PRD 12, where available), labor cost
     (from clocked-in staff × wage, if staff/labor data exists), gross
     margin -- explicitly "live," not a projection
```

### Closing a shift

```text
Cashier initiates close -> physically counts cash in drawer
  -> Enters counted amount (broken down by denomination where the UI
     supports it -- denomination-aware cash handling, Module 18)
  -> System compares counted_amount vs expected_amount
     -> variance = counted - expected
     -> If |variance| exceeds a configurable threshold: flagged for
        manager review before the shift can fully close, per master plan
        Module 18's fraud-detection intent -- not a hard block on
        closing the register physically, but a required
        acknowledgment/reason before the shift record finalizes
  -> shift.status -> closed, closed_at, close report generated
  -> cash_drawer_session finalized: starting/expected/counted/variance
     all preserved (append-only, never overwritten by a later
     "correction" -- a correction is its own new adjustment record)
```

### Cash drawer mid-shift adjustment

```text
Manager needs to add/remove cash mid-shift (e.g. paying a supplier COD
from the drawer, or adding change float)
  -> cash_drawer:adjust permission required
  -> Adjustment recorded as its own entry (amount, direction, reason,
     approved_by) -- affects expected_amount going forward, never
     retroactively edits prior expected-amount calculations
  -> Audit log entry (PRD 02) -- this is on the destructive/sensitive
     action list requiring a reason
```

## Screens & UI Behavior

- **Shift open screen**: starting float entry (numeric, denomination
  breakdown optional per location config), confirm.
- **Live shift dashboard** (manager-web, POS manager view): running
  revenue, cash vs. non-cash split, food cost %, labor cost %, gross
  margin — explicitly labeled "live, as of [time]" so it's never mistaken
  for a finalized report.
- **Shift close screen**: side-by-side expected vs. counted, variance
  highlighted (color-coded by severity against the configured
  threshold), reason field appears automatically when variance exceeds
  threshold.
- **Close shift report**: full breakdown — sales by payment method, tips,
  refunds, discounts, voids, variance — the canonical end-of-shift
  document, referenced by PRD 09 for the WhatsApp `SALES` command
  (`BUILD_WORKFLOW.md` mentions this integration point directly).

## Permissions

| Action | cashier | supervisor | branch_manager |
| --- | --- | --- | --- |
| Open own shift | Yes | Yes | Yes |
| Close own shift | Yes | Yes | Yes |
| View live shift P&L | No (own sales only) | Yes | Yes |
| Adjust cash drawer mid-shift | No | Approval-gated | Yes |
| Close shift with variance above threshold | Requires manager ack | Yes | Yes |
| Reopen a closed shift | No | No | Yes (rare, audited) |

## Business Rules

- One active shift per device at a time (a device can't have two open
  shifts simultaneously), but a location can have multiple concurrent
  shifts across multiple devices/cashiers — shift is scoped to
  (device, staff), not the whole location.
- Expected cash is computed, never manually entered — it's a pure
  function of starting float + this shift's cash-affecting payment
  events (PRD 07). Manual override of the *expected* figure is never
  allowed; only the *counted* figure is human-entered, which is the
  whole point of the reconciliation.
- Variance beyond threshold requires an explicit reason before the shift
  record is considered finalized — this mirrors PRD 02's reason-required
  rule for financial discrepancies, treating a cash variance as
  effectively a destructive/sensitive event even though nothing was
  literally deleted.
- Shift and cash_drawer_session records are append-only once closed —
  a discovered error after close is corrected via a new adjustment
  record referencing the original shift, never by editing the closed
  shift's figures.

## Edge Cases & Failure States

- Cashier closes shift with items still on open, unpaid orders: allowed,
  but those orders/tables remain open under the *next* shift/cashier at
  that device — closing a shift is a cash-accountability boundary, not a
  requirement that all orders be finished.
- Device goes offline mid-shift and payments queue locally: expected-cash
  calculation uses locally-queued payment events immediately (doesn't
  wait for sync) — the cashier's own device must reflect its own
  drawer accurately regardless of connectivity, since the physical drawer
  is right there.
- Two staff share a device across a shift boundary without properly
  closing/reopening (one forgets to close): the close screen for the
  first staff member is still available/promptable even after the
  second staff member has started selling — the platform doesn't lose
  track of an un-closed shift, it flags it as an open exception to the
  manager.

## Data Model

`DATA_MODEL.md` Payments And Cash: `shifts`, `cash_drawer_sessions`.

## Events Emitted

- `ShiftOpened` / `ShiftClosed` — consumed by: PRD 09 (WhatsApp `SALES`
  close report delivery), PRD 14 (shift reporting), notification module
  (branch-offline / shift-not-closed alerts).
- `CashVarianceDetected` — consumed by: notification module (immediate
  manager alert per master plan Module 4's "cash variance" operational
  alert), PRD 17 (fraud/anomaly detection features), audit log.
- `CashDrawerAdjusted` — consumed by: audit log, live P&L recalculation.

## API Surface

- `POST /shifts/open`, `POST /shifts/:id/close`
- `GET /shifts/:id/live-pnl`
- `POST /shifts/:id/cash-drawer/adjust`
- `GET /shifts/:id/close-report`

## Offline Behavior

Fully offline-capable — shift open/close and drawer adjustments are
core POS-device operations that must work without connectivity (this is
literally what's on the register). Live P&L figures that depend on
non-local data (e.g. labor cost from a separate staff-scheduling system)
may show a "last synced" figure rather than a true live one while
offline — the UI must be explicit about which numbers are locally
authoritative (cash) versus synced estimates (labor cost).

## Acceptance Criteria

- A shift's close report reconciles exactly (to the cent) against the
  sum of its payment, refund, and tip events — matches `BUILD_WORKFLOW.md`
  P8's shift-report-to-the-cent requirement referenced in P9.
- A variance beyond the configured threshold blocks shift finalization
  until a reason is entered, verified by attempting to close with an
  induced variance and no reason.
- Live shift P&L updates within one payment event's processing time
  (not batched/delayed) for cash and confirmed non-cash payments.

## Non-Goals

- Payroll/wage calculation itself (labor cost here is an input read
  from staff/scheduling data, not computed or owned by this PRD).
- Multi-day/multi-shift consolidated reporting — PRD 14.
