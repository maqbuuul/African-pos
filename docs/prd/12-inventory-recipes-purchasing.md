# PRD 12: Inventory, Recipes & Purchasing

## Scope

Owns ingredient/stock tracking, recipe-to-ingredient costing, and the
supplier/purchase-order cycle. Corresponds to master plan section 7
Inventory And Recipe Features, Module 7 (Inventory Core), Module 8
(Procurement And Suppliers), and `DATA_MODEL.md` Inventory group
(`suppliers`, `inventory_items`, `stock_locations`, `stock_levels`,
`stock_movements`, `purchase_orders`, `purchase_order_items`,
`goods_receipts`, `stock_counts`, `stock_adjustments`, `recipes`,
`recipe_ingredients`, `wastage_events`). Does not own the sellable
product/price itself (PRD 03) — recipes link a product to what it costs
to make, they don't define what it sells for.

## Dependencies

PRD 03 (Menu & Catalog) — recipes attach to products. PRD 05 (Order
Engine) — recipe deduction triggers on order item state transitions
(`BUILD_WORKFLOW.md` P12 depends on P3, P5 for exactly this reason).

## User Stories

- As a **stock controller**, I need to receive a supplier delivery
  against a purchase order and have stock levels update automatically,
  without a separate manual stock-in step.
- As a **chef/manager**, I need every sale to automatically deduct the
  right ingredient quantities per the recipe, so stock levels reflect
  reality without manual counting after every order.
- As a **branch manager**, I need a low-stock alert before an ingredient
  actually runs out, with enough lead time to reorder.
- As an **owner**, I need food cost percentage per product, computed from
  actual recipe/ingredient costs, not a guess — this is one of the
  numbers that directly drives profitability decisions.
- As a **stock controller**, I need to record wastage with a reason, so
  shrinkage is visible and attributable, not just an unexplained gap
  between expected and counted stock.

## Workflows

### Recipe-driven stock deduction (the core loop)

```text
Order item transitions to a deduction-triggering state (implementation
choice: at order_item.status -> sent, or -> served, depending on how
tightly the business wants deduction tied to actual consumption vs.
kitchen commitment -- location-configurable, defaulting to `sent`)
  -> System looks up the product's active recipe (recipe_ingredients)
  -> For each ingredient: stock_movement created, type=recipe_deduction,
     quantity = recipe quantity x order item quantity, referencing the
     order_item that triggered it
  -> stock_levels (materialized view) recalculated from the movement
  -> If resulting stock_level < reorder threshold: low-stock alert fires
     (Module 4 notification)
```

### Purchase order to goods receipt

```text
Stock controller (or system, via suggested-reorder) creates a
purchase_order against a supplier: line items, quantities, expected
prices (from supplier's price history where available)
  -> Approval workflow if above a configured threshold (permission-gated,
     PRD 01 pattern)
  -> purchase_order.status: draft -> sent -> partially_received ->
     received
  -> Supplier delivers -> stock controller records a goods_receipt
     against the PO: actual quantities and prices received (may differ
     from ordered -- discrepancies flagged, not silently accepted)
  -> stock_movement created, type=receive, for each received line
  -> stock_levels updated; if actual price differs from expected,
     ingredient cost history (referenced by recipe costing) updates too
```

### Stock count and adjustment

```text
Scheduled or ad-hoc stock_count session opened for a location/stock_area
  -> Staff counts physical stock, enters counted quantities per item
  -> System compares counted vs. stock_levels (expected)
  -> Variance beyond a threshold requires a reason (mirrors PRD 08's
     cash-variance pattern) -> stock_adjustment created, approval-gated
     for large variances (inventory:approve_adjustment permission)
  -> stock_movement created, type=adjustment, referencing the
     stock_adjustment -- stock_levels are corrected via a movement, never
     by directly overwriting the stock_levels row (master plan Data
     Integrity Rule: "Inventory uses stock movements, not direct
     quantity overwrites")
```

### Wastage

```text
Staff records a wastage event: item, quantity, reason (spoilage, prep
error, dropped, expired, theft-suspected)
  -> stock_movement created, type=wastage
  -> wastage_events row records the reason and staff_id -- this is
     reporting-critical data (PRD 14's Food Waste Analytics), not just a
     stock-correction side effect
```

### Inter-branch transfer

```text
Location A sends stock to Location B (multi-branch operation)
  -> transfer_out movement at A, transfer_in movement at B, linked by a
     shared transfer reference -- both locations' stock_levels update
     atomically from the platform's perspective, even though they're
     different locations (a transfer is never "lost" between the two
     movements)
```

### Suggested reorder

```text
System monitors stock_levels trend and consumption rate per item
  -> When projected days-of-stock falls below a configurable threshold:
     draft purchase_order auto-generated (not auto-sent) against the
     item's preferred/cheapest recent supplier
  -> Stock controller reviews and approves/edits before it's actually
     sent -- this is a draft-generation convenience, never an
     autonomous purchase commitment
```

## Screens & UI Behavior

- **Stock levels view** (manager-web): current stock by item/location,
  low-stock items visually flagged, days-of-stock-remaining estimate.
- **Purchase order builder**: supplier selection, line items with
  price-history-informed suggested prices, approval status.
- **Goods receipt screen**: PO line items pre-filled, staff adjusts to
  actual received quantities/prices, discrepancies highlighted inline
  (not a separate reconciliation step later).
