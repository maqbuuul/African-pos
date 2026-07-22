# Data Platform

## Scope

Owns the path from operational event to analytics-ready data and, from
there, to PRD 17's ML models — the pipeline underneath PRD 14 (Reports &
BI) and PRD 17 (AI/ML Service). `ADR 0001` decision 7 already made the
core technology calls (Python/FastAPI for serving, Postgres outbox →
ClickHouse, dbt for transforms, Airflow/lakehouse formats deferred) —
this volume is the pipeline architecture and event-modeling discipline
built on those calls, not a re-decision of them.

## Pipeline Architecture

```text
Operational writes (every PRD 00-19's domain events)
        |
Postgres transactional outbox (ADR 0001 decision 5 -- the same outbox
  that powers PRD 19's webhooks is the same outbox that feeds analytics;
  one event-emission mechanism, two consumers, never two separate event
  systems)
        |
        +-- Internal listeners (KDS, notifications, other modules)
        +-- Webhook fan-out (PRD 19, external subscribers)
        +-- Analytics ingestion (this document's concern)
        |
Stage 1: Postgres-native analytics (current, per ADR 0001 decision 7)
  -- PRD 14's dashboards query Postgres directly, via defined report
     views/materialized aggregates (PRD 14's own stated requirement),
     never ad hoc joins scattered across dashboard code
        |
Stage 2 (introduced only once Postgres analytics queries genuinely
  struggle -- ADR 0001's rollout-sequencing discipline, not a fixed
  timeline):
ClickHouse (OLAP, event/time-series optimized)
        |
dbt (transforms, same models whether reading from Postgres or
  ClickHouse -- the migration from Stage 1 to Stage 2 should be able to
  reuse dbt model logic, not rewrite it)
        |
        +-- PRD 14's dashboards (now backed by ClickHouse instead of
            Postgres directly, same report-view contract)
        +-- PRD 17's model training/feature inputs
        +-- Reverse ETL (see below)
```

## Event Catalog Discipline

Every domain event referenced across PRD 00–19's "Events Emitted"
sections is, collectively, this platform's canonical event catalog —
`ENGINEERING_CHARTER.md`'s document backlog flags a formal "Canonical
Event Catalog" document (payload schemas, consumer registry) as a
natural future addition once the event list stabilizes past active
development; until then, each PRD's own section is the source of truth
for that module's events, and this document's job is the *discipline*
those events must follow platform-wide:

- Every event name is `PastTenseVerb` form (`OrderCreated`,
  `PaymentConfirmed`, `StockAdjustmentApproved`) — consistent naming
  makes both the webhook catalog (PRD 19) and the analytics ingestion
  layer predictable to build against.
- Every event payload includes `organization_id` and, where applicable,
  `location_id` — analytics ingestion must never need a secondary lookup
  to determine tenant scope; this is also what keeps ClickHouse queries
  correctly tenant-partitioned once Stage 2 is introduced.
- Events are facts about something that already happened, never commands
  — `OrderClosed` is an event; there is no `CloseOrder` event, only the
  `CloseOrder` command (master plan section 26) that, on success,
  produces the `OrderClosed` event.

## Feature Store Considerations (for PRD 17)

- Model features (e.g. `days_after_payday`, `is_school_term`, cook-time-
  per-item-per-station, customer RFM segments) are computed via dbt
  models reading from the same analytics layer PRD 14 uses — there is
  one definition of "this week's average order value," used identically
  by a dashboard and a forecasting model's input feature. Two
  independently-computed versions of the same figure is the specific
  failure mode this shared-model discipline prevents.
- A dedicated feature store (Feast or similar, floated in the original
  planning material) is explicitly deferred — per ADR 0001's sequencing
  discipline, dbt models materialized in the analytics layer serve
  PRD 17's feature needs until real model-serving latency or
  feature-reuse-across-many-models complexity justifies a dedicated
  layer. Revisit as an ADR when that pressure is real, not before.
- Every model output is stored with model version and source metrics
  (`DATA_MODEL.md` modeling principle #7, PRD 17's own rule) — this is
  what makes a forecast or anomaly alert auditable after the fact ("why
  did the model say this") rather than a black box.

## Reverse ETL

Per the original planning material's "push insights back into
operations" pattern, formalized here as: any dbt model or PRD 17 output
that should trigger an operational action (a suggested purchase order
draft — PRD 12; a win-back candidate list — PRD 13; a manager alert —
Module 4) writes back through the **same module commands** every other
write path uses (master plan section 26's Module Boundary Rule, applied
to the analytics layer exactly as PRD 15/16/19 apply it to external
integrations). The analytics/ML layer never writes directly to
operational tables — it calls `CreatePurchaseOrder`, not an `INSERT INTO
purchase_orders`.

## Data Retention & Governance

- Operational Postgres retains full history indefinitely by default
  (never-delete principle, `ENGINEERING_CHARTER.md`) — retention/archival
  settings (master plan Module 1's `tenant_setting`) can move old data
  to cheaper storage for cost reasons, but archived data remains
  queryable, never purged, short of an explicit legal requirement.
- Benchmarking aggregation (PRD 14) is the only path by which any data
  crosses a tenant boundary, and only as anonymized, >=10-tenant
  aggregates — the data platform's ingestion and transform layers never
  create a code path capable of a cross-tenant raw-data query, by
  construction (enforced by the same RLS boundary as every other query,
  not by developer discipline alone).
- Customer-identifying data (PRD 13) flowing into the analytics layer
  follows the same privacy posture as the operational system — this
  platform does not create a "looser" analytics copy of customer data
  outside the access-control boundaries the operational system enforces.

## Non-Goals

- Airflow, Spark, or a Bronze/Silver/Gold lakehouse — explicitly
  deferred per ADR 0001 decision 7, not rejected forever; revisit only
  once real data volume and pipeline complexity justify the operational
  overhead.
- A general-purpose, cross-tenant data science sandbox — any model
  development happens against a specific tenant's data under that
  tenant's own access boundary, or against properly anonymized benchmark
  aggregates; there is no "give a data scientist raw access to
  everything" mode, ever.
