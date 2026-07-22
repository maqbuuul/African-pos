# Retail PRD 02: Inventory & Variants

## Scope

Owns retail product/variant modeling, warehouses, bin locations,
transfers, and stock counting. Corresponds to master plan section 9
(Retail Inventory Features) and section 25 (stock count state machine,
Inventory Count Workflow). Shares the append-only stock-movement
discipline with Restaurant OS PRD 12, extended here with retail-specific
concepts (variants, serials, batches) that Restaurant OS's simpler
ingredient inventory doesn't need.

**Status note:** see Retail PRD 01 — Year 3+ priority. Build phase:
**R1**, see `BUILD_WORKFLOW_RETAIL.md` (foundational — before checkout).

## Dependencies

Restaurant OS PRD 00 (Multi-Tenancy). Retail PRD 01 (sales trigger stock
deduction).

## User Stories

- As a **stock controller**, I need to manage a product with multiple
  size/color variants as one logical product with distinct sellable
  SKUs, not N unrelated products.
- As a **warehouse staff member**, I need bin-level location tracking so
  "where is this item" has a precise answer, not just "somewhere in the
  warehouse."
- As a **store manager**, I need stock counts with variance thresholds
  that route big discrepancies to owner/auditor review automatically.
- As an **owner**, I need accurate inventory valuation across every
  warehouse and store, not an estimate.

## Workflows

### Variant modeling

```text
Product: "Nike Shoe" (master plan section 9's example)
  -> Variants: every combination of size (40/41/42) x color
     (Black/White/Blue) is its own retail_variants row, each with its
     own barcode, its own stock_levels entry, and its own price
     (variant-level price override supported, defaulting to the parent
     product's price)
  -> Bundles/kits: a variant composed of other variants (e.g. a gift
     set) -- selling the bundle deducts the constituent variants'
     stock, not a separate bundle-stock figure, following the same
     "deduct from the real underlying stock" principle as Restaurant OS
     PRD 12's recipe deduction
```

### Stock count workflow

Exactly master plan section 25:

```text
Manager creates a stock count
System freezes an expected-quantity snapshot at count start (so
  concurrent sales during the count don't corrupt the comparison)
Stock controller counts items (barcode-scan-based counting, not manual
  tally sheets)
Variances calculated (counted vs. frozen snapshot)
Manager reviews high variances
Approved variances create stock movements (never a direct stock_levels
  overwrite -- identical discipline to Restaurant OS PRD 12)
Inventory valuation updates
Audit events written (Restaurant OS PRD 02's audit pattern, reused)
```

Variance thresholds (master plan section 25): low variance can
auto-approve (location-configurable), medium variance requires manager
review, high variance escalates to owner/auditor review — three tiers,
not a single "review everything" or "approve everything" default.

### Transfers

```text
Warehouse-to-store or store-to-store transfer requested
  -> transfer_out movement at source, transfer_in at destination, same
     linked-movement pattern as Restaurant OS PRD 12's inter-branch
     transfer -- stock is "in transit" between the two movements, never
     double-counted or lost in the gap
  -> Bin-location updates at both ends once the transfer completes
```

### Batch and expiry tracking

```text
Product configured with batch/expiry tracking (perishables, cosmetics,
  pharmaceuticals depending on the retail category)
  -> Every goods receipt records the batch and expiry date
  -> Stock deduction at sale (Retail PRD 01) draws from a specific
     batch, FEFO-suggested but overridable
  -> Expiry-risk report (Retail PRD 07) surfaces batches approaching
     expiry before they become unsellable dead stock
```

## Screens & UI Behavior

- **Product/variant editor** (store manager, procurement officer):
  parent product with a variant matrix builder (size × color grid,
  bulk-generate variants rather than one-by-one entry).
- **Stock count screen**: barcode-scan counting flow, live variance
  display as items are counted, not only at submission.
- **Bin location map** (warehouse staff): where a given SKU physically
  is, and what's in a given bin — bidirectional lookup.
- **Inventory valuation dashboard**: value by warehouse/store/category,
  dead stock and fast/slow mover flags (Retail PRD 07's dashboard
  consumes this data).

## Permissions

