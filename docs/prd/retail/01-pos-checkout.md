# Retail PRD 01: POS & Checkout

## Scope

Owns the retail selling flow: fast checkout, barcode scanning, carts,
suspend/resume, quotes, and the sale state machine. Corresponds to
master plan section 9 (Retail POS Features, Retail Workflow) and section
25 (sale state machine, Retail Checkout Happy Path). Does not own
inventory/variant data in detail (Retail PRD 02) or payment method
mechanics (reuses Restaurant OS PRD 07's payment adapters directly).

**Status note:** Retail OS is a Year 3+ priority per master plan section
3 — this PRD exists so the specification is ready when Retail OS enters
the build queue, following the same template as the Restaurant OS PRDs.
Build phase: **R2**, see `BUILD_WORKFLOW_RETAIL.md`.

## Dependencies

Restaurant OS PRD 00 (Multi-Tenancy), PRD 01 (Auth), PRD 07 (Payments —
reused directly, not reimplemented). Retail PRD 02 (Inventory &
Variants) — checkout resolves and deducts against variant-level stock.

## User Stories

- As a **cashier**, I need to scan a barcode and have the exact variant
  (size, color) added instantly, not a generic product I then have to
  disambiguate.
- As a **cashier**, I need to suspend a transaction (customer forgot
  their wallet, stepping away) and resume it later without losing the
  cart.
- As a **customer**, I need a quote I can come back to, not a cart that
  vanishes if I don't buy today.
- As a **store manager**, I need a cashier who tries to sell below the
  allowed price to be blocked without my approval, every time, no
  exceptions.

## Workflows

### Sale state machine

Exactly master plan section 25: `cart → quoted → pending_payment →
paid → fulfilled → returned → partially_returned`, with `voided`
reachable from `cart`/`quoted`/`pending_payment`.

### Checkout happy path

Exactly master plan section 25:

```text
Cashier opens POS
Cashier scans barcode -> system resolves the exact product variant
  (not just the parent product -- master plan section 9's variant
  example: "Nike Shoe, Sizes 40/41/42, Colors Black/White/Blue" each
  resolve to a distinct sellable unit)
Cashier adds customer (optional, Retail PRD 07's CRM)
Cashier applies discount if permitted (permission-gated, same pattern
  as Restaurant OS PRD 05's discount rule)
Cashier takes payment (Restaurant OS PRD 07's payment flow, reused
  directly -- cash/card/mobile money/split, same adapters)
System records sale -> sale.status = paid
Stock movement created (Retail PRD 02, deducts the specific variant sold)
Receipt printed or sent (Restaurant OS PRD 09's receipt pipeline, reused)
Customer loyalty updates (Retail PRD 07)
```

### Suspend and resume

```text
Cashier suspends an in-progress cart (customer needs to step away)
  -> sale.status stays at cart, cart contents preserved with a
     suspended flag and timestamp
  -> Suspended carts list is visible to any cashier at that location
     (not locked to the originating cashier -- a different cashier can
     resume it if the first one is now busy with another customer)
  -> Resuming restores the exact cart state; nothing is re-entered
```

### Quotes

```text
Customer wants a price without committing to purchase
  -> Cashier builds the cart, marks it as a quote -> sale.status = quoted
  -> Quote has a validity period (location-configurable) after which
     prices are no longer honored without re-quoting (protects against
     a stale quote at a since-changed price -- mirrors Restaurant OS
     PRD 03's price-snapshot discipline: a quote captures price at
     quote time, exactly like an order captures price at add time)
  -> Converting a quote to a sale re-validates current stock
     availability before proceeding to payment
```

### Multiple/saved carts

```text
Cashier can hold multiple concurrent carts on one terminal (e.g. serving
  two customers who are both still deciding)
  -> Each cart is independently addressable; switching between them
     does not lose either one's contents
```

## Screens & UI Behavior

- **POS checkout screen**: barcode-scan-first interaction, product
  search fallback, cart view with running total, mirrors Restaurant OS
  section 21's "add item to cart under 100ms" performance budget —
  retail checkout speed matters as much as restaurant order entry speed.
- **Suspended/saved carts list**: accessible from the main POS screen,
  not buried in a menu — resuming a suspended sale needs to be as fast
  as starting a new one.
- **Customer display** (master plan section 9): a second screen showing
  running total/items to the customer during checkout, standard retail
  hardware pattern.

## Permissions

| Action | cashier | store_manager |
| --- | --- | --- |
| Ring up a sale, suspend/resume | Yes | Yes |
| Apply a standard discount | Yes (threshold-limited) | Yes |
| Sell below allowed price | No (approval-gated) | Yes |
| Void a sale before payment | Yes | Yes |
| Create a quote | Yes | Yes |

## Business Rules

- **Cashier cannot sell below the allowed price without approval** —
  master plan section 25's explicit acceptance test. This is enforced
  at the point of payment, not just a UI warning that can be dismissed.
- Barcode scanning must resolve to the exact variant, never the parent
  product with a follow-up disambiguation step — the barcode *is* the
  variant identifier (master plan section 9: barcodes are a
  variant-level attribute, not product-level).
- A product with a serial number requires serial capture at sale time
  (master plan section 25's acceptance test) — this is mandatory for
  serialized inventory categories, not optional data entry.
- A product with batch/expiry tracking records the stock deduction from
  the specific batch selected (FEFO — first-expiry-first-out — is the
  sane default suggestion, but the cashier can override for a specific
  batch if the workflow requires it), never an undifferentiated
  quantity deduction that loses which batch was actually sold.
- Every sale's line items capture the price and product/variant details
  **at time of sale**, identical snapshot discipline to Restaurant OS
  PRD 05's order items — a later price or product change never
  retroactively affects a completed sale.

## Edge Cases & Failure States

- Barcode doesn't resolve to any known variant (damaged label, wrong
  barcode format): cashier falls back to product search; the failed
  scan is logged for inventory-data-quality review, not silently
  ignored.
- Suspended cart's items go out of stock before it's resumed: resuming
  flags the now-unavailable item rather than silently completing a sale
  for stock that no longer exists.
- Quote expires before conversion: converting an expired quote
  re-prices against current prices, with the change clearly shown to
  the cashier/customer before payment, never silently honoring a stale
  price past its validity window.
- Serial-number product sold without serial capture (workflow bypass
  attempt): blocked at the payment step, not just discouraged in the UI.

## Data Model

`DATA_MODEL.md` Later Retail OS: `sales`, `sale_items`, `quotes`,
`retail_products`, `retail_variants`, `barcodes`, `serial_numbers`,
`batches` (Retail PRD 02 owns the detail on the latter five).

## Events Emitted

- `SaleStarted` / `SaleSuspended` / `SaleResumed` / `SaleVoided` —
  consumed by: product analytics.
- `SaleCompleted` — consumed by: Retail PRD 02 (stock deduction), Retail
  PRD 07 (loyalty update, reporting).
- `QuoteCreated` / `QuoteConverted` / `QuoteExpired` — consumed by:
  Retail PRD 07 (reporting).

## API Surface

- `POST /retail/sales`, `PATCH /retail/sales/:id`
- `POST /retail/sales/:id/suspend`, `POST /retail/sales/:id/resume`
- `POST /retail/sales/:id/items` (barcode-scan or search-based add)
- `POST /retail/quotes`, `POST /retail/quotes/:id/convert`

## Offline Behavior

Follows the same offline-first discipline as Restaurant OS PRD 05/11 —
retail checkout is exactly as frontline-critical as restaurant order
entry, and should not be treated as a lesser priority just because
Retail OS is a later-phase vertical. Cash sales complete fully offline;
mobile money/card require online confirmation, identical rules to
Restaurant OS PRD 07.

## Acceptance Criteria

Exactly master plan section 25's acceptance tests: barcode scanning
finds the exact variant; a product with a serial number requires serial
capture; a product with batch/expiry records stock from the selected
batch; a cashier cannot sell below the allowed price without approval.

## Non-Goals

- Inventory/variant data management itself — Retail PRD 02.
- Returns/exchanges — Retail PRD 04.
