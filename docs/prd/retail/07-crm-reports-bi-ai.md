# Retail PRD 07: CRM, Reports, BI & AI

## Scope

Owns retail customer relationship data, financial reporting, role
dashboards, ML models, and AI briefings — combining master plan section
9's Retail CRM Features, Retail Finance Features, Retail Reports, Retail
BI Dashboards, Retail ML Models, and Retail AI Features into one PRD,
matching the same combined-scope approach as Hotel PRD 08. Reuses
Restaurant OS PRD 13's CRM discipline and PRD 14/17's reporting/AI
discipline directly rather than reinventing either.

**Status note:** see Retail PRD 01 — Year 3+ priority. Build phase:
**R7**, see `BUILD_WORKFLOW_RETAIL.md`.

## Dependencies

Every other Retail PRD (01–06) — this module consumes their events.
Restaurant OS PRD 13 (shared customer-identity pattern).

## User Stories

- As a **store manager**, I need to see a customer's purchase history
  and favorite products the moment I look them up.
- As an **owner**, I need one dashboard showing revenue, profit,
  customers, inventory value, branches, growth, alerts, and forecasts.
- As a **stock controller**, I need fast movers, slow movers, dead
  stock, stockouts, and expiry risk on one inventory dashboard.
- As a **procurement officer**, I need reorder quantity recommendations,
  not just a stockout warning with no suggested action.
- As an **owner**, I need to know if a branch's refund rate is unusually
  high, the moment it becomes a pattern, not at month-end review.

## Workflows

### Retail CRM (master plan section 9, in full)

```text
Customer profile, purchase history, favorite products, loyalty points,
  loyalty tiers, coupons, cashback, store credit, birthday offers,
  churn score, LTV, segments

Identity resolution: identical phone-first pattern to Restaurant OS PRD
  13 -- this is genuinely the same shared-platform CRM system (master
  plan section 3's "shared platform contains roughly 80% of the
  codebase"), not a parallel retail-specific identity system. Retail-
  specific fields (favorite products, purchase history by category)
  extend the same customers/loyalty_accounts/loyalty_events tables
  Restaurant OS PRD 13 already defines.
```

### Reports (master plan section 9, in full)

```text
Sales: daily/weekly/monthly/annual/hourly, by category, by product, by
  cashier, by branch
Inventory: valuation, dead stock, fast movers, slow movers, stock aging,
  stockouts, expiry risk, shrinkage, transfers
Customer: top customers, new customers, returning customers, churn,
  LTV, segments, loyalty activity
Finance: P&L, taxes, cash flow, margin by product, margin by branch
Staff: attendance, sales by cashier, commission, refunds by cashier,
  performance
```

Every figure traces to source events from Retail PRD 01–06 — same
non-negotiable rule as Restaurant OS PRD 14.

### Role dashboards (master plan section 9, exact groupings)

```text
Owner dashboard: revenue, profit, customers, inventory value, branches,
  growth, alerts, forecasts
Inventory dashboard: fast movers, slow movers, dead stock, stockouts,
  expiry risk, reorder suggestions
Customer dashboard: LTV, retention, churn, segments, loyalty
Operations dashboard: branches, suppliers, employees, warehouses, stock
  transfers
```

### ML models (master plan section 9, in full)

```text
Revenue forecasting: inputs (sales history, promotions, seasonality,
  holidays) -> expected revenue -> used by owner dashboard, procurement

Demand forecasting: inputs (historical sales, seasonality, promotions,
  price changes) -> expected units sold -> used by purchasing/inventory
  planning

Stockout prediction: inputs (stock on hand, sales velocity, pending
  POs, lead time) -> stockout risk + reorder date -> used by stock
  controller

Customer churn: inputs (RFM, categories purchased) -> churn probability
  + offer suggestion -> used by marketing automation

Customer lifetime value: inputs (spend history, purchase frequency,
  product categories) -> predicted spend + tier recommendation -> used
  by loyalty/promotions

Fraud detection: inputs (cashier behavior, refund rates, transaction
  history) -> anomaly score -> used by owner/auditor (same
  named-threshold discipline as Restaurant OS PRD 17's anomaly
  detection, applied here: an unusually high refund rate at one branch
  names the specific threshold crossed, never a vague "something's off")

Recommendation engine: inputs (basket history, customer preferences,
  inventory) -> next best product -> used by cashier upsell and
  WhatsApp commerce

Inventory optimization: inputs (demand forecast, lead time, safety
  stock, holding cost) -> purchase quantity -> used by procurement

Promotion effectiveness: inputs (past promotions, sales uplift, margin,
  customer segments) -> expected lift + margin impact -> used by
  marketing

Supplier performance prediction: inputs (supplier history, lead time,
  discrepancy rate) -> risk score -> used by procurement
```

### AI briefings (master plan section 9, exact example format)

