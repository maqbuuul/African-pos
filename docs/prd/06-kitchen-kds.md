# PRD 06: Kitchen Display System (KDS)

## Scope

Owns station routing, ticket display, timing, and the bump/recall
workflow that turns a fired order item into food. Corresponds to master
plan section 7 Kitchen Features and `DATA_MODEL.md` (`kds_stations`,
`kitchen_tickets`, `kitchen_ticket_items`). Does not own the order/item
data itself (PRD 05) — this module consumes `OrderItemSent` events and
produces station-routed tickets from them.

## Dependencies

PRD 03 (Menu & Catalog) — category→station default routing. PRD 05
(Order Engine) — this module exists entirely downstream of
`OrderItemSent`.

## User Stories

- As a **chef**, I need to see only the items routed to my station
  (grill, cold, pastry, bar), in the order they were fired, without
  scrolling past items for other stations.
- As a **chef**, I need to bump an item or a whole ticket when it's done,
  with one tap, and recall it if I bumped by mistake.
- As a **chef**, I need an allergy alert to be impossible to miss — not a
  small icon I could scan past under rush pressure.
- As an **expo**, I need to see the combined ticket for a table across
  every station, so I know when a full table's food is actually ready to
  go out together.
- As a **branch manager**, I need cook-time data per item per station, so
  I can see where the kitchen is actually slow, not just guess.

## Workflows

### Ticket generation and routing

```text
Order item fired (PRD 05: OrderItemSent event)
  -> System resolves station: item's product-level station override, or
     its category's default station (PRD 03)
  -> If item spans logically to multiple prep steps at different
     stations (rare, e.g. a dish needing both grill and cold prep):
     multiple kitchen_ticket_items generated, one per station, linked to
     the same parent ticket/order
  -> Ticket appears on the relevant station's KDS screen immediately
     (target: sub-second from fire to display)
  -> Ticket timer starts
```

### Bump / recall

```text
Chef taps "bump" on an item or whole ticket
  -> kitchen_ticket_item.status: in_progress -> ready
  -> order_item.status synced -> ready (PRD 05)
  -> Expo screen shows the item as ready; when all items for a table's
     ticket are ready, expo/table view shows "full ticket ready"
  -> Chef can "recall" within a short grace window (mis-tap correction)
     -> reverts to in_progress, timer resumes (not reset -- the elapsed
        time before the mistaken bump still counts)
```

### Cross-station coordination alert

```text
System continuously compares each station's average ticket age against
its own historical baseline (per master plan section 7)
  -> If one station is running significantly behind while another is
     idle: rebalance prompt shown to expo/manager, not a silent delay
     -> e.g. "Grill running 6 min behind, Cold idle -- reassign?"
  -> This is a suggestion surfaced to a human, not an automatic
     re-routing of tickets
```

### Order consolidation / batching

```text
Multiple concurrent tickets contain the same item at the same station
  -> Station view groups them into one visual batch (e.g. "4x Beef
     Burger" shown once with a count) so the cook fires one pass, not
     four separate look-ups
  -> Bumping the batch bumps all constituent order_items individually
     underneath -- batching is a display/workflow optimization, not a
     data merge
```

### Allergy alert

```text
Order item has an allergen flag (from product/recipe data, PRD 03/12,
or a manual note added at order time)
  -> Ticket renders the allergen with high-contrast, non-dismissible-by-
     accident visual treatment (not a small icon) -- per master plan
     section 7's explicit "not a small icon" requirement
  -> Bumping an allergy-flagged item may require an explicit
     confirmation tap, configurable per location
```

## Screens & UI Behavior

- **Station KDS screen**: only this station's tickets, oldest first,
  color-shifting by age (green → amber → red as a ticket approaches/
  exceeds its expected cook time). Rush/VIP tickets visually
  differentiated (master plan section 7) — border/badge, not just a
  label buried in text.
- **Expo screen**: combined per-table view across all stations, showing
  which stations have bumped and which are still in progress for that
  table's ticket — the expo's whole job is knowing when a table is fully
  ready, not per-item state.
- **Recipe/plating photo**: shown automatically on the ticket for items
  a station has prepared fewer than a configurable number of times
  recently (master plan section 7) — infrequent items get the visual aid,
  common ones don't clutter the screen with it.
