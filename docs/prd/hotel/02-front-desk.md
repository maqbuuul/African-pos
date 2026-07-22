# Hotel PRD 02: Front Desk (Check-In / Check-Out)

## Scope

Owns arrival/departure operations: check-in, room assignment, check-out,
guest requests during stay. Corresponds to master plan section 8 (Front
Desk Features) and section 24 (Check-In/Check-Out Happy Paths). Does not
own the reservation itself (Hotel PRD 01) or folio charge rules in
detail (Hotel PRD 04) — this module executes the transitions those
modules define.

**Status note:** see Hotel PRD 01 — Year 2+ priority. Build phase:
**H3**, see `BUILD_WORKFLOW_HOTEL.md`.

## Dependencies

Hotel PRD 01 (Reservations), Hotel PRD 03 (Room & Housekeeping — room
readiness gates check-in), Hotel PRD 04 (Folio).

## User Stories

- As a **receptionist**, I need to check a guest in within minutes:
  verify identity, assign a room, open the folio, done.
- As a **receptionist**, I need to know immediately if a room isn't
  ready, with alternatives, rather than assigning a dirty room.
- As a **guest**, I need late checkout or early check-in handled as a
  normal request, not an exception that breaks the system.
- As a **front office manager**, I need every departure's folio reviewed
  and settled before checkout completes — no guest leaves with an unpaid
  balance silently written off.

## Workflows

### Check-in happy path

Exactly master plan section 24: receptionist opens arrivals → selects
guest → system checks room readiness → receptionist verifies guest
details → assigns room → room → `occupied`, reservation →
`checked_in` → folio opens → guest receives welcome message (via
Restaurant OS PRD 09's notification pipeline).

Blocked states (master plan section 24, restated as this module's
explicit handling, not silent failure):

- Room dirty → show alternative available rooms of the same type, or
  offer to wait with an estimated ready time (from Hotel PRD 03's
  housekeeping task state).
- Payment required (policy-dependent) → request deposit/payment before
  completing check-in.
- Missing guest info → require the location's configured minimum fields
  (name, ID/phone at minimum) before check-in completes.

### ID capture

```text
Receptionist captures guest ID (photo/scan or manual entry, per country
  requirements)
  -> Stored against the guest profile (Hotel PRD 06), not the
     reservation alone -- ID capture is a guest-identity concern that
     should persist across future stays, not be re-collected every visit
```

### Room move

```text
Guest needs to move rooms mid-stay (maintenance issue, guest request,
  upgrade)
  -> Receptionist selects new room (must be available/ready)
  -> Old room -> dirty (housekeeping task created, Hotel PRD 03)
  -> New room -> occupied
  -> Folio charges continue on the same folio -- a room move does not
     create a new folio or lose charge history
  -> Rate adjustment (if the move changes room type/rate) posts as an
     explicit folio entry, never a silent rate change
```

### Late checkout / early check-in

```text
Guest requests late checkout or early check-in
  -> Receptionist checks feasibility against the adjacent
     reservation/housekeeping schedule for that room
  -> Approved: reservation's effective checkout/check-in time updates;
     a late-checkout fee (if applicable per policy) posts to the folio
  -> Declined: guest offered alternatives (baggage storage, day room)
     -- this module doesn't force a binary accept/reject UX
```

### Check-out happy path

Exactly master plan section 24: receptionist opens departures → reviews
folio → system shows unpaid charges → guest pays balance (Hotel PRD 04)
→ receptionist closes folio → guest checked out, room → `dirty`,
housekeeping task created (Hotel PRD 03) → guest receives receipt and
feedback request.

## Screens & UI Behavior

- **Arrivals list**: today's expected arrivals, room-readiness status
  per reservation, VIP flag (Hotel PRD 06) prominently shown.
- **Departures list**: today's expected departures, folio balance
  visible inline (not requiring drill-in to see who owes what).
- **Check-in/check-out screens**: minimal-step flows matching the happy
  paths above — this is the hotel-front-desk equivalent of Restaurant OS
  section 21's "one tap for the most common action" discipline.

## Permissions

| Action | receptionist | front_office_manager |
| --- | --- | --- |
| Check in / check out a guest | Yes | Yes |
| Room move | Yes | Yes |
| Approve late checkout / early check-in | Threshold-limited | Yes |
| Close a folio with an unpaid balance (corporate direct-bill exception) | No | Yes |

## Business Rules

- Check-in cannot complete against a room that isn't `available` or
  `inspected` (Hotel PRD 03's room state machine) — a dirty or
  out-of-order room is never assignable, full stop.
- A folio cannot be closed with an unpaid balance unless the guest is on
  an approved corporate direct-bill account (master plan section 24's
  explicit exception) — every other case requires the balance settled
  first.
- Room status changes automatically as a consequence of check-in/
  check-out/room-move events — front desk staff never manually flip a
  room's status independent of the guest-facing action that should
  cause it.
- A housekeeping task is generated automatically on checkout, never as
  a manual follow-up step someone has to remember.

## Edge Cases & Failure States

- Guest arrives before their room is ready and won't wait: offered an
  upgrade (subject to availability and revenue-manager-configured
  upgrade policy) or a defined compensation path — this module surfaces
  the option, doesn't automate the business decision.
- Departure guest disputes a folio charge: folio charge is never
  silently removed — a dispute routes to `folios.status = disputed`
  (master plan section 24's folio state machine) for manager resolution,
  preserving the original charge as data.
- Check-in attempted for a reservation still in `deposit_pending`
  (deposit policy requires payment first): blocked with a clear prompt
  to collect the deposit at the desk, not a silent bypass.

## Data Model

`DATA_MODEL.md` Later Hotel OS: `stays`, `rooms`, `folios`,
`guest_requests`, `housekeeping_tasks` (created here, owned by Hotel
PRD 03).

## Events Emitted

- `GuestCheckedIn` / `GuestCheckedOut` / `RoomMoved` — consumed by:
  Hotel PRD 03 (room state), Hotel PRD 04 (folio), Hotel PRD 08
  (occupancy reporting).
- `LateCheckoutApproved` / `EarlyCheckInApproved` — consumed by: Hotel
  PRD 03 (housekeeping schedule awareness), Hotel PRD 04 (fee posting).

## API Surface

- `GET /hotel/arrivals`, `GET /hotel/departures`
- `POST /hotel/reservations/:id/check-in`,
  `POST /hotel/reservations/:id/check-out`
- `POST /hotel/stays/:id/room-move`
- `POST /hotel/stays/:id/late-checkout`, `POST /hotel/stays/:id/early-checkin`

## Offline Behavior

Not assumed offline-first — see Hotel PRD 01's same note.

## Acceptance Criteria

Exactly master plan section 24's acceptance tests for both happy paths:
folio cannot close with unpaid balance unless corporate-approved; room
status changes automatically after checkout; housekeeping task is
generated.

## Non-Goals

- Housekeeping task execution/checklist detail — Hotel PRD 03.
- Folio charge posting rules in detail — Hotel PRD 04.
