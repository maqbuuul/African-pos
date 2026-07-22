# Hotel PRD 04: Folio, Hotel Payments & Night Audit

## Scope

Owns the guest folio (ledger), hotel-specific payment methods, and the
end-of-day night audit process. Corresponds to master plan section 8
(Hotel Payments) and section 24 (Folio Rules, Hotel Night Audit). Also
owns the PMS room-charge integration point for a property running
Restaurant OS on its F&B outlets (master plan section 8's "PMS
Integration For Restaurant Room-Charge").

**Status note:** see Hotel PRD 01 — Year 2+ priority. Build phase:
**H4**, see `BUILD_WORKFLOW_HOTEL.md`.

## Dependencies

Hotel PRD 01 (folio opens at reservation), Hotel PRD 02 (check-in opens
it for use, check-out requires it settled). Restaurant OS PRD 07
(Payments) — hotel payments reuse the same payment-method adapters
(cash/card/M-Pesa/Airtel Money), not a separate payment stack.

## User Stories

- As a **receptionist**, I need to see every charge on a guest's folio
  in one place — room, tax, restaurant, spa, laundry, minibar — before
  checkout.
- As a **restaurant server** at a hotel's F&B outlet, I need to post a
  bill directly to a guest's room instead of taking payment at the
  table, when the guest is in-house and credit is allowed.
- As an **accountant**, I need the night audit to reconcile every
  open folio, post room charges, and roll the business date reliably,
  every single night, without manual reconciliation.
- As a **front office manager**, I need a room-rate override to require
  permission above a threshold — this is real revenue leakage risk if
  left ungated.
- As a **corporate traveler**, I need my room and tax billed to my
  company while my personal extras stay on my own card — one stay,
  two folios, not a manual after-the-fact reconciliation.

## Workflows

### Folio as a ledger

```text
Folio opens at check-in (Hotel PRD 02), status = open
Every charge (room, tax, restaurant, spa, laundry, minibar, damage) and
  every credit (discount, deposit, refund) posts as its own folio_charges
  entry -- append-only, exactly like Restaurant OS's bills/payments
  ledger discipline (ENGINEERING_CHARTER.md)
Closed folio cannot be edited directly -- a correction after close
  creates a new entry referencing the original, never a mutation
```

### Split folio

```text
Guest (or a group booking, Hotel PRD 01) needs charges divided across
  multiple payable folios -- e.g. a corporate traveler wants room and
  tax on the company account but personal minibar/restaurant charges on
  their own card, or a group booking wants each room's charges settled
  separately
  -> Front desk staff splits the stay's charges into N folios, assigning
     specific folio_charges entries to each -- same "assign, don't
     duplicate" discipline as Restaurant OS PRD 05's bill splitting:
     charges are referenced by the split folio, never copied
  -> Each resulting folio can be settled independently (different
     payment method, different timing) and each closes on its own
     unpaid-balance gate (Hotel PRD 02's rule), not blocked by the
     others still being open
  -> A charge posted after the split (e.g. a same-night room-service
     order) must be explicitly assigned to one of the existing folios or
     start a new one -- never defaulted to "folio 1," identical rule to
     Restaurant OS PRD 05's post-split-item-assignment requirement
```

### Room rate override

```text
Front desk staff attempts to change a posted room rate
  -> Permission check: requires authority above a configurable threshold
     (master plan section 24: "Room rate override requires permission
     above threshold")
  -> Approved override posts as its own folio_charges adjustment entry
     with the approver's identity recorded (same approval-request
     pattern as Restaurant OS PRD 01)
```

### Restaurant room-charge posting

```text
Guest at a hotel's F&B outlet requests to charge their meal to their room
  -> Restaurant OS PRD 07's payment flow, at the "select payment method"
     step, offers "charge to room" when the order's context indicates a
     hotel property outlet
  -> System checks: guest is in-house (Hotel PRD 02's checked_in/
     in_house state) AND credit is allowed for this guest/folio
  -> POST /hotel/room-charge posts the restaurant bill directly to the
     guest's folio -- no payment taken at the table
  -> If this property's Hotel OS is this platform's own: charge posts
     to a local folios row directly
  -> If this property runs a third-party PMS (Opera, Protel, Mews)
     instead: the same room-charge posting goes through a PMS adapter
     in packages/integrations (same adapter pattern as Restaurant OS
     Module 16), not a local folio table -- the restaurant side of the
     property never needs to know which case applies, the adapter
     abstracts it
  -> Charge settles at checkout through the standard hotel night-audit
     process (below), exactly like any other folio charge
```

### Night audit

Exactly master plan section 24:

```text
Review arrivals not checked in
Review departures not checked out
Review open folios
Post room charges (the night's room-and-tax charge for every in-house
  stay, posted as a folio_charges entry per room per night)
Reconcile payments
Generate daily reports (arrivals, departures, in-house guests,
  no-shows, occupancy, ADR, RevPAR, payments, open balances)
Roll business date
```

## Screens & UI Behavior

- **Folio view** (receptionist, front office manager): itemized charge
  list, running balance, payment history, dispute flag if applicable
  (`folios.status = disputed`, Hotel PRD 02).
- **Night audit console** (accountant, night auditor): the checklist
  above as a guided, sequential process — not a single "run audit"
  button that hides what actually happened; each step's output (e.g.
  which folios have open balances) is reviewable before proceeding.
