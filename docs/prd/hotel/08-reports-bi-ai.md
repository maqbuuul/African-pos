# Hotel PRD 08: Reports, BI Dashboards & AI

## Scope

Owns hotel-specific reporting, role dashboards, ML models, and AI
briefings — the Hotel OS equivalent of Restaurant OS PRD 14 (Reports &
BI) and PRD 17 (AI/ML Service) combined into one PRD, since Hotel OS's
reporting/AI surface area is smaller than Restaurant OS's at this
specification stage. Corresponds to master plan section 8 (Hotel
Reports, Hotel BI Dashboards, Hotel ML Models, Hotel AI Features).

**Status note:** see Hotel PRD 01 — Year 2+ priority. Build phase:
**H9**, see `BUILD_WORKFLOW_HOTEL.md`.

## Dependencies

Every other Hotel PRD (01–07) — this module consumes their events,
exactly as Restaurant OS PRD 14/17 consume PRD 00–13's events.

## User Stories

- As a **general manager**, I need one dashboard showing occupancy, ADR,
  RevPAR, arrivals, departures, guest issues, maintenance issues, and
  forecasts — everything I check every morning.
- As a **receptionist**, I need today's arrivals/departures, room
  readiness, VIP guests, and open balances at a glance at shift start.
- As a **housekeeping manager**, I need my own dashboard — assigned
  rooms, cleaning status, inspection queue, delayed rooms — not the GM's
  view with irrelevant sections hidden.
- As a **revenue manager**, I need occupancy forecasts and rate
  recommendations, not just historical occupancy numbers.
- As a **GM**, I need a daily briefing that tells me what's at risk
  tonight and what to do about it, in plain language.

## Workflows

### Role dashboards (master plan section 8, exact groupings)

```text
GM dashboard: occupancy, ADR, RevPAR, arrivals, departures, guest
  issues, maintenance issues, forecasts
Reception dashboard: today's arrivals, today's departures, rooms ready,
  rooms not ready, VIP guests, open balances
Housekeeping dashboard: assigned rooms, cleaning status, inspection
  queue, delayed rooms, maintenance blockers
Revenue dashboard: occupancy forecast, ADR trend, RevPAR trend, channel
  performance, pricing recommendations
```

Each dashboard is a distinct view built from the events every other
Hotel PRD emits — not one dashboard with role-based section hiding,
matching the same "narrow workspace per role" discipline master plan
section 20 establishes for Restaurant OS and this document set applies
consistently across verticals.

### Reports (master plan section 8, in full)

```text
Revenue: occupancy, ADR, RevPAR, revenue by room type, revenue by
  channel, revenue by package, upsell revenue
Operations: arrivals, departures, stayovers, no-shows, cancellations,
  room status, housekeeping productivity, maintenance tickets
Guest: guest satisfaction, repeat guests, VIP guests, complaints,
  preferences, guest churn
Finance: deposit report, folio balances, payment reconciliation, tax
  report, corporate account aging, P&L
```

Every figure traces to source events (Hotel PRD 01–07's own event
lists) — same non-negotiable rule as Restaurant OS PRD 14: a report
number that can't be reconstructed from underlying data is a bug, not an
acceptable approximation.

### ML models (master plan section 8, in full)

```text
Occupancy forecasting: inputs (booking pace, seasonality, events,
  holidays, cancellations) -> expected occupancy + confidence range ->
  used by staffing, pricing, owner/GM dashboard

Dynamic pricing: inputs (occupancy forecast, competitor rates if
  available, seasonality, demand) -> suggested rates by room type/date
  -> used by revenue manager (a recommendation, never an
  auto-applied price change, per the same "AI recommends, never hides
  source data" rule as Restaurant OS master plan Product Rule 9)

Guest churn: inputs (stay history, satisfaction, complaints, booking
  frequency) -> churn score + win-back action -> used by marketing
  automation

Upsell recommendation: inputs (guest profile, stay purpose, booking
  type, past spend) -> upsell suggestion -> used by pre-arrival and
  front desk

Housekeeping staffing forecast: inputs (arrivals, departures,
  stayovers, room types, cleaning times) -> housekeepers needed by
  shift -> used by housekeeping scheduling

Maintenance prediction: inputs (asset age, room history, ticket
  patterns) -> risk score + preventive task -> used by maintenance
  manager
```

### AI briefings (master plan section 8, exact example format)