- **Kitchen printer fallback**: if a station has no functioning KDS
  screen (or during a KDS outage), tickets print instead — same
  station-routing logic, different output device, so the routing rules
  aren't duplicated per output type.

## Permissions

| Action | chef/kitchen staff | expo | branch_manager |
| --- | --- | --- | --- |
| Bump item/ticket | Yes (own station) | Yes (any) | Yes |
| Recall (within grace window) | Yes (own station) | Yes | Yes |
| View cook-time analytics | No | No | Yes |
| Configure station routing | No | No | Yes |

## Business Rules

- Ticket timing starts at fire (`OrderItemSent`), not at kitchen view/ack
  — cook-time analytics (and the AI-adjusted estimates in PRD 17) need
  the true elapsed time from the customer's perspective, not from
  whenever a screen happened to render it.
- A voided item that's already `in_progress` or `ready` at a station
  requires the kitchen's acknowledgment before the void completes (PRD
  05's rule) — the KDS surfaces this as an explicit "void requested,
  acknowledge?" prompt, not a silent removal from the screen.
- Recall has a grace window (configurable, default short — minutes, not
  hours) specifically to correct mis-taps, not to reverse a genuinely
  completed and served item — recalling a `served` item isn't a KDS
  action, it flows through PRD 05's void/comp path instead.
- Station routing defaults come from the category (PRD 03) but a
  location can override per-product — this override is data on the
  product, not a KDS-side rule, so routing stays consistent regardless
  of which screen/device displays it.

## Edge Cases & Failure States

- KDS device loses connectivity mid-service: tickets already displayed
  remain visible and bump-able locally (this module inherits PRD 11's
  offline-sync guarantees); new tickets can't arrive until reconnected,
  so the printer fallback matters most exactly during this failure mode.
- Item bumped by the wrong station (fat-finger on a shared/multi-station
  ticket): recall window covers this; beyond the window, a manager
  override re-opens the ticket item with an audit entry.
- Two stations both need the same item (rare split-prep dish) and one
  bumps while the other hasn't started: expo view must show partial
  completion accurately ("grill ready, cold pending"), not a misleading
  "ready" the moment the first station bumps.

## Data Model

`DATA_MODEL.md` Payments And Cash section boundary — actually Restaurant
MVP: `kds_stations`, `kitchen_tickets`, `kitchen_ticket_items`.

## Events Emitted

- `KitchenTicketCreated` / `KitchenTicketItemBumped` /
  `KitchenTicketItemRecalled` — consumed by: PRD 05 (order_item status
  sync), PRD 04 (table state — food_ready transition), PRD 14 (kitchen
  performance reporting), PRD 17 (cook-time model training data).
- `CrossStationImbalanceDetected` — consumed by: manager/expo
  notification.

## API Surface

- `GET /kds/stations/:station_id/tickets` (real-time, primarily via
  WebSocket subscription per ADR 0001, not polling)
- `POST /kds/tickets/:ticket_item_id/bump`,
  `POST /kds/tickets/:ticket_item_id/recall`
- `GET /kds/cook-time-analytics`

## Offline Behavior

Tickets already synced to a station device remain fully usable offline
(view, bump, recall) — this is local-first by nature since kitchen
operations cannot pause for connectivity. New tickets require the
originating order to have synced to the server and back down to this
device; in a single-location, single-network setup this is normally
near-instant over LAN even if the location's internet is down (local
network delivery should not depend on internet connectivity — a design
constraint for the real-time layer, not just the offline-sync layer).

## Acceptance Criteria

- An order item fired from POS appears on the correct station's KDS
  within one second under normal network conditions.
- Bumping an item updates the corresponding order_item status and the
  expo's combined-ticket view within one sync cycle.
- An allergy-flagged item is visually distinguishable from a
  non-flagged item in a blind screenshot comparison (this is a genuine
  design-review acceptance check, not just a functional one).

## Non-Goals

- Pour-cost/bar-specific tracking (master plan section 7 lists this
  under Kitchen Features but it's bar-station-specific inventory
  tracking — belongs with PRD 12 Inventory, this PRD only owns the bar
  station's ticket display).
- AI-adjusted cook-time estimation logic itself (PRD 17 consumes this
  module's timing data; this module only records and displays it).
