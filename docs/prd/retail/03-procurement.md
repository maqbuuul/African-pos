# Retail PRD 03: Procurement

## Scope

Owns purchase orders, supplier catalogs, RFQs, and the reorder
suggestion workflow for retail. Corresponds to master plan section 9
(Retail Procurement Features) and section 25 (purchase order state
machine, Retail Reorder Workflow). Structurally close to Restaurant OS
PRD 12's purchasing half — this PRD reuses that discipline rather than
inventing a new one, extended for retail-specific concerns (RFQs,
supplier catalogs).

**Status note:** see Retail PRD 01 — Year 3+ priority. Build phase:
**R3**, see `BUILD_WORKFLOW_RETAIL.md`.

## Dependencies

Retail PRD 02 (purchase orders receive against variant-level inventory).

## User Stories

- As a **procurement officer**, I need to request quotes from multiple
  suppliers before committing to a purchase order, not just accept one
  supplier's price by default.
- As a **stock controller**, I need reorder suggestions that account for
  sales velocity, lead time, and safety stock — not a flat "reorder when
  below X units" rule that ignores how fast an item actually sells.
- As a **store manager**, I need purchase order approval gated
  appropriately — small restocks shouldn't need the same sign-off as a
  large seasonal buy.
- As a **procurement officer**, I need partial receiving handled
  cleanly — a PO is rarely fulfilled in one delivery.

## Workflows

### Purchase order state machine

Exactly master plan section 25: `draft → pending_approval → approved →
sent → partially_received → received → closed`, with `cancelled`
reachable from any pre-sent state.

### Reorder workflow

Exactly master plan section 25:

```text
System calculates reorder suggestions from: sales velocity, current
  stock, pending POs, supplier lead time, safety stock, seasonality,
  promotion calendar (master plan section 9's full suggestion-input
  list -- richer than Restaurant OS PRD 12's simpler trend-based
  default, appropriate for retail's typically larger SKU count)
Stock controller reviews suggestions
Purchase order draft created (never auto-sent, same "draft-generation
  convenience, not autonomous commitment" rule as Restaurant OS PRD 12)
Manager approves purchase order
PO sent to supplier
Goods received (partial or full)
Stock levels update (Retail PRD 02's stock-movement discipline)
Supplier performance updates (Retail PRD 07 reporting)
```

### RFQ (request for quote)

```text
Procurement officer needs pricing from multiple suppliers before
  committing
  -> RFQ sent to selected suppliers from the supplier catalog
  -> Responses recorded (price, lead time, terms) per supplier
  -> Procurement officer selects a winning quote -> purchase order
     created referencing the RFQ and the chosen supplier's terms
  -> Losing quotes remain on record for future supplier-performance
     comparison, not discarded
```

### Partial receiving

```text
Goods delivered against a PO, but not the full ordered quantity
  -> Goods receipt records exactly what arrived, per line item
  -> purchase_order_items track received-vs-ordered quantity per line
  -> PO status -> partially_received until every line is fully received
     or the procurement officer explicitly closes it short (e.g.
     supplier can't fulfill the remainder)
  -> Each receipt event creates its own stock_movements entries
     (Retail PRD 02), never one lump movement for a multi-delivery PO
```

## Screens & UI Behavior

- **PO builder** (procurement officer): supplier/catalog selection,
  line items with price-history-informed suggestions, RFQ comparison
  view when multiple quotes exist.
- **Reorder suggestions dashboard** (stock controller): ranked
  suggestions with the driving factors visible (velocity, lead time,
  seasonality) — not a black-box number, per the platform-wide "explain,
  don't just dictate" principle.
- **Goods receiving screen**: PO line items pre-filled, staff adjusts to
  actual received quantities, discrepancies highlighted inline —
  identical UX pattern to Restaurant OS PRD 12's receiving screen.

## Permissions

| Action | procurement_officer | store_manager | regional_manager |
| --- | --- | --- | --- |
| Create RFQ / PO draft | Yes | Yes | Yes |
| Approve PO (standard threshold) | No | Yes | Yes |
| Approve PO (large/seasonal, above threshold) | No | No | Yes |
| Receive goods | Yes | Yes | Yes |

## Business Rules

- A purchase order is never auto-sent — every draft (whether
  system-suggested or manually created) requires explicit approval
  before it becomes a real commitment to a supplier, identical rule to
  Restaurant OS PRD 12.
- PO approval threshold scales with order value — this is a
  configurable `tenant_settings`-style threshold (following Restaurant
  OS's pattern for configurable thresholds), not a fixed platform
  constant.
- Every receipt against a PO is its own stock-movement event, never
  batched into one lump receipt for a multi-delivery order — partial
  receiving must be traceable delivery-by-delivery.
- Reorder suggestions are a recommendation, not an autonomous purchase —
  identical non-goal to every other AI/automated-suggestion feature in
  this document set.

## Edge Cases & Failure States

- Supplier delivers more than ordered (over-delivery): goods receipt
  captures the actual received quantity; the excess is flagged for
  procurement officer decision (accept and adjust the PO, or reject the
  excess) rather than silently accepted as a stock discrepancy to
  discover later at count time.
- RFQ deadline passes with no response from a supplier: that supplier's
  quote is simply absent from the comparison, not treated as a zero-cost
  quote or otherwise defaulted incorrectly.
- PO closed short (supplier can't fulfill the remainder): the
  unfulfilled quantity is explicitly recorded as such, feeding supplier
  performance/fill-rate reporting (Retail PRD 07), not silently dropped
  from the record.

## Data Model

`DATA_MODEL.md` Later Retail OS shares the purchasing pattern with
Restaurant OS's Inventory group (`purchase_orders`,
`purchase_order_items`, `goods_receipts`, `suppliers`) — Retail OS's
RFQ concept (`supplier_rfqs`, `rfq_responses`) is not yet itemized in
`DATA_MODEL.md`, flagged as a schema gap for implementation.

## Events Emitted

- `PurchaseOrderApproved` / `GoodsReceived` (retail context) — shared
  pattern with Restaurant OS PRD 12's equivalents.
- `RfqSent` / `RfqResponseReceived` — consumed by: Retail PRD 07
  (supplier comparison reporting).
- `SupplierPerformanceUpdated` — consumed by: Retail PRD 07.

## API Surface

- `POST /retail/rfqs`, `POST /retail/rfqs/:id/responses`
- `POST /retail/purchase-orders`, `PATCH /retail/purchase-orders/:id`,
  `POST /retail/purchase-orders/:id/receive`
- `GET /retail/reorder-suggestions`

## Offline Behavior

Back-office workflow — degrades gracefully offline (queue and sync)
rather than requiring hard connectivity, same posture as Restaurant OS
PRD 12's purchasing half.

## Acceptance Criteria

Exactly master plan section 25's Retail Reorder Workflow, verified
end-to-end: suggestion generated from the full input set → draft →
approval → send → receive → stock update → supplier performance update.

## Non-Goals

- Supplier-facing self-service RFQ response portal — later enhancement,
  not assumed for this PRD's initial scope (RFQ responses recorded
  manually by procurement staff is the baseline).
- Automated supplier selection — RFQ comparison surfaces data, the
  procurement officer decides.
