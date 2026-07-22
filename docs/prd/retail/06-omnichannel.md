# Retail PRD 06: Omnichannel

## Scope

Owns unified inventory, unified customer profile, and unified reporting
across every retail selling channel — store, website, WhatsApp/
Instagram/Facebook commerce, and marketplace orders — plus buy-online-
pickup-in-store (BOPIS), ship-from-store, and return-anywhere. Corresponds
to master plan section 9 (Retail Omnichannel Features). Uses the same
`ChannelAdapter` pattern as Restaurant OS PRD 15/16 for marketplace/
social-commerce integrations.

**Status note:** see Retail PRD 01 — Year 3+ priority. Build phase:
**R6**, see `BUILD_WORKFLOW_RETAIL.md`.

## Dependencies

Retail PRD 01 (every channel's order becomes a real sale), Retail PRD 02
(one inventory pool, not per-channel silos), Retail PRD 07 (unified
customer profile).

## User Stories

- As a **customer**, I need to buy online and pick up in-store, or buy
  in-store and have it shipped, without the retailer treating these as
  separate systems.
- As a **customer**, I need to return an item at any branch, not just
  the one I bought it from.
- As an **owner**, I need one inventory number, not "website says 5 in
  stock, POS says 3" — the classic omnichannel failure this PRD exists
  to prevent.
- As a **customer** who messages a store on WhatsApp or Instagram, I
  need to actually complete a purchase in that conversation, not be
  redirected to a website.

## Workflows

### Unified inventory

```text
Single stock_levels figure per variant per location (Retail PRD 02),
  never a channel-specific inventory pool synced periodically
  -> Every channel (store POS, website, WhatsApp commerce, marketplace)
     reads and reserves against the same live figure
  -> A sale on any channel immediately deducts from the same pool a
     sale on any other channel would deduct from -- this is the
     specific design choice that prevents the "website says 5, POS says
     3" failure mode, and it means channel integrations call the same
     Retail PRD 01/02 module commands every other channel uses, never
     a separate channel-specific stock table
```

### Inventory reservation for online orders

```text
Website/WhatsApp/marketplace order placed
  -> Stock reserved (soft-hold, not yet deducted) for a short window
     while payment completes -- prevents overselling during the
     payment-confirmation gap without permanently locking stock for an
     abandoned cart
  -> Payment confirmed -> reservation converts to a real stock deduction
  -> Payment abandoned/times out -> reservation releases automatically
```

### BOPIS (buy online, pickup in store)

```text
Customer orders online, selects a pickup location
  -> Order routes to that location's fulfillment queue (conceptually
     similar to Restaurant OS PRD 10's QR-order-to-kitchen routing,
     applied to retail pick-and-pack instead of cooking)
  -> Store staff picks the item, marks ready
  -> Customer notified (Restaurant OS PRD 09's pipeline, reused)
  -> Pickup confirmed at the counter, completing the sale
```

### Ship-from-store

```text
Online order fulfilled from store inventory instead of a central
  warehouse (closer to the customer, faster delivery)
  -> Order routes to the selected store's fulfillment queue instead of
     warehouse fulfillment
  -> Store staff picks, packs, and hands off to a delivery
     provider/courier -- delivery-provider integration follows the same
     ChannelAdapter pattern as Restaurant OS PRD 16's delivery
     integrations, conceptually reused here for retail shipping
```

### Return anywhere

```text
Customer returns an item at a different branch than where they bought it
  -> Retail PRD 04's receipt lookup is tenant-wide, not location-locked
     (already specified there) -- this PRD's job is ensuring the
     receiving branch's inventory correctly absorbs the returned stock
     (a transfer-equivalent movement crediting the receiving location,
     not the original purchase location)
```

### Social/marketplace commerce

```text
WhatsApp/Instagram/Facebook order or marketplace order received
  -> Same webhook-verified, adapter-mediated pattern as Restaurant OS
     PRD 15 (commerce integrations): signature-verified webhook -> calls
     Retail PRD 01's standard sale-creation command -> never a parallel
     write path
  -> channel field on the sale distinguishes source for reporting
     (Retail PRD 07), same discipline as Restaurant OS's order channel
     tracking
```

### Unified customer profile

```text
A customer who buys in-store, then messages on WhatsApp, then orders on
  the website is recognized as the same person -- reuses Retail PRD 07's
  (and, underneath it, Restaurant OS PRD 13's) phone-first identity
  resolution directly, not a channel-specific customer record per
  channel
```

## Screens & UI Behavior

- **Unified order queue** (store staff): BOPIS and ship-from-store
  orders alongside in-store sales, channel-badged — same "one
  operational view across channels" principle as Restaurant OS PRD 16's
  consolidated delivery queue.
- **Channel performance dashboard** (Retail PRD 07): sales by channel,
  channel-specific fulfillment SLAs (BOPIS ready-time, ship-from-store
  pack time).
- **Integration health** (admin-web): shared pattern with Restaurant OS
  PRD 15/16 and Hotel PRD 07's error dashboard.

## Permissions

| Action | store_staff | store_manager | regional_manager |
| --- | --- | --- | --- |
| Fulfill a BOPIS/ship-from-store order | Yes | Yes | Yes |
| Connect/disconnect a social/marketplace channel | No | No | Yes |
| View unified inventory across locations | Yes (own location) | Yes | Yes (all locations) |

## Business Rules

- **One inventory pool, no exceptions** — this is the entire point of
  this PRD's existence, restated as the hardest rule: no channel ever
  reads or writes a channel-specific copy of stock data.
- Stock reservation for online orders is time-bounded and automatically
  released on abandonment — an abandoned cart must never permanently
  lock stock away from other channels.
- Every channel-sourced sale calls the same Retail PRD 01 sale-creation
  command as an in-store sale — the module-boundary rule Restaurant OS
  PRD 15/16 established for external integrations applies identically
  here.
- Customer identity is resolved once, platform-wide, never
  per-channel — a customer's loyalty points, purchase history, and
  preferences (Retail PRD 07) are the same regardless of which channel
  they're currently using.

## Edge Cases & Failure States

- Two channels both attempt to reserve the last unit of a variant near-
  simultaneously: first reservation wins; the second sees immediate
  unavailability, not a race that lets both "succeed" and later
  conflict — same first-write-wins discipline as every other
  concurrency edge case in this document set.
- BOPIS order's item goes out of stock between order placement and
  pick (e.g. a stock count correction): store staff flags the shortfall,
  customer is offered a substitute or refund — never silently
  fulfilled with the wrong item or silently cancelled without
  notification.
- Return-anywhere at a branch that doesn't carry the returned product
  line at all: still accepted (the receipt/sale record is tenant-wide),
  the stock movement credits that receiving branch regardless of
  whether it's a product line that branch normally stocks — a return
  should never be refused for organizational-inventory reasons the
  customer has no way to know about.
- Marketplace channel's webhook delivers an order for a product that's
  been discontinued: same handling as Restaurant OS PRD 15's equivalent
  edge case — order accepted using the captured snapshot, flagged for
  manager review.

## Data Model

No new tables beyond what Retail PRD 01/02/04/07 already define — this
PRD is architectural discipline (one inventory pool, channel field on
sales, adapter reuse) layered on existing tables, plus
`integration_connections`/`channel_sync_logs` shared with Restaurant OS
PRD 15/16's Integrations group for the social/marketplace channel
adapters specifically.

## Events Emitted

- `StockReserved` / `StockReservationReleased` — consumed by: Retail PRD
  02 (stock_levels), other channels' availability checks.
- `BopisOrderReady` / `ShipFromStoreOrderPacked` — consumed by:
  notification (customer pickup/shipping alerts).
- `OmnichannelSaleReceived` — consumed by: Retail PRD 07 (channel
  reporting).

## API Surface

- `POST /retail/omnichannel/reserve-stock`,
  `POST /retail/omnichannel/release-reservation`
- `POST /webhooks/retail-commerce/:channel` (WhatsApp/Instagram/
  Facebook/marketplace inbound orders)
- `GET /retail/fulfillment-queue` (BOPIS + ship-from-store, unified)

## Offline Behavior

In-store fulfillment actions (marking a BOPIS order ready, packing a
ship-from-store order) follow the same offline-first posture as Retail
PRD 01's checkout flow. Online-channel order intake itself requires
connectivity by nature, identical constraint to Restaurant OS PRD 15/16.

## Acceptance Criteria

- A sale on any one channel is immediately reflected in the stock figure
  every other channel reads — verified by a test purchase on one
  simulated channel and an immediate availability check on another.
- An abandoned online-order stock reservation releases automatically
  within its configured window, verified by letting a test reservation
  time out.
- A return processed at Branch B for an item purchased at Branch A
  correctly credits Branch B's stock, not Branch A's.

## Non-Goals

- Building the actual website/e-commerce storefront — a `customer-web`-
  style consumer surface is a separate build, this PRD owns the
  inventory/order unification underneath it, not the storefront UI
  itself.
- Marketplace-specific catalog optimization (SEO, marketplace-specific
  listing formatting) — later enhancement, not core omnichannel scope.
