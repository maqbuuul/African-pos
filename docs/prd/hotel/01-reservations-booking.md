# Hotel PRD 01: Reservations & Booking Engine

## Scope

Owns availability search, rate plans, and the reservation lifecycle from
inquiry through confirmation. Corresponds to master plan section 8
(Reservation Features, Hotel Workflow) and section 24 (Reservation
Happy Path, reservation state machine). Does not own check-in itself
(Hotel PRD 02) or folio/payment (Hotel PRD 04) — this module's job ends
at a confirmed, deposit-handled reservation ready for arrival.

**Status note:** Hotel OS is a Year 2+ priority per master plan section
3 — this PRD exists so the specification is ready when Hotel OS enters
the build queue, following the same template as the Restaurant OS PRDs
(`docs/prd/00`–`19`). Build phase: **H2**, see
`BUILD_WORKFLOW_HOTEL.md`.

## Dependencies

Restaurant OS PRD 00 (Multi-Tenancy), PRD 01 (Auth & Permissions) —
Hotel OS shares the platform's tenancy and auth foundation, not a
separate one. Hotel PRD 03 (Room & Housekeeping) for room availability
data.

## User Stories

- As a **receptionist**, I need to search availability by date range and
  room type and see real rates, not a static rack rate.
- As a **guest**, I need to book directly (or a receptionist books on my
  behalf) with a clear cancellation policy shown before I commit.
- As a **revenue manager**, I need rate plans (seasonal, corporate,
  package) that apply automatically based on booking conditions, not
  manual price entry per reservation.
- As a **front office manager**, I need group and corporate bookings
  handled as a first-class flow, not a series of individual reservations
  someone has to manually link together.

## Workflows

### Reservation state machine

Exactly master plan section 24: `inquiry → reserved → confirmed →
deposit_pending → deposit_paid → checked_in → in_house → checked_out`,
with `cancelled` and `no_show` reachable from any pre-check-in state.

### Reservation happy path

```text
Receptionist opens availability calendar
  -> Selects room type and date range
  -> System shows available rooms and rates (rate plan resolved by
     date, room type, and booking conditions -- corporate code, package,
     seasonal rate)
  -> Receptionist creates or looks up guest profile (Hotel PRD 06)
  -> Receptionist confirms reservation -> reservation.status = reserved
  -> System creates folio (Hotel PRD 04), initially empty
  -> Guest pays deposit (optional, policy-dependent) ->
     deposit_pending -> deposit_paid, folio balance updated
  -> System sends confirmation (WhatsApp/SMS/email, reusing Restaurant
     OS PRD 09's notification pipeline)
  -> Reservation appears in the arrivals list (Hotel PRD 02)
```

### Group and corporate bookings

```text
Front office manager creates a group booking: multiple rooms, one
  master reservation reference, shared arrival/departure dates
  -> Individual room reservations link to the group reference for
     reporting and billing (can still fold to individual folios or one
     master folio, location-configurable)
Corporate booking: linked to a corporate account (Hotel PRD 04's
  corporate account/aging concept) with a negotiated rate plan and,
  typically, direct-bill (charge to corporate account, not guest credit
  card) at checkout
```

### Cancellation and no-show

```text
Reservation cancelled before arrival
  -> Cancellation policy (per rate plan) calculates any fee -- e.g. free
     cancellation >48h before arrival, one-night charge inside 48h
  -> Fee, if any, posts to the folio; deposit refund/forfeit follows the
     same policy
  -> reservation.status -> cancelled, room released back to availability

No guest arrival by a configured cutoff on arrival date
  -> reservation.status -> no_show
  -> No-show fee policy applies (folio charge per Hotel Payments)
  -> Room released to availability (or held per a location's specific
     no-show-grace-period setting)
```

## Screens & UI Behavior

- **Availability calendar** (receptionist, revenue manager): room-type ×
  date grid, color-coded by availability/rate, drag-select a date range.
- **Reservation builder**: room type, dates, rate plan (auto-suggested,
  overridable with a permission-gated rate override), guest profile
  lookup/create, deposit collection.
- **Group booking console**: multi-room builder under one group
  reference.

## Permissions

| Action | receptionist | front_office_manager | revenue_manager |
| --- | --- | --- | --- |
| Create/modify a standard reservation | Yes | Yes | Yes |
| Override a rate plan rate | No (approval-gated) | Yes | Yes |
| Create a group/corporate booking | No | Yes | Yes |
| Configure rate plans and cancellation policies | No | No | Yes |

## Business Rules

- A room cannot be double-booked — availability checks and reservation
  creation happen against the same authoritative room-inventory read,
  never an eventually-consistent cache that could allow two overlapping
  confirmed reservations for one room.
- A reservation can hold a **room type** before a specific room is
  assigned (assignment happens at check-in, Hotel PRD 02) — this is
  deliberate: assigning a specific room at booking time forecloses
  housekeeping/maintenance flexibility unnecessarily early.
- Deposit payment updates the folio balance immediately and is itself an
  append-only ledger entry (Hotel PRD 04's folio-as-ledger rule) — never
  a mutable "deposit amount" field.
- Rate plans resolve deterministically from (room type, date,
  booking conditions) — there is one rate for a given booking, not a
  negotiable/ambiguous figure decided ad hoc by whoever's at the desk.

## Edge Cases & Failure States

- Two receptionists attempt to book the last room of a type
  simultaneously: first confirmed write wins; the second sees an
  immediate "no longer available" rather than a silently-accepted
  double-booking.
- Group booking where some rooms are available and others aren't:
  partial availability is shown clearly per room, not an all-or-nothing
  block — the front office manager decides how to proceed (split across
  room types, waitlist the shortfall).
- Cancellation policy calculation disagreement (e.g. a corporate rate
  with a non-standard policy): the rate plan's own policy always wins
  over any default — never a global cancellation rule applied blindly
  regardless of which rate plan governed the booking.

## Data Model

`DATA_MODEL.md` Later Hotel OS: `hotel_reservations`, `rate_plans`,
`room_types`, `channel_bookings` (for OTA-sourced reservations, Hotel
PRD 07). `folios` created here, owned in detail by Hotel PRD 04.

## Events Emitted

- `ReservationCreated` / `ReservationConfirmed` / `ReservationCancelled`
  / `NoShowRecorded` — consumed by: Hotel PRD 02 (arrivals list), Hotel
  PRD 04 (folio charges), Hotel PRD 08 (occupancy/ADR reporting).
- `DepositPaid` — consumed by: Hotel PRD 04 (folio balance).

## API Surface

- `GET /hotel/availability`, `GET /hotel/rate-plans`
- `POST /hotel/reservations`, `PATCH /hotel/reservations/:id`,
  `POST /hotel/reservations/:id/cancel`
- `POST /hotel/reservations/group`

## Offline Behavior

Not assumed offline-first at this stage — front desk operations
typically run on a fixed terminal with reliable connectivity, unlike
Restaurant OS's frontline POS. Revisit as an explicit offline PRD
addendum if a real property's connectivity profile demands it, rather
than assuming Restaurant OS's offline requirements transfer unchanged.

## Acceptance Criteria

Exactly master plan section 24's acceptance tests: room cannot be double
booked; reservation can hold room type before room assignment; deposit
updates folio balance; cancellation policy calculates fee correctly.

## Non-Goals

- Channel manager / OTA sync mechanics — Hotel PRD 07.
- Dynamic pricing recommendation logic — Hotel PRD 08 (ML models).
