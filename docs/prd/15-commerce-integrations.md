# PRD 15: Commerce Integrations (Shopify, WooCommerce)

## Scope

Owns two-way sync between the platform's catalog/order engine and
external e-commerce storefronts. Corresponds to `BUILD_WORKFLOW.md` P15
and master plan Module 16 (Integration Framework). The technical adapter
shape (`ChannelAdapter`) is already fully specified in
`BUILD_WORKFLOW.md` section 6 — this PRD does not repeat it; it owns the
product-level workflow, permissions, and edge cases around using it for
Shopify/WooCommerce specifically.

## Dependencies

PRD 03 (Menu & Catalog) — catalog push. PRD 05 (Order Engine) — inbound
storefront orders become real orders. PRD 07 (Payments) — storefront
payment status reconciliation. PRD 09 — order confirmation delivery.

## User Stories

- As an **owner** who already runs a Shopify or WooCommerce store, I
  need my POS catalog and my storefront catalog to stay in sync without
  manually updating both.
- As an **owner**, I need an order placed on my storefront to show up in
  my kitchen exactly like a QR or POS order — my staff shouldn't need to
  watch a second screen.
- As a **manager**, I need to see integration health (last sync time,
  failures) so I know immediately if the storefront connection breaks,
  rather than discovering it when a customer complains an order never
  arrived.

## Workflows

### Connecting a store

```text
Owner enters Shopify/WooCommerce credentials (OAuth for Shopify, API
key for WooCommerce) via the ChannelAdapter's connect() method
  -> integration_connections row created, credentials encrypted at rest
     (BUILD_WORKFLOW.md section 6 rule -- never logged, never returned
     in API responses after initial save)
  -> healthCheck() confirms the connection before it's marked active
```

### Catalog push

```text
Product created/updated in the platform (PRD 03: ProductCreated/
ProductUpdated event)
  -> pushCatalog() syncs it to the connected storefront(s) within the
     configured sync interval
  -> Sync direction is platform -> storefront for catalog (the POS
     catalog is the source of truth; the storefront reflects it, not the
     reverse) -- this is a deliberate choice to avoid a second source of
     truth for pricing/availability
  -> Every push writes a channel_sync_logs row (success or failure),
     powering the admin console's integration health view
```

### Inbound order

```text
Customer places an order on the connected Shopify/WooCommerce storefront
  -> Storefront webhook received -> signature-verified before any
     domain command runs (BUILD_WORKFLOW.md section 6 rule, no
     exceptions)
  -> Adapter calls the SAME order-creation command PRD 05 exposes to
     every other channel (POS, QR, phone) -- never writes directly to
     `orders` -- channel=commerce_shopify or commerce_woocommerce
  -> If the order contains kitchen-routed items: kitchen ticket generated
     exactly as any other order (PRD 06) -- staff never need a separate
     screen for storefront orders
  -> Order confirmation sent to the customer via PRD 09's pipeline
```

### Payment reconciliation

```text
Storefront order's payment status (paid via the storefront's own
checkout, e.g. Shopify Payments) is reconciled against the platform's
own payment record for that order
  -> If storefront reports paid but platform has no matching payment:
     flagged for manual review, not silently trusted -- this is the
     same "unmatched payment -> review queue" pattern payments
     reconciliation uses elsewhere (PRD 07)
```

## Screens & UI Behavior

- **Integration settings** (owner-web/admin-web): connect/disconnect,
  sync interval configuration, last-sync status.
- **Integration health / error dashboard** (admin-web, per Module 16's
  "Error dashboard, Manual retry" features): sync failures listed with
  enough context to diagnose ("why didn't my Glovo order show up" — the
  exact support scenario `BUILD_WORKFLOW.md` names for the delivery
  case, equally true here).

## Permissions

| Action | owner | branch_manager | admin (internal) |
| --- | --- | --- | --- |
| Connect/disconnect a store | Yes | No | Yes (support-assisted) |
| View sync/error logs | Yes | Yes (own location) | Yes |
| Manually retry a failed sync | Yes | Yes | Yes |

## Business Rules

- The platform catalog is the single source of truth for price/
  availability; the storefront is a mirror, never edited independently
  in a way that could drift — this is a direct consequence of PRD 03's
  own price-versioning rule: there is one place prices are set.
- An adapter never writes directly to `orders`/`products`/`stock_levels`
  — it always calls the same module commands every other channel uses
  (`BUILD_WORKFLOW.md` section 6's module-boundary rule, restated here
  because it's the single most important constraint on this PRD).
- Every webhook is signature-verified before processing, unconditionally.

## Edge Cases & Failure States

- Storefront webhook arrives for a product that no longer exists on the
  platform (deleted-in-spirit/discontinued, PRD 03's lifecycle rule):
  order creation proceeds using the captured storefront snapshot data
  where possible, flagged for manager review rather than silently
  failing.
- Sync interval lapses due to a provider outage: catalog drift is
  bounded by the configured interval and surfaced in the health
  dashboard, not silently tolerated indefinitely.
- Duplicate inbound order webhook (provider retry): idempotency key
  (order's storefront order ID) prevents double-creating the order.

## Data Model

`DATA_MODEL.md` Integrations group: `integration_connections`,
`channel_product_mappings`, `channel_order_mappings`,
`channel_sync_logs`.

## Events Emitted

- `StorefrontOrderReceived`, `CatalogSyncCompleted`/`CatalogSyncFailed`
  — consumed by: PRD 14 (channel-mix reporting), admin health dashboard.

## API Surface

- `POST /integrations/commerce/:provider/connect`,
  `DELETE /integrations/commerce/:provider`
- `POST /webhooks/commerce/:provider` (inbound orders)
- `GET /integrations/commerce/:provider/sync-logs`
- `POST /integrations/commerce/:provider/retry`

## Offline Behavior

Not offline-capable by nature — requires connectivity to both the
platform API and the external storefront provider. An offline period
simply delays sync; queued outbound catalog pushes and pending inbound
webhooks resume once connectivity returns, following the general
retry-queue pattern (Module 16), not the POS operation-log pattern
(PRD 11 is specific to device-level offline operation).

## Acceptance Criteria

Exactly `BUILD_WORKFLOW.md` P15's gate: a product created in the POS
catalog appears in the connected Shopify/WooCommerce store within the
configured sync interval; an order placed on the storefront appears as a
real order in the same order engine, routes to the kitchen if it
contains kitchen items, and its payment status reconciles against the
storefront's own payment record.

## Non-Goals

- Building a storefront/e-commerce platform of our own — explicitly
  integrate, never rebuild (`ENGINEERING_CHARTER.md`'s scale-appropriate
  complexity principle, and master plan's own "integrate everything,
  build only what differentiates" strategic rule).
- Inventory push *to* the storefront beyond availability status (full
  bidirectional stock-level sync is a later enhancement, not P15 MVP
  scope).
