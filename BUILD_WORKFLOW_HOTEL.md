# AI Build Workflow — Hotel OS

Companion to `BUILD_WORKFLOW.md` (Restaurant OS), same format and same
rules (section 0 below is identical in substance, restated here so this
document is self-contained). This is the execution playbook for Hotel
OS once it enters the build queue — see `HOSPITALITY_OS_MASTER_PLAN.md`
section 3's Year 1 Focus, which scopes Year 1 to Restaurant OS only.
Every phase here assumes Restaurant OS's shared-platform phases (P0–P2
at minimum: foundation infra, shared domain/schema, auth) are already
built, since Hotel OS is a vertical on the same shared platform
(`HOSPITALITY_OS_MASTER_PLAN.md` section 3: "the shared platform should
contain roughly 80% of the codebase"), not a separate system.

Phases are prefixed `H` to avoid collision with Restaurant OS's `P0`–
`P19` numbering when the two are referenced together.

`HOSPITALITY_OS_MASTER_PLAN.md` sections 8/24 define **what** to build.
`docs/prd/hotel/*.md` define the workflows, permissions, business rules,
and acceptance criteria in detail — this document defines **the order**.

## 0. How To Use This Document

Same rules as `BUILD_WORKFLOW.md` section 0:

1. Read each phase's `Depends on` list before starting it.
2. Work only inside the modules/files listed under `Build`, respecting
   the module boundary rule (master plan section 26).
3. A phase is done when its `Acceptance gate` passes, not when the code
   compiles.
4. Never borrow ahead from a later phase.
5. Commit at the end of each completed phase, named for the phase.

## 1. Build Hierarchy

```text
H1 Room & housekeeping foundation   (room types, rooms, room state machine)
H2 Reservations + booking engine    (availability, rate plans, reservation state machine)
H3 Front desk                       (check-in, check-out, room assignment, room move)
H4 Folio + payments + night audit   (folio ledger, hotel payments, room-charge, audit)
H5 Housekeeping workflow            (task assignment, checklist, inspection)
H6 Maintenance                      (work orders, preventive maintenance, assets)
H7 Guest CRM                        (guest identity, preferences, VIP, complaints)
H8 Channel management               (OTA sync: Booking.com, Airbnb, Expedia, Agoda)
H9 Reports + BI + AI                (GM/reception/housekeeping/revenue dashboards, ML, briefings)
```

Dependency graph in plain terms:

- **H1** is foundational — reservations (H2) cannot check real
  availability without room/room-type data existing first, and every
  later phase references rooms.
- **H2 Reservations** is Hotel OS's center of gravity, the way Order
  Engine (P5) is for Restaurant OS — H3 (front desk), H4 (folio), H7
  (guest CRM), and H8 (channel management) all consume or produce
  reservations; they are channels into H2, not replacements for it.
- **H3 Front desk** depends on H1 (room readiness checks) and H2
  (a reservation to check in). H4 (folio) depends on H3, since a folio
  opens at check-in.
- **H5 Housekeeping workflow** depends on H3 — checkout is what creates
  the dirty-room trigger. (H1 already established the room state
  machine and static room data; H5 is the dynamic task-management
  workflow layered on top of it.)
- **H6 Maintenance** depends on H5 — damage reports from housekeeping
  are maintenance's primary ticket-creation trigger, alongside direct
  reports.
- **H7 Guest CRM** depends on H2/H3/H4 — it accumulates identity and
  history from reservation, check-in, and folio events; it cannot be
  built meaningfully first.
- **H8 Channel management** depends on H2 — OTA-sourced reservations
  must go through the same reservation-creation command H2 establishes.
  Master plan section 8 explicitly allows Phase 1 (manual/limited
  integration) before full automated sync, matching `docs/prd/hotel/07-
  channel-management.md`'s own two-phase scope.
- **H9 Reports + BI + AI** depends on H1–H8 — identical reasoning to why
  Restaurant OS's P14/P17 are late: it needs real events from every
  other phase to report on and model.

## 2. Phase-By-Phase Workflow

### H1 — Room & Housekeeping Foundation

Depends on: Restaurant OS P1 (shared domain/schema), P2 (auth).

Build (`apps/api/src/modules/hotel-rooms`):

- Tables: `room_types`, `rooms`, `rate_plans` (static/reference data
  populated here; occupied at runtime by H2).
- Room state machine exactly as `docs/prd/hotel/03-room-housekeeping.md`
  and master plan section 24: `available → reserved → occupied → dirty
  → cleaning → inspected → available`, with `maintenance`/
  `out_of_order` reachable from any state.
- `GET /hotel/rooms`, `PATCH /hotel/rooms/:id/status`.

Acceptance gate: a property can define room types and individual rooms,
and room status transitions correctly through every state in the
machine with no illegal transition possible (verified by attempting
every disallowed edge).

### H2 — Reservations + Booking Engine

Depends on: H1.

Full spec: `docs/prd/hotel/01-reservations-booking.md`.

Build (`apps/api/src/modules/hotel-reservations`):

- Tables: `hotel_reservations`, `folios` (created empty here, owned in
  detail by H4).
- Reservation state machine: `inquiry → reserved → confirmed →
  deposit_pending → deposit_paid → checked_in → in_house → checked_out`,
  `cancelled`/`no_show` reachable from any pre-check-in state.
- Availability search, rate plan resolution, group/corporate booking
  support, cancellation policy fee calculation.
- `GET /hotel/availability`, `POST /hotel/reservations`,
  `PATCH /hotel/reservations/:id`, `POST /hotel/reservations/:id/cancel`,
  `POST /hotel/reservations/group`.

Acceptance gate: exactly `docs/prd/hotel/01`'s acceptance criteria — a
room cannot be double-booked; a reservation can hold a room type before
room assignment; deposit payment updates folio balance; cancellation
policy calculates the correct fee.

### H3 — Front Desk

Depends on: H2.

Full spec: `docs/prd/hotel/02-front-desk.md`.

Build (`apps/api/src/modules/hotel-front-desk`):

- Check-in (room-readiness gate, ID capture, folio open), check-out
  (folio-settled gate, room → dirty), room move, late checkout/early
  check-in.
- `GET /hotel/arrivals`, `GET /hotel/departures`,
  `POST /hotel/reservations/:id/check-in`,
  `POST /hotel/reservations/:id/check-out`,
  `POST /hotel/stays/:id/room-move`.

Acceptance gate: exactly `docs/prd/hotel/02`'s acceptance criteria — a
folio cannot close with an unpaid balance unless corporate-approved;
room status changes automatically after checkout; a housekeeping task
is generated on every checkout.

### H4 — Folio, Hotel Payments & Night Audit

Depends on: H3, Restaurant OS P7 (payment adapters, reused directly).

Full spec: `docs/prd/hotel/04-folio-payments-night-audit.md`.

Build (`apps/api/src/modules/hotel-folio`):

- Tables: `folio_charges`.
- Folio-as-ledger discipline (append-only, closed folio never edited
  directly), room-rate override with threshold-gated approval,
  restaurant room-charge posting (`POST /hotel/room-charge`, consumed
  by Restaurant OS PRD 07's payment flow when a hotel outlet order is
  in play), night audit (post room charges, reconcile payments, roll
  business date).
- `POST /hotel/folios/:id/charges`, `POST /hotel/room-charge`,
  `POST /hotel/night-audit/run`.

Acceptance gate: exactly `docs/prd/hotel/04`'s acceptance criteria — a
closed folio's charge history is fully reconstructable from its
`folio_charges` entries with no direct-edit path; a restaurant room
charge posts correctly to the right folio; night audit posts exactly one
room-and-tax charge per in-house room per night and is idempotent if
re-run.

### H5 — Housekeeping Workflow

Depends on: H3.

Full spec: `docs/prd/hotel/03-room-housekeeping.md` (housekeeping-task
half — room state machine itself was H1).

Build (`apps/api/src/modules/hotel-housekeeping`):

- Tables: `housekeeping_tasks`.
- Housekeeping task state machine: `pending → assigned → in_progress →
  done → inspected`, `failed_inspection` looping back to `assigned`.
- Priority-ordered task assignment (near-term arrivals first), checklist
  completion, damage reporting (triggers H6).
- `POST /hotel/housekeeping-tasks`,
  `PATCH /hotel/housekeeping-tasks/:id`,
  `POST /hotel/housekeeping-tasks/:id/inspect`.

Acceptance gate: exactly `docs/prd/hotel/03`'s acceptance criteria —
checkout reliably creates exactly one housekeeping task per dirty room;
a room cannot become `available` without passing inspection unless
self-inspection is explicitly configured; priority ordering correctly
surfaces near-term-arrival rooms first.

### H6 — Maintenance

Depends on: H5.

Full spec: `docs/prd/hotel/05-maintenance.md`.

Build (`apps/api/src/modules/hotel-maintenance`):

- Tables: `maintenance_tickets`.
- Maintenance ticket state machine: `open → assigned → in_progress →
  waiting_parts → resolved → closed`.
- Priority-by-occupancy, SLA tracking, asset history.
- `POST /hotel/maintenance-tickets`,
  `PATCH /hotel/maintenance-tickets/:id`.

Acceptance gate: exactly `docs/prd/hotel/05`'s acceptance criteria —
every damage report from H5 produces exactly one linked ticket; SLA
countdown correctly reflects priority and flags breach.

### H7 — Guest CRM

Depends on: H2, H3, H4.

Full spec: `docs/prd/hotel/06-guest-crm.md`.

Build (`apps/api/src/modules/hotel-guests`):

- Extends Restaurant OS's shared `customers`/`customer_identities`
  tables (not a parallel identity system, per the PRD's own Data Model
  section) with hotel-specific preference/stay-history fields.
- Phone-first identity resolution and merge (reused directly from
  Restaurant OS PRD 13's discipline), VIP flagging, complaint tracking.
- `GET /hotel/guests`, `POST /hotel/guests/merge`,
  `POST /hotel/guests/:id/preferences`,
  `POST /hotel/guests/:id/complaints`.

Acceptance gate: exactly `docs/prd/hotel/06`'s acceptance criteria — a
returning guest identified by phone shows full history at lookup; VIP
arrivals are visible without manual cross-referencing; a merge preserves
every note with original authorship.

### H8 — Channel Management

Depends on: H2.

Full spec: `docs/prd/hotel/07-channel-management.md`.

Build (`apps/api/src/modules/hotel-channels`, reuses
`packages/integrations`' `ChannelAdapter` pattern):

- Tables: `channel_bookings`.
- Phase 1 (per master plan section 8): manual/limited integration —
  correct `channel_bookings` reference for manually-entered channel
  reservations.
- Phase 2: automated rate/availability push and reservation-import
  webhooks for Booking.com/Airbnb/Expedia/Agoda, zero-availability
  pushes prioritized over routine rate updates.
- `POST /hotel/integrations/channels/:provider/connect`,
  `POST /webhooks/hotel-channels/:provider`.

Acceptance gate: exactly `docs/prd/hotel/07`'s acceptance criteria — a
channel-sourced reservation appears correctly in the arrivals list with
correct commission terms; a sold-out room type pushes zero-availability
to every connected channel within the priority window.

### H9 — Reports, BI Dashboards & AI

Depends on: H1–H8.

Full spec: `docs/prd/hotel/08-reports-bi-ai.md`.

Build (`apps/api/src/modules/hotel-reports`, `services/ai-ml`):

- GM/reception/housekeeping/revenue dashboards exactly as master plan
  section 8 groups them.
- ML models: occupancy forecasting, dynamic pricing, guest churn,
  upsell recommendation, housekeeping staffing forecast, maintenance
  prediction.
- Daily GM briefing, reception shift briefing, and the other
  task-specific agents listed in the PRD.

Acceptance gate: exactly `docs/prd/hotel/08`'s acceptance criteria —
every report reconciles exactly against its source events; the daily GM
briefing runs on schedule and produces a factually correct summary for
7 consecutive days (spot-checked against the same day's reports) before
being shown to a real GM.

## 3. Notes On Confidence

Unlike `BUILD_WORKFLOW.md`'s P0–P19, this sequence has not been
exercised against a real implementation — it is derived directly from
each `docs/prd/hotel/*.md`'s own stated Dependencies and Acceptance
Criteria sections, which is a mechanical, low-risk derivation, but the
phase boundaries themselves (e.g. splitting H1 room-foundation from H5
housekeeping-workflow) are a judgment call made here, not something
master plan sections 8/24 dictate directly. Revisit the phase split if
implementation reveals a cleaner boundary.
