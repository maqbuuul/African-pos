# Hotel PRD 07: Channel Management

## Scope

Owns OTA (online travel agency) integrations — inventory/rate sync and
reservation import from Booking.com, Airbnb, Expedia, Agoda, Google
Hotel Ads, and the property's own direct booking engine. Corresponds to
master plan section 8 (Channel Management Features). Uses the same
`ChannelAdapter` pattern Restaurant OS PRD 15/16 use for commerce/
delivery integrations — this PRD owns the hotel-specific workflow, not a
new adapter mechanism.

**Status note:** see Hotel PRD 01 — Year 2+ priority. Build phase:
**H8**, see `BUILD_WORKFLOW_HOTEL.md`. Master plan section 8 explicitly
scopes this as "Phase one can start with manual or limited
integrations" — this PRD's Phase 1 scope reflects that.

## Dependencies

Hotel PRD 01 (channel-sourced reservations become real reservations, not
a parallel booking system).

## User Stories

- As a **revenue manager**, I need my room inventory and rates to stay
  in sync across every connected OTA without manually updating each one.
- As a **receptionist**, I need a Booking.com reservation to appear in
  my arrivals list exactly like a direct booking, with no special
  handling required.
- As a **GM**, I need to see which channel actually drives profitable
  bookings (after commission), not just gross booking volume per
  channel.

## Workflows

### Phase 1: manual/limited integration

```text
Per master plan section 8: early phase does not require full real-time
  channel sync. Revenue manager manually updates rates/availability on
  each OTA's own extranet, and reservations are manually entered into
  Hotel PRD 01 when they arrive via a channel -- this is explicitly
  acceptable at low channel-booking volume, and this PRD's Phase 1
  scope is simply making sure a manually-entered channel reservation is
  indistinguishable in the system from a direct one (correct
  `channel_bookings` reference, correct rate plan) once entered.
```

### Phase 2+: automated channel sync

```text
Rate/inventory push: Hotel PRD 01 rate/availability change
  -> pushCatalog()-equivalent adapter call syncs updated rates and
     available-room-count to each connected OTA within the configured
     sync interval (same ChannelAdapter shape and channel_sync_logs
     discipline as Restaurant OS PRD 15)

Reservation import: OTA webhook received (guest books via Booking.com/
  Airbnb/Expedia/Agoda)
  -> Signature-verified before any domain command runs (same rule as
     Restaurant OS Module 16)
  -> Adapter calls Hotel PRD 01's standard reservation-creation command
     -- never writes directly to hotel_reservations -- with
     channel = booking_com / airbnb / expedia / agoda, referencing a
     channel_bookings row for the OTA's own reservation ID and
     commission terms
  -> Reservation appears in the arrivals list (Hotel PRD 02) exactly
     like a direct booking
```

### Overbooking prevention across channels

```text
Rate/availability push must be near-real-time once Phase 2 is live --
  the single biggest failure mode of channel management is two OTAs
  both selling the last room before either sync completes
  -> A booked-out room type immediately pushes zero-availability to
     every connected channel, not on the next scheduled sync interval
     -- availability-goes-to-zero pushes are treated as higher priority
     than routine rate updates
```

## Screens & UI Behavior

- **Channel settings** (revenue manager): connect/disconnect each OTA,
  configure sync interval, view commission terms per channel.
- **Channel performance dashboard**: booking volume, cancellation rate,
  and — combined with Hotel PRD 04's folio/commission data — actual
  net revenue per channel after commission, matching master plan section
  8's "channel performance" reporting requirement.
- **Integration health** (admin-web): shared pattern with Restaurant OS
  PRD 15/16's error dashboard — sync failures, last-successful-sync per
  channel.

## Permissions

| Action | revenue_manager | general_manager |
| --- | --- | --- |
| Connect/disconnect a channel | Yes | Yes |
| Configure sync interval/rates pushed | Yes | Yes |
| View channel performance/commission data | Yes | Yes |

## Business Rules

- Reservations imported from any channel go through the exact same
  reservation-creation command as a direct booking (Hotel PRD 01) —
  never a parallel booking path, per the same module-boundary rule
  Restaurant OS applies to commerce/delivery integrations.
- Zero-availability pushes are prioritized over routine rate-update
  syncs — overbooking prevention is the single highest-stakes failure
  mode this PRD exists to prevent, and the sync priority reflects that.
- Every channel-sourced reservation retains its channel and commission
  terms for the life of the booking — commission cost must be
  traceable per reservation for accurate channel-performance reporting
  (Hotel PRD 08), not estimated after the fact from a blended average
  rate.

## Edge Cases & Failure States

- Two OTAs' webhooks arrive within seconds of each other for what turns
  out to be the same last room (a genuine race despite the
  zero-availability-priority push): the second reservation is flagged
  as an overbooking exception for the front office manager to resolve
  (walk the guest to a partner property, upgrade, or a channel-specific
  resolution process) — the system cannot silently prevent every
  possible race condition across external providers with their own sync
  latency, but must surface the conflict immediately rather than let it
  surface at check-in.
- A channel's webhook delivers a reservation for a room type that's been
  discontinued/renamed on the property side: reservation is accepted
  with the best-available mapping and flagged for manual review, not
  silently dropped — a booked and paid (via the OTA) guest cannot simply
  vanish from the system.
- OTA connection credentials expire/are revoked externally: sync
  failures surface immediately in the integration health dashboard, and
  rate/availability staleness is bounded and visible (last-successful-
  sync timestamp), not silently stale indefinitely.

## Data Model

`DATA_MODEL.md` Later Hotel OS: `channel_bookings`. Shares
`integration_connections` and `channel_sync_logs` with Restaurant OS
PRD 15/16's Integrations group — same tables, same adapter pattern,
different channel types.

## Events Emitted

- `ChannelReservationReceived` — consumed by: Hotel PRD 01 (reservation
  creation), Hotel PRD 08 (channel performance reporting).
- `ChannelSyncCompleted` / `ChannelSyncFailed` — consumed by: admin
  health dashboard.
- `OverbookingDetected` — consumed by: notification (immediate front
  office manager alert).

## API Surface

- `POST /hotel/integrations/channels/:provider/connect`
- `POST /webhooks/hotel-channels/:provider` (inbound reservations)
- `GET /hotel/integrations/channels/:provider/sync-logs`

## Offline Behavior

Not offline-capable by nature — requires connectivity to both the
platform API and each OTA, identical constraint to Restaurant OS PRD
15/16.

## Acceptance Criteria

- A reservation placed on a connected OTA appears in the arrivals list
  with correct rate and commission terms, indistinguishable in handling
  from a direct booking.
- A room type selling out pushes zero-availability to every connected
  channel within the priority sync window, verified by a test booking
  that exhausts inventory.
- Channel performance dashboard correctly nets out commission cost per
  channel, not just gross booking volume.

## Non-Goals

- Building a direct booking engine's full consumer-facing UX — that's
  the property's own website/booking widget, a `customer-web`-style
  surface, distinct from this PRD's OTA-sync concern.
- Rate-shopping/competitor-rate-monitoring tools — later enhancement, not
  Phase 1/2 scope here.
