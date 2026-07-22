# PRD 17: AI/ML Service

## Scope

Owns forecasting, anomaly detection, menu engineering intelligence, the
daily/pre-shift briefing, natural-language query, and the task-specific
AI agents that turn PRD 14's correct numbers into explanations and
recommendations. Runs in `services/ai-ml` (Python + FastAPI, ADR 0001).
Corresponds to master plan section 7 Restaurant AI Features, section 14
(AI And ML Model Catalog), and `BUILD_WORKFLOW.md` P17. Does not own the
underlying report data (PRD 14 supplies correct numbers) or its delivery
(PRD 09 sends the briefing) — this module's entire job is turning
correct numbers into correct, useful explanations.

## Dependencies

Requires enough real transactional volume from PRD 05/07/12/13 to train
or meaningfully baseline models — per `BUILD_WORKFLOW.md`, can start on
seed/synthetic data but gates to production use only on real data. PRD
14 (Reports & BI) is the data source for everything this module explains.
PRD 09 delivers this module's output.

## User Stories

- As an **owner**, I need a morning briefing that tells me what
  happened, why, and what to do about it — not a dashboard I have to
  interpret myself.
- As a **branch manager**, I need a pre-shift briefing highlighting
  anything unusual before service starts, not after.
- As an **owner**, I need to ask "why did revenue drop yesterday" in
  plain language (English or my local language) and get a real,
  data-grounded answer.
- As a **stock controller**, I need a stockout warning that tells me
  specifically what to reorder and by when — consolidated, not one alert
  per at-risk item flooding my phone.
- As an **owner**, I need staff coaching notes that are specific and
  actionable per underperforming staff member, not just a flagged
  metric with no explanation.

## Workflows

### Daily/pre-shift briefing generation

```text
Scheduled job (30 min after location close, per PRD 09's cadence for
daily; a separate pre-shift-timed trigger for the manager briefing)
  -> Pulls the day's actual figures from PRD 14 (never recomputes them
     independently -- this module explains PRD 14's numbers, it does not
     maintain a second, potentially divergent calculation)
  -> Task-specific agents run: promotions, pricing, scheduling, waste
     reduction, staff coaching, daily digest -- each owns one narrow job
     and produces structured output, per master plan section 7's
     explicit "specialized agents, not one general assistant" design
  -> Daily digest agent composes the final briefing (example format,
     master plan section 7): headline number + delta, driving factors,
     2-3 concrete recommended actions -- never an unstructured wall of
     text
  -> Delivered via PRD 09
```

### Natural-language query

```text
Owner asks a question (WhatsApp QUERY command via PRD 09, or an
in-app query box) in English or a supported local language (Module 18)
  -> Query routed to this service, grounded against PRD 14's actual
     report data (retrieval over the tenant's own business data, never
     a general-knowledge answer that isn't traceable to real numbers)
  -> Answer generated in the same language the question was asked in
  -> Every factual claim in the answer must be traceable to a specific
     PRD 14 report/metric -- this module never fabricates a number
```

### Forecasting

```text
Revenue/demand forecasting models trained on historical order data
(PRD 05/12), with Africa-specific feature engineering per
BUILD_WORKFLOW.md P17: days_after_payday, is_school_term,
is_rainy_season, local market-day flags, Ramadan/Iftar calendar effects
-- not just day-of-week/holiday/weather
  -> Locations with under 14 days of history fall back to a simple
     moving average -- the model never pretends confidence it doesn't
     have on a cold-started location
```

### Anomaly detection

```text
Continuous evaluation against explicit, named thresholds (BUILD_WORKFLOW.md
P17, not a black-box "something seems off"):
  - Sales drop >= 40% vs. same weekday's 4-week average
  - Food cost spike >= 8% above baseline
  - Staff void rate >= 3x location average, or >5% of that staff
    member's own revenue
  - Cash variance over a configured amount
  - Transaction >= 5x the location's average order value
  -> Every anomaly alert names the specific threshold crossed -- this is
     a hard requirement, not a nice-to-have, because an unexplained
     "anomaly detected" alert trains users to ignore the feature
```

### Stockout prediction

```text
Demand forecast + current stock_levels (PRD 12) -> per-item stockout
risk
  -> Output is TIERED (Critical/Warning/Planned/Watch), consolidated to
     a maximum of 3 stock alerts per merchant per day -- never one
     notification per at-risk item, which would train users to mute
     the channel entirely
```

### Waste / prep-hold intelligence

```text
Predicts sell-through of a prepped batch pre-service (e.g. how much of
today's prepped rice will actually sell) and recommends a hold-back
quantity -- feeds PRD 12's wastage-reduction goal directly
```

### Supplier invoice OCR

```text
Photo of a paper supplier invoice submitted (mobile/web upload)
  -> OCR extracts line items and prices
  -> Flags any price that changed versus the same supplier's last
     invoice (cross-referenced against PRD 12's goods_receipts price
     history) -- surfaces supplier price inflation the moment it appears
     on paper, not weeks later in an aggregate report
```

### Competitive benchmarking model

```text
Computes percentile rank of a location against its anonymized peer
group (PRD 14's >= 10-tenant floor, strictly inherited, never
recomputed with a lower bar here) on average ticket, table turnover,
revenue per seat, food cost %, and attach rate
  -> Feeds the owner dashboard and this module's own daily briefing
```