- **Stock count screen**: item-by-item count entry (barcode/search),
  variance summary before submission.
- **Recipe editor** (manager-web): ingredient list with quantities,
  live-computed food cost and food cost % as ingredients/quantities
  change.

## Permissions

Inventory group per master plan section 22: `inventory:view`,
`inventory:receive`, `inventory:adjust`, `inventory:transfer`,
`inventory:count`, `inventory:approve_adjustment`.

| Action | stock_controller | branch_manager | chef |
| --- | --- | --- | --- |
| View stock levels | Yes | Yes | Yes (own station's items) |
| Receive goods against a PO | Yes | Yes | No |
| Create/send purchase order | Yes | Yes (approval above threshold) | No |
| Record wastage | Yes | Yes | Yes |
| Approve large stock adjustment | No | Yes | No |
| Edit recipes | No | Yes | No (view-only) |

## Business Rules

- **Stock is never directly overwritten.** Every change to
  `stock_levels` happens via a `stock_movements` row — this is the
  single most important rule in this PRD and mirrors the financial
  ledger discipline elsewhere in the platform. `stock_levels` is a
  materialized/derived view, always reconstructable from the movement
  log.
- Recipe deduction quantities are captured **as configured at the moment
  of the triggering order event**, consistent with PRD 05's
  price/product snapshot rule — if a recipe changes later, historical
  deductions aren't retroactively recalculated.
- Recipes are versioned, not overwritten (`ENGINEERING_CHARTER.md`'s
  versioning rule) — `DATA_MODEL.md`'s `recipes` table carries
  `version_number`/`effective_from`/`effective_to`, the same pattern as
  PRD 03's `product_prices`.
- Ingredient cost history (for food-cost-percentage calculation) is
  derived from `goods_receipts` actual prices, not `purchase_order`
  expected prices — the real cost is what was actually paid.
- A stock adjustment always requires a reason and, above a threshold,
  approval — treated with the same seriousness as a cash variance (PRD
  08) or an audit-logged destructive action (PRD 02).

## Edge Cases & Failure States

- Recipe deduction triggers for an item with insufficient recorded
  stock (stock_level would go negative): allowed by default (the sale
  already happened; blocking it doesn't undo a completed order) but
  flagged as a "stock went negative" exception for manager review — this
  usually indicates either a missed goods receipt or a wrong recipe
  quantity, not something to silently permit unnoticed.
- Two stock counts opened concurrently for the same location: second
  attempt blocked/warned — a stock count needs a stable baseline, so
  concurrent counting sessions for the same stock area would produce
  meaningless variances.
- Goods receipt recorded against an already-fully-received PO (duplicate
  entry): rejected, or explicitly routed as an unplanned/off-PO receipt
  instead — never silently double-counted as additional stock.
- Inter-branch transfer where the receiving location never confirms
  receipt: `transfer_out` at the source is not sufficient on its own —
  stock is considered "in transit," not yet added to the destination's
  `stock_levels`, until `transfer_in` is recorded, so nothing is
  double-counted or lost in the gap.

## Data Model

`DATA_MODEL.md` Inventory group, in full, including `recipes`'
versioning columns.

## Events Emitted

- `StockMovementRecorded` (all types) — consumed by: PRD 14 (inventory
  analytics), PRD 17 (demand/stockout forecasting features).
- `LowStockDetected` — consumed by: notification module (Module 4's
  "low stock" operational alert), suggested-reorder workflow.
- `PurchaseOrderApproved` / `GoodsReceived` — consumed by: PRD 14
  (procurement analytics, supplier scorecards), accounting integration
  (later, PRD 15/18).
- `WastageRecorded` — consumed by: PRD 14 (food waste analytics).
- `StockAdjustmentApproved` — consumed by: PRD 02 (audit).

## API Surface

- `GET /inventory-items`, `GET /stock-levels`
- `POST /purchase-orders`, `PATCH /purchase-orders/:id`,
  `POST /purchase-orders/:id/receive` (goods receipt)
- `POST /stock-counts`, `POST /stock-counts/:id/submit`
- `POST /stock-adjustments`
- `POST /wastage-events`
- `POST /stock-transfers`
- `GET/POST/PATCH /recipes`, `GET /recipes/:id/cost`

## Offline Behavior

Recipe deduction must work offline — it's triggered by order events
(PRD 05) which are themselves fully offline-capable, so deduction
follows the same operation-log pattern. Goods receipt, purchase orders,
and stock counts are back-office workflows that typically happen with
connectivity but should still degrade gracefully (queue and sync)
rather than being blocked outright if a stock controller's device drops
connectivity mid-count.

## Acceptance Criteria

- A sale correctly deducts every ingredient in its recipe, verified
  against a reference recipe with multiple ingredients and quantities.
- Stock levels are always reconstructable by replaying `stock_movements`
  from zero — verified by an automated test comparing the materialized
  `stock_levels` against a fresh replay.
- A goods receipt with a price different from the PO's expected price is
  flagged, not silently accepted, and updates ingredient cost history
  correctly.

## Non-Goals

- Supplier-facing self-service portal (suppliers submitting their own
  price lists) — later, part of master plan's broader supplier
  intelligence ambitions, not P12 scope.
- AI-driven demand forecasting for reorder suggestions — PRD 17 owns the
  forecasting model itself; this PRD's "suggested reorder" workflow uses
  simple trend-based thresholds until PRD 17 exists to feed it something
  smarter.
