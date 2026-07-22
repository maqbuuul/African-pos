# PRD 14: Reports & BI Dashboards

## Scope

Owns turning the operational event stream (every prior PRD's "Events
Emitted") into role-specific reports and dashboards, plus the anonymized
peer-benchmarking system. Corresponds to master plan Module 11
(Reporting), Module 12 (BI Dashboards), section 7's full Restaurant
Reports list and Competitive Benchmarking, and section 30 (BI Dashboard
Design System). Does not own the AI-generated recommendations/narratives
layered on top of these numbers (PRD 17) — this module supplies correct,
fast, well-designed numbers; PRD 17 explains them.

## Dependencies

Every operational PRD (00–13) — this module is a consumer of their
events, not a peer. PRD 00 (Multi-Tenancy) for the benchmarking peer-group
boundary (city/category/price-tier, never cross-tenant raw data).

## User Stories

- As an **owner**, I need one dashboard showing live revenue, profit
  estimate, branch comparison, peer benchmark, and alerts — everything
  I actually check daily, in one place.
- As a **branch manager**, I need to see shift sales, staff on duty,
  open orders, kitchen delays, stock alerts, and cash drawer status —
  the operational exceptions I need to act on right now, not a static
  history report.
- As a **chef**, I need average prep time, delayed tickets, and station
  load — kitchen-specific, not buried in a general sales report.
- As an **owner**, I need to know if my food cost or table turnover is
  actually good or bad *relative to similar restaurants*, not just as an
  isolated number with no context.
- As an **accountant**, I need cash and M-Pesa reconciliation and a tax
  summary that ties out exactly against the underlying payment ledger.

## Workflows

### Report data pipeline

```text
Every module's domain events (OrderClosed, PaymentConfirmed,
StockMovementRecorded, ShiftClosed, etc.) land in the operational
Postgres database as they occur
  -> Per ADR 0001 decision 7: reports read directly from Postgres while
     data volume is small; a Postgres outbox -> ClickHouse -> dbt path
     is introduced only once Postgres analytics queries genuinely
     struggle -- this PRD's dashboards must be built against a query
     layer that can migrate from one to the other without the
     dashboards themselves changing (i.e., query a defined set of
     report views/materialized aggregates, not ad hoc joins scattered
     across dashboard code)
```

### Role-specific dashboards (master plan section 7's exact groupings)

```text
Owner dashboard: live revenue, profit estimate, branch performance,
  peer benchmark comparison, alerts, forecasts (PRD 17), recommendations
  (PRD 17)
Manager dashboard: shift sales, staff on duty, open orders, kitchen
  delays, stock alerts, cash drawer status
Kitchen dashboard: tickets by station, average prep time, delayed
  tickets, items 86'ed, station load
Customer dashboard: retention, loyalty activity, customer segments,
  win-back list, feedback trends

Each dashboard queries only what that role needs (master plan section 20's
Product Design Rule: "narrow workspace... do not give everyone one giant
admin dashboard") -- these are four distinct views, not one dashboard
with role-based hiding of sections.
```

### Anonymized peer benchmarking

```text
Scheduled aggregation job groups locations by (city, restaurant category,
price tier)
  -> Peer group must contain >= 10 merchants before ANY benchmark is
     shown for that group -- hard floor, not configurable down, per
     master plan section 7's explicit privacy threshold
  -> Aggregates computed: average ticket, table turnover, revenue per
     seat, food cost percentage, dessert/beverage attach rate (launch
     metric set)
  -> A location's own figure is compared against the peer aggregate and
     surfaced with POSITIVE framing only ("15% below peer average on
     dessert attach rate" as an opportunity, never a named ranked
     scoreboard) -- this framing rule is enforced in the dashboard
     copy/design layer, not just a suggestion
  -> No named competitor, no cross-tenant raw data exposure, ever --
     the aggregation boundary is the hard privacy guarantee this feature
     depends on for trust
```

### Report generation for scheduled delivery

```text
This module supplies the exact data PRD 09's scheduled WhatsApp
reports and PDF generation pipeline render -- there is one computation
per report type, consumed by both the on-screen dashboard and PRD 09's
delivery pipeline, never two separately-maintained calculations that
could silently drift apart
```

## Screens & UI Behavior

Full visual/interaction spec lives in master plan section 30 (BI
Dashboard Design System) and the Frontend Design System volume (this
backlog's Volume 6, pending) — this PRD states the information
architecture, not pixel-level design:

- **Owner dashboard** (owner-web): executive-level, glanceable, leads
  with alerts and the day's headline numbers, not a wall of charts.
- **Manager dashboard** (manager-web): operational-now focus — what
  needs action in the next hour, not historical trend analysis.
- **Kitchen dashboard** (kds-web, secondary view alongside the ticket
  screens): station load and delay visibility for whoever's running
  expo.
- **Customer dashboard** (owner-web/manager-web): retention/loyalty
  view, feeds directly from PRD 13.
- Every chart/number follows master plan section 30's design system —
  this PRD doesn't redefine chart conventions, it defines what data each
  screen needs.

## Permissions

Reports group per master plan section 22: `reports:view_sales`,
`reports:view_profit`, `reports:view_staff`, `reports:view_audit`,
`reports:export`.

| Dashboard/report | owner | branch_manager | supervisor | staff |
| --- | --- | --- | --- | --- |
| Owner dashboard (profit, peer benchmark) | Yes | No | No | No |
| Manager dashboard | Yes | Yes (own location) | Yes (own location) | No |
| Kitchen dashboard | Yes | Yes | Yes | Chef: yes |
| Staff-level reports (sales/voids/discounts by staff) | Yes | Yes (own location) | Limited | No |
| Export any report | Yes | Yes (own location) | No | No |

## Business Rules

- **Every number shown must be traceable to the underlying ledger** —
  cash reconciliation must tie out exactly to `payments`/`refunds`
  (PRD 07), food cost % must derive from actual recipe/ingredient cost
  data (PRD 12), not an estimate the dashboard invents independently.
  If a report can't be reconstructed from source events, that's a bug in
  the report, not an acceptable approximation.
- Peer benchmarking's 10-merchant floor is a hard privacy rule, not a
  UX nicety — this module must refuse to render a benchmark below that
  floor rather than showing a low-confidence one with a caveat.
- Real-time shift P&L (PRD 08) and this module's reporting must use the
  identical revenue/cost computation — there is exactly one definition
  of "today's revenue" across the whole platform, referenced everywhere
  it's shown (dashboard, WhatsApp `SALES` reply, PDF report).
- Reports never expose one tenant's raw data to another under any
  framing, including benchmarking — aggregation happens server-side,
  behind the same RLS/tenant-isolation boundary as every other query
  (PRD 00).

## Edge Cases & Failure States

- A location's peer group has fewer than 10 members (small city, niche
  category): benchmarking section is hidden entirely for that metric,
  with an honest "not enough peer data yet" state — never a fabricated
  or under-floor benchmark.
- Dashboard queried during a large backfill/sync catch-up (e.g. right
  after a long offline period, PRD 11): figures should indicate they may
  be incomplete/updating, not silently show a partial number as final.
- Report figure disagreement between two views (e.g. owner dashboard
  revenue vs. a manager's shift report) due to timing/timezone edge
  cases: both must use the location's local timezone (PRD 00) and the
  same "day boundary" definition consistently — a day starts and ends
  at the same wall-clock point regardless of which screen is asking.

## Data Model

Reads across nearly every table group in `DATA_MODEL.md`, plus its own
Reporting And Intelligence group's materialized aggregates
(`daily_location_metrics`, `product_sales_metrics`,
`staff_performance_metrics`, `report_snapshots`) — dashboards query these
aggregate tables, never raw operational tables directly, which is what
lets the ClickHouse migration (ADR 0001 decision 7, Stage 2) swap the
aggregation backend without changing dashboard queries.

## Events Emitted

This module is primarily a consumer, not a producer, but does emit:

- `BenchmarkComputed` — consumed by: owner dashboard, PRD 17 (AI daily
  briefing input), PRD 09 (if benchmark insights are included in
  scheduled reports).
- `ReportViewed` — consumed by: product analytics (which reports/
  dashboards are actually used — feeds the "adoption" tracking
  `ENGINEERING_CHARTER.md`'s document backlog notes is a SaaS-analytics
  concern, distinct from this module's tenant-facing reports).

## API Surface

- `GET /dashboards/owner`, `GET /dashboards/manager`,
  `GET /dashboards/kitchen`, `GET /dashboards/customer`
- `GET /reports/sales`, `GET /reports/inventory`, `GET /reports/staff`,
  `GET /reports/customer`, `GET /reports/finance` (each filterable by
  date range, location)
- `GET /benchmarks/:metric`
- `POST /reports/:type/export`

## Offline Behavior

Dashboards require connectivity — they query aggregated server-side
data, not something meaningfully cacheable/computable on a single
offline POS device. A manager's device may show a "last synced" snapshot
of recent dashboard data if previously loaded, clearly timestamped as
stale, but this module does not attempt full offline dashboard
functionality (unlike the POS/KDS/order modules it draws from).

## Acceptance Criteria

- Cash reconciliation report ties out to the cent against the shift's
  actual payment/refund records (shared acceptance bar with PRD 08).
- A benchmark is never shown for a peer group below 10 merchants,
  verified by testing a synthetic small peer group.
- The revenue figure shown on the owner dashboard, the manager's shift
  report, and a WhatsApp `SALES` reply (PRD 09) are identical for the
  same point in time, verified by comparing all three for one test
  shift.

## Non-Goals

- AI-generated narrative explanations ("why did revenue drop") and
  forecasting — PRD 17.
- Product-usage/SaaS analytics about how tenants use the platform itself
  — a different concern (`ENGINEERING_CHARTER.md`'s document backlog),
  not this tenant-facing reporting PRD.