- **Corporate account statement**: aging view of direct-billed balances
  per corporate account (feeds Hotel PRD 08's "corporate account aging"
  report).

## Permissions

| Action | receptionist | front_office_manager | accountant |
| --- | --- | --- | --- |
| Post a standard folio charge | Yes | Yes | Yes |
| Room rate override | Threshold-limited | Yes | No |
| Close a folio | Yes (if balance zero) | Yes | Yes |
| Run night audit | No | No | Yes (or dedicated night auditor role) |
| Approve corporate direct-bill | No | Yes | Yes |

## Business Rules

- **Folio is a ledger, full stop** (master plan section 24) — every rule
  Restaurant OS applies to `payments`/`refunds` applies here identically:
  append-only, no direct edits to a closed folio, corrections are new
  entries.
- Restaurant charges can post to a room **only if** the guest is
  in-house and credit is allowed — both conditions checked at the
  moment of posting, not assumed from an earlier check-in state that
  might have changed (e.g. guest checked out since the meal started).
- Room rate override always requires permission above a
  location-configured threshold — no property-wide "front desk can
  always override" setting; the threshold exists specifically to bound
  this.
- Night audit's business-date roll is the single authoritative point
  where "today" advances for every hotel-side report — a report run
  before the roll and one run after must never disagree about which
  business date a room-night belongs to.
- A split folio assigns existing `folio_charges` entries to a new folio
  reference, never duplicates them — the same "reference, don't copy"
  rule Restaurant OS PRD 05 applies to split bills, applied here so a
  charge can never appear on two folios' totals at once.

## Edge Cases & Failure States

- Restaurant room-charge attempted for a guest who checked out an hour
  ago (stale UI state on the restaurant side): rejected at the
  `POST /hotel/room-charge` check, not silently accepted — the server
  is the source of truth for in-house status, not whatever the
  restaurant POS last cached.
- Third-party PMS adapter is unreachable when a room-charge is
  attempted: the restaurant order does not silently fail — it falls
  back to a normal payment method prompt (cash/card/mobile money) with
  a clear message, rather than leaving the guest's bill in limbo.
- Night audit run twice for the same business date (operator error):
  idempotent — a second run detects the date has already rolled and
  reports "already audited," never double-posts room charges.
- Corporate account balance exceeds its credit limit mid-stay: new
  direct-bill charges are blocked pending a manager override (approval-
  request pattern), consistent with Restaurant OS PRD 13's customer
  credit-limit rule.

## Data Model

`DATA_MODEL.md` Later Hotel OS: `folios`, `folio_charges`. Splitting a
folio needs a linking structure analogous to Restaurant OS's
`bills`/`bill_items` (a `folio_id` per split folio, each referencing a
subset of the stay's `folio_charges`) — not yet itemized in
`DATA_MODEL.md`, flagged alongside the corporate-account/aging gap
below. Corporate account/aging needs an explicit `corporate_accounts`
table addition (not yet itemized in `DATA_MODEL.md`) — flagged as a
schema gap for whoever implements this PRD, following the same "flag,
don't silently assume" discipline as the Restaurant OS PRDs' own
gap-flagging.

## Events Emitted

- `FolioOpened` / `FolioChargePosted` / `FolioClosed` — consumed by:
  Hotel PRD 02 (checkout gate), Hotel PRD 08 (revenue reporting).
- `FolioSplit` — consumed by: Hotel PRD 02 (each resulting folio's own
  checkout-settlement gate), Hotel PRD 08.
- `RoomChargePosted` — consumed by: Restaurant OS PRD 07 (payment
  completion for the originating order), Hotel PRD 08.
- `NightAuditCompleted` — consumed by: Hotel PRD 08 (daily report
  generation), notification (audit-complete confirmation to accountant).

## API Surface

- `GET /hotel/folios/:id`, `POST /hotel/folios/:id/charges`
- `POST /hotel/folios/:id/split`
- `POST /hotel/room-charge` (called from the Restaurant OS payment flow)
- `POST /hotel/night-audit/run`
- `GET /hotel/corporate-accounts/:id/statement`

## Offline Behavior

Not assumed offline-first — see Hotel PRD 01's same note. Night audit
in particular is inherently an online, connected batch process.

## Acceptance Criteria

- A closed folio's charge history is byte-for-byte reconstructable from
  its `folio_charges` entries, with no direct-edit path ever available.
- A restaurant room-charge correctly posts to the right guest's folio
  and is visible on the folio view within one request cycle.
- Night audit posts exactly one room-and-tax charge per in-house room
  per night, verified against a multi-night stay test case, and is
  idempotent if re-run.

## Non-Goals

- Full third-party PMS adapter implementation detail (Opera/Protel/Mews
  specifics) — tracked as an integration-adapter build task under
  Restaurant OS Module 16's pattern, not detailed here.
- Corporate account credit-scoring/approval workflow beyond the
  threshold-gated override described above.