```text
Daily GM briefing composed from the above models plus current occupancy/
  arrivals/room-readiness data -- headline figure, named risks,
  concrete recommended actions, exactly the format shown in master plan
  section 8's example:

"Occupancy tonight is 87% and forecast to reach 95% on Saturday.
Risks: six rooms still waiting for inspection; two VIP guests arrive
before noon; standard rooms nearly sold out.
Recommended actions: prioritize inspection for rooms 204/205/301;
increase Saturday standard rate by 8%; offer suite upgrades to
corporate guests arriving Friday."
```

Reception shift briefing, guest complaint summary, review sentiment
summary, room pricing explanation, maintenance priority explanation,
guest upsell message generation, and natural-language hotel queries
follow the same task-specific-agent pattern as Restaurant OS PRD 17 —
one agent per narrow job, not one general assistant asked to do
everything.

## Screens & UI Behavior

Four role dashboards as listed in Workflows above, built to the same
design system Restaurant OS uses (master plan section 30: Three
Questions Test, One Number Principle, fixed color semantics, first-class
loading/offline states) — this is shared platform design discipline, not
redefined per vertical.

## Permissions

| Dashboard/report | general_manager | front_office_manager | housekeeping_manager | revenue_manager |
| --- | --- | --- | --- | --- |
| GM dashboard | Yes | No | No | No |
| Reception dashboard | Yes | Yes | No | No |
| Housekeeping dashboard | Yes | No | Yes | No |
| Revenue dashboard | Yes | No | No | Yes |
| Finance reports | Yes | No | No | Accountant: yes |

## Business Rules

- Every dashboard and AI briefing figure traces to a named source event
  from Hotel PRD 01–07 — identical discipline to Restaurant OS PRD 14's
  "every number shown must be traceable to the underlying ledger" rule.
- Dynamic pricing and every other ML output is a recommendation surfaced
  to a human (revenue manager, GM), never an autonomously-applied
  change — identical to Restaurant OS PRD 17's non-goal on autonomous
  action.
- Model outputs are stored with model version and source metrics
  (`DATA_MODEL.md` modeling principle #7), same as Restaurant OS PRD 17.

## Edge Cases & Failure States

Shares the same failure-mode discipline as Restaurant OS PRD 14/17:
benchmarking-style comparisons (if introduced for Hotel OS later) would
need the same minimum-peer-group floor; a briefing generation run before
night audit (Hotel PRD 04) completes for the day must wait for or be
triggered by the actual audit-complete event, never a fixed wall-clock
trigger against incomplete data.

## Data Model

Reads across every Hotel OS table group in `DATA_MODEL.md` Later Hotel
OS, plus reuses Restaurant OS's Reporting And Intelligence group pattern
(`forecast_runs`, `predictions`, `recommendation_events`,
`anomaly_events`, `ai_briefings`) — Hotel OS's ML outputs are the same
table shapes with hotel-specific model types, not a parallel schema.

## Events Emitted

- `HotelBenchmarkComputed`, `HotelReportViewed` — same pattern as
  Restaurant OS PRD 14's equivalents.
- `HotelBriefingGenerated`, `HotelAnomalyDetected` — same pattern as
  Restaurant OS PRD 17's equivalents, hotel-specific triggers (e.g.
  occupancy anomaly rather than sales anomaly).

## API Surface

- `GET /hotel/dashboards/gm`, `GET /hotel/dashboards/reception`,
  `GET /hotel/dashboards/housekeeping`, `GET /hotel/dashboards/revenue`
- `GET /hotel/reports/*` (revenue/operations/guest/finance, filterable)
- Internal AI endpoints mirroring Restaurant OS PRD 17's
  `services/ai-ml` integration shape.

## Offline Behavior

Not offline-capable, same as Restaurant OS PRD 14 — server-side
aggregated data, no meaningful on-device offline operation for
dashboards.

## Acceptance Criteria

- Every report in the Reports list above reconciles exactly against its
  source events (e.g. folio balances report ties out to `folio_charges`
  entries).
- Daily GM briefing runs on schedule and produces a factually correct
  summary, spot-checked against the same day's reports, matching
  Restaurant OS PRD 17's 7-consecutive-day validation bar before being
  shown to a real GM.

## Non-Goals

- Competitor rate-shopping data ingestion for dynamic pricing (listed as
  "if available" in the model inputs — not assumed as a guaranteed data
  source).
- Cross-property benchmarking (would follow Restaurant OS PRD 14's
  minimum-10-tenant pattern if built, not yet specified for Hotel OS).