```text
Daily retail briefing composed from the above models plus current
  sales/inventory data -- headline figure, top product, named alerts,
  concrete recommended actions, exactly the format shown in master plan
  section 9's example:

"Revenue yesterday was KES 92,300, up 18%. Top product: 2kg rice.
Alerts: milk may stock out tomorrow; Branch 3 has unusually high
refunds; cooking oil margin dropped by 4%.
Recommended actions: increase milk order by 25%; review Branch 3 refund
activity; check supplier price change for cooking oil."
```

Inventory risk summary, supplier recommendation explanation, promotion
suggestions, natural-language inventory query, customer segment
summary, WhatsApp commerce assistant, and slow-moving-stock action plan
follow the same task-specific-agent pattern as Restaurant OS PRD 17.

## Screens & UI Behavior

Four role dashboards as listed above, built to the same design system
as Restaurant OS master plan section 30 — shared platform design
discipline, not redefined per vertical, identical statement to Hotel
PRD 08's.

## Permissions

| Dashboard/report | owner | store_manager | regional_manager | procurement_officer |
| --- | --- | --- | --- | --- |
| Owner dashboard | Yes | No | No | No |
| Inventory dashboard | Yes | Yes (own location) | Yes | Yes |
| Customer dashboard | Yes | Yes (own location) | Yes | No |
| Operations dashboard | Yes | No | Yes | No |
| Finance reports | Yes | No | Regional: yes | No |

## Business Rules

- Every dashboard and AI briefing figure traces to a named source event
  from Retail PRD 01–06 — identical discipline to Restaurant OS PRD 14
  and Hotel PRD 08.
- Every ML output is a recommendation surfaced to a human, never
  autonomously applied — identical non-goal to Restaurant OS PRD 17 and
  Hotel PRD 08, restated a third time in this document set because it's
  a platform-wide, non-negotiable design principle, not a per-vertical
  choice.
- Model outputs stored with model version and source metrics
  (`DATA_MODEL.md` modeling principle #7) — same as every other AI/ML
  PRD in this document set.
- Fraud/anomaly detection names the specific threshold crossed, same
  explainability rule as Restaurant OS PRD 17.

## Edge Cases & Failure States

Shares the same failure-mode discipline as Restaurant OS PRD 14/17 and
Hotel PRD 08: a briefing generated before a branch's day-end figures are
final must wait for or be triggered by the actual close event, never a
fixed wall-clock trigger against incomplete data; a stockout-risk day
should consolidate alerts rather than flooding a manager with one per
SKU, mirroring Restaurant OS PRD 17's explicit stockout-alert-tiering
rule even though master plan section 9 doesn't restate that specific
consolidation rule for retail — it's the same underlying alert-fatigue
concern and should be handled the same way.

## Data Model

`DATA_MODEL.md` Later Retail OS reporting tables are not yet itemized
distinctly — Retail OS's reporting/ML layer would reuse Restaurant OS's
Reporting And Intelligence group pattern (`daily_location_metrics`-style
aggregates, `forecast_runs`, `predictions`, `recommendation_events`,
`anomaly_events`, `ai_briefings`) with a retail context, following the
same reuse-not-reinvent principle as this PRD's CRM section. Flagged as
a schema decision for whoever implements this PRD: extend the existing
tables with a vertical discriminator, or create parallel retail-specific
tables — not decided here.

## Events Emitted

- `RetailCustomerIdentified`, `RetailBenchmarkComputed`,
  `RetailReportViewed` — same pattern as Restaurant OS PRD 13/14's
  equivalents.
- `RetailBriefingGenerated`, `RetailAnomalyDetected`,
  `RetailStockoutRiskDetected` — same pattern as Restaurant OS PRD 17's
  equivalents, retail-specific triggers.

## API Surface

- `GET /retail/dashboards/owner`, `GET /retail/dashboards/inventory`,
  `GET /retail/dashboards/customer`, `GET /retail/dashboards/operations`
- `GET /retail/reports/*` (sales/inventory/customer/finance/staff,
  filterable)
- Internal AI endpoints mirroring Restaurant OS PRD 17's
  `services/ai-ml` integration shape.

## Offline Behavior

Not offline-capable, same as Restaurant OS PRD 14 and Hotel PRD 08 —
server-side aggregated data.

## Acceptance Criteria

- Every report in the Reports list reconciles exactly against its
  source events.
- Daily retail briefing runs on schedule and produces a factually
  correct summary, spot-checked against the same day's reports, matching
  Restaurant OS PRD 17's 7-consecutive-day validation bar.
- Fraud/anomaly alerts always name the specific threshold crossed.

## Non-Goals

- Cross-tenant retail benchmarking — would follow Restaurant OS PRD
  14's minimum-10-tenant pattern if built, not yet specified for Retail
  OS.
- Recommendation-engine model architecture detail — flagged as an
  implementation decision (collaborative filtering, association rules,
  or a learned model) for whoever builds this PRD, not prescribed here.