| Action | warehouse_staff | stock_controller | store_manager |
| --- | --- | --- | --- |
| Count stock | Yes | Yes | Yes |
| Approve low/medium variance | No | Yes (per threshold) | Yes |
| Approve high variance | No | No | Owner/auditor only |
| Create/edit variants | No | Yes | Yes |
| Initiate a transfer | Yes | Yes | Yes |

## Business Rules

- **Stock is never directly overwritten** — every change to
  `stock_levels` happens via a `stock_movements` row, identical
  discipline to Restaurant OS PRD 12, restated here because it's this
  PRD's single most important rule too.
- A stock count's expected-quantity comparison is frozen at count start
  — concurrent sales during the count are handled as their own
  post-freeze movements, never silently folded into the count's variance
  calculation (which would make the variance meaningless).
- Serial numbers are unique per unit and tracked individually — a
  serialized item's stock "quantity" is really a count of distinct
  serial records, not an undifferentiated number.
- Variants of one parent product share the product's category/tax
  settings by default but can override price, barcode, and
  availability independently — a variant is not merely a display
  grouping, it's a fully independent sellable unit underneath.

## Edge Cases & Failure States

- Two stock counts opened for overlapping bin locations simultaneously:
  blocked or warned, same as Restaurant OS PRD 12's concurrent-count
  rule — a count needs a stable snapshot.
- Transfer where the destination never confirms receipt: stock stays
  "in transit," never added to the destination's `stock_levels` until
  `transfer_in` is recorded, identical to Restaurant OS PRD 12's
  transfer edge case.
- A serialized item's serial number is scanned twice at receiving (data
  entry error): rejected as a duplicate, not silently creating two
  stock units from one physical item.
- Batch expiry date passes with unsold stock still on hand: flagged
  automatically as expired/unsellable, feeding both the expiry-risk
  report and a wastage-equivalent movement (Retail PRD 07 reporting) —
  never silently left in sellable stock levels past expiry.

## Data Model

`DATA_MODEL.md` Later Retail OS: `retail_products`, `retail_variants`,
`barcodes`, `serial_numbers`, `batches`, `warehouses`,
`stock_transfers`. Shares the same `stock_movements`-style append-only
discipline as Restaurant OS's Inventory group, though Retail OS's own
stock-movement/stock-level tables are not yet itemized as distinct
tables in `DATA_MODEL.md` — flagged as a schema gap; whether Retail OS
reuses Restaurant OS's `stock_movements`/`stock_levels` tables directly
(with a `product_type` discriminator) or gets its own parallel tables is
a real design decision for whoever implements this PRD, not decided
here.

## Events Emitted

- `VariantCreated` / `VariantUpdated` — consumed by: Retail PRD 01
  (checkout catalog), search indexing.
- `StockMovementRecorded` (retail context) — consumed by: Retail PRD 07
  (inventory analytics), Retail PRD 03 (reorder suggestions).
- `StockCountVarianceDetected` — consumed by: notification (manager/
  owner review alert per tier).
- `BatchExpiryApproaching` / `BatchExpired` — consumed by: notification,
  Retail PRD 07 (expiry-risk report).

## API Surface

- `GET/POST /retail/products`, `GET/POST /retail/variants`
- `POST /retail/stock-counts`, `POST /retail/stock-counts/:id/submit`
- `POST /retail/stock-transfers`
- `GET /retail/inventory-valuation`

## Offline Behavior

Barcode-scan checkout deduction (triggered from Retail PRD 01) follows
the same offline-first discipline as that PRD. Stock counts and
transfers are back-office workflows that degrade gracefully offline
(queue and sync) rather than requiring hard connectivity, matching
Restaurant OS PRD 12's same posture.

## Acceptance Criteria

- Stock levels are always reconstructable by replaying `stock_movements`
  from zero, identical bar to Restaurant OS PRD 12.
- A stock count's variance correctly reflects only pre-freeze
  discrepancies, not sales that occurred during the count.
- Every serialized-item sale correctly consumes exactly one serial
  record, never zero or more than one.

## Non-Goals

- Procurement/purchase-order workflow — Retail PRD 03.
- Returns-driven stock movements — Retail PRD 04.