## Screens & UI Behavior

This module has no dedicated screens of its own — its output renders
inside PRD 14's owner/manager dashboards (forecasts, recommendations
sections) and PRD 09's delivery channels (briefing messages, `QUERY`
command replies). Its only implementation-facing surface is
`services/ai-ml`'s internal API, consumed by `apps/api`.

## Permissions

AI output visibility follows the same role scoping as the report it's
explaining — a staff coaching note about a specific waiter is
manager/owner-visible, not shown to that waiter's peers; a branch-level
briefing is scoped to that branch's manager, not visible across
locations they don't manage. No separate permission model — this module
inherits PRD 14's and PRD 01's scoping rather than defining its own.

## Business Rules

- **Every factual claim this module produces must be traceable to a
  specific underlying metric from PRD 14.** No hallucinated numbers,
  ever — this is the hardest, most important rule in this PRD, because
  the entire value proposition (master plan's "AI Copilot") depends on
  owners trusting what it says.
- Anomaly and stockout alerts are threshold-named and volume-capped
  (per the concrete numbers in Workflows above) — alert fatigue is
  treated as a real product failure mode, not an acceptable side effect
  of being thorough.
- Agents are task-specific, not general-purpose — a promotions agent
  doesn't also do staff scheduling. This keeps each agent's output
  narrow, reviewable, and easier to validate against real outcomes.
- A model's confidence is stated honestly — a location with insufficient
  history gets a simple moving average and, implicitly, lower-confidence
  output, never a model pretending precision it can't back up.
- Locale-aware output: natural-language query answers in the language
  the question was asked in (Module 18) — this is a hard requirement for
  the target market, not a nice-to-have localization detail.

## Edge Cases & Failure States

- Daily briefing generation runs before P14's report data has fully
  finalized for the day (e.g. a shift closed unusually late): briefing
  generation must wait for or be triggered by the actual `ShiftClosed`/
  end-of-day event (PRD 08/09's pattern), never a fixed wall-clock
  trigger that could fire against materially incomplete data.
- Natural-language query asked about data the requesting user doesn't
  have permission to see (e.g. a supervisor asking about org-wide
  profit): answer is scoped/refused per PRD 01's permission model, not
  answered in full because the AI layer has technical access to the
  underlying data.
- OCR misreads a supplier invoice: extracted data is presented for human
  confirmation before it updates any real record (PRD 12's goods
  receipt) — OCR output is a draft, never auto-applied.
- Anomaly detected during a genuinely unusual but explainable event
  (e.g. a public holiday spike): per `BUILD_WORKFLOW.md`'s Africa-specific
  feature engineering, holiday/calendar effects are inputs to the
  baseline itself, reducing false positives, but a manager-visible
  "mark as expected" dismissal must exist for whatever the model still
  gets wrong — dismissal feedback should improve the model's baseline
  over time, not just silence one alert.

## Data Model

`DATA_MODEL.md` Reporting And Intelligence group: `forecast_runs`,
`predictions`, `recommendation_events`, `anomaly_events`, `ai_briefings`
— each stores model version and source metrics per that section's
modeling principle #7, satisfying this PRD's "every factual claim
traceable" rule at the schema level, not just as a stated intention.

## Events Emitted

- `BriefingGenerated` — consumed by: PRD 09 (delivery).
- `AnomalyDetected` (with named threshold) — consumed by: notification
  module (Module 4), PRD 14 (owner dashboard alert).
- `StockoutRiskDetected` (tiered) — consumed by: PRD 09/notification,
  PRD 12 (suggested-reorder workflow it can now make smarter than the
  simple trend-based default described in PRD 12).
- `SupplierPriceChangeDetected` — consumed by: PRD 12 (supplier
  scorecarding), notification.

## API Surface

- Internal to `apps/api` ↔ `services/ai-ml` (not directly public):
  `POST /ai/briefings/generate`, `POST /ai/query`,
  `GET /ai/forecasts/:location_id`, `POST /ai/ocr/invoice`
- Public-facing exposure (if any, e.g. via PRD 19's developer platform)
  is a later, explicit decision — not assumed by this PRD.

## Offline Behavior

Not offline-capable — this is a server-side service consuming
aggregated data, with no meaningful on-device operation. A device
offline simply means its data hasn't yet contributed to that day's
briefing until it syncs (PRD 11); the briefing generation itself always
requires connectivity to `services/ai-ml`.

## Acceptance Criteria

Exactly `BUILD_WORKFLOW.md` P17's gate: daily briefing generation runs
on a schedule and produces a factually correct summary (spot-checked
against the same day's PRD 14 reports) for at least 7 consecutive days
before being shown to a real owner. A stockout-risk day produces at most
3 consolidated alerts, never one per item; an anomaly alert always names
the threshold it crossed.

## Non-Goals

- Autonomous action (auto-sending marketing campaigns, auto-approving
  purchase orders) — every agent's output in this PRD is a
  recommendation surfaced to a human, never an autonomous execution,
  consistent with master plan Product Rule 9 ("AI should explain,
  recommend, and automate, but never hide the source data").
- General-purpose conversational AI unrelated to the tenant's own
  business data.
