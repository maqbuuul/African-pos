# Hotel PRD 06: Guest CRM

## Scope

Owns guest identity, preferences, stay history, and VIP/loyalty status
across a hotel property (or group). Corresponds to master plan section 8
(Guest CRM Features). Mirrors Restaurant OS PRD 13's CRM discipline
(phone-first identity resolution, append-only loyalty ledger) applied to
the hotel guest relationship, which is longer-cycle (stays, not single
visits) but structurally the same problem.

**Status note:** see Hotel PRD 01 — Year 2+ priority. Build phase:
**H7**, see `BUILD_WORKFLOW_HOTEL.md`.

## Dependencies

Hotel PRD 01 (reservation creates/references a guest profile), Hotel PRD
02 (ID capture attaches to the profile), Hotel PRD 04 (spend history
derives from folio data).

## User Stories

- As a **receptionist**, I need to see a returning guest's preferences
  (room type, floor, pillow type, dietary notes) the moment I look them
  up, not rediscover them every stay.
- As a **general manager**, I need VIP guests flagged before arrival, so
  the team can prepare, not react.
- As a **guest**, I need my complaint history remembered — being asked
  to re-explain a problem I already reported is a trust failure.
- As a **revenue/marketing owner**, I need upsell history and stay
  purpose data to inform which package or add-on to offer next time.

## Workflows

### Guest identity resolution

```text
Reservation created (Hotel PRD 01), ID captured (Hotel PRD 02), or a
  returning guest recognized by phone/email
  -> Same phone-first resolution as Restaurant OS PRD 13: match by
     phone, merge preserving all notes with author/timestamp on manual
     merge
  -> Guest profile accumulates stay history, spend history (from folio
     data, Hotel PRD 04), preferences, and complaint/feedback history
     across every stay, not reset per visit
```

### VIP flagging and pre-arrival prep

```text
Guest profile marked VIP (manually, or automatically past a
  configurable stay-count/spend threshold)
  -> Upcoming VIP arrivals surface on the reception dashboard (master
     plan section 8's Reception dashboard: "VIP guests") and the GM's
     daily briefing (Hotel PRD 08)
  -> Pre-arrival message (personalized, referencing known preferences)
     sent via Restaurant OS PRD 09's notification pipeline
```

### Preference and complaint tracking

```text
Any staff member records a guest preference or logs a complaint during
  a stay
  -> Attached to the guest profile, visible to front desk on every
     future lookup -- not siloed to the stay/reservation it was recorded
     during
  -> Complaint history feeds Hotel PRD 08's guest satisfaction reporting
     and the guest-churn ML model
```

### Upsell history and recommendation

```text
Every upsell offered and accepted/declined is recorded against the
  guest profile
  -> Feeds Hotel PRD 08's upsell-recommendation model (predict which
     package/add-on this guest is likely to accept based on stay
     purpose, booking type, and past spend)
```

## Screens & UI Behavior

- **Guest profile** (receptionist, GM, front office manager): identity,
  preferences, stay history, spend history, VIP status, complaint
  history, upsell history — one view, not scattered across separate
  screens per stay.
- **Front desk guest lookup**: fast phone/name search, surfaces
  preferences and any open complaint prominently — mirrors Restaurant OS
  PRD 13's allergy-flag-visibility principle, applied to guest
  preferences/complaints here.

## Permissions

| Action | receptionist | front_office_manager | general_manager |
| --- | --- | --- | --- |
| Look up guest, view profile | Yes | Yes | Yes |
| Add preference/complaint notes | Yes | Yes | Yes |
| Flag/unflag VIP status | No | Yes | Yes |
| Merge duplicate guest profiles | No | Yes | Yes |

## Business Rules

- Guest identity resolution and merge rules mirror Restaurant OS PRD
  13's exactly (phone-first, preserve all notes with author/timestamp on
  merge) — this is deliberately not reinvented per vertical; the
  underlying CRM discipline is shared platform behavior (master plan
  section 3's "shared platform contains roughly 80% of the codebase"),
  even though the guest-specific preference/stay-history fields are
  hotel-specific.
- A guest's complaint history is never editable after the fact except
  by adding a resolution note — the original complaint record persists
  exactly as logged.
- VIP status changes (manual or threshold-triggered) are visible on the
  guest's own profile as a dated event, not a silent flag flip — staff
  should be able to see when and why someone became VIP.

## Edge Cases & Failure States

- Same guest books under slightly different name spellings across
  stays: phone-based matching (primary key) catches this even when
  name-based matching wouldn't — consistent with why Restaurant OS PRD
  13 chose phone-first resolution.
- A complaint is logged against a guest who then disputes it was ever
  raised: the record includes who logged it and when, which is itself
  the resolution mechanism — never delete a disputed complaint, add a
  resolution/correction note instead.

## Data Model

Guest CRM extends the same customer-identity pattern as `DATA_MODEL.md`
CRM group (`customers`, `customer_identities`, `customer_tags`,
`loyalty_accounts`, `loyalty_events`) — Hotel OS's guest profile is not
a separate identity system, it's the same `customers` entity with
hotel-specific preference/stay-history fields. A `guest_preferences` and
`guest_complaint_history` table addition (hotel-specific extensions) is
not yet itemized in `DATA_MODEL.md` Later Hotel OS — flagged as a schema
gap for implementation.

## Events Emitted

- `GuestProfileCreated` / `GuestProfilesMerged` — shared pattern with
  Restaurant OS PRD 13's `CustomerIdentified`/`CustomerProfilesMerged`.
- `GuestFlaggedVip` — consumed by: Hotel PRD 02 (arrivals list VIP
  flag), Hotel PRD 08 (GM briefing).
- `ComplaintLogged` — consumed by: Hotel PRD 08 (guest satisfaction
  reporting), notification (manager alert for serious complaints,
  mirroring Restaurant OS PRD 13's negative-review alert pattern).

## API Surface

- `GET /hotel/guests`, `GET /hotel/guests/:id`,
  `PATCH /hotel/guests/:id`, `POST /hotel/guests/merge`
- `POST /hotel/guests/:id/preferences`, `POST /hotel/guests/:id/complaints`

## Offline Behavior

Not assumed offline-first — see Hotel PRD 01's same note.

## Acceptance Criteria

- A returning guest identified by phone shows their full preference and
  stay history at front desk lookup, matching what the server actually
  holds.
- VIP guests arriving today are visible on the reception dashboard and
  the GM briefing without manual cross-referencing.
- A merge preserves every note/complaint/preference from both merged
  profiles with original authorship intact.

## Non-Goals

- Loyalty tier/points program mechanics in detail — reuses Restaurant OS
  PRD 13's loyalty ledger discipline directly rather than redefining it
  here; hotel-specific tier benefits (room upgrades, late checkout) are
  a configuration on top of the shared loyalty system, not a separate
  one.
- Guest churn prediction model logic — Hotel PRD 08.
