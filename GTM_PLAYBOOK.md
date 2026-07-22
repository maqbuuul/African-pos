# Go-To-Market Playbook

## Scope and Status

Owns channel strategy, onboarding/activation execution, sales motion,
and customer success process — the go-to-market layer master plan
section 3 (Platform Strategy, Year 1–5 Focus) states as phases but
doesn't operationalize, and section 29 (Pricing And Monetization) prices
but doesn't sell. This document is that missing execution layer.

**Honesty about status:** unlike the engineering documents in this
repo, almost nothing here can be verified against running code or a real
user yet. Rather than one blanket disclaimer, every section below is
tagged with its actual confidence level so a reader doesn't have to
guess which parts are load-bearing and which are a starting guess:

- **[Fixed]** — stated as decided in `HOSPITALITY_OS_MASTER_PLAN.md`
  sections 3/29/32 (or elsewhere in this repo's existing docs). Treat as
  a constraint to build execution around, not something this playbook
  gets to revise.
- **[Grounded]** — a direct, low-inference execution consequence of a
  [Fixed] decision (e.g. "the free Starter tier implies a self-serve
  motion" follows almost mechanically from section 29's pricing). High
  confidence, but still worth re-checking once real conversion data
  exists.
- **[Hypothesis]** — a genuine guess about what will work (channel
  prioritization, health-score weighting, specific thresholds). Expect
  to be wrong about some of these; the point of instrumenting from day
  one (Metrics and RevOps, below) is to find out which ones fast.

Every specific number pulled from the master plan (CAC target, ARPU
range, onboarding time target) was checked against master plan section
29/32's actual text while writing this, not recalled from memory —
listed again here only where directly relevant to an execution decision.

## Beachhead Strategy `[Fixed market/phases, Hypothesis target segment]`

Per master plan section 3's Year 1 Focus: **Nairobi restaurants, cafes,
bars, bakeries, fast food, and cloud kitchens.** Win this narrowly before
expanding — not "East African restaurants" broadly, one city and one
category cluster deeply, so early support/onboarding effort compounds
into repeatable playbooks instead of getting spread across
too many contexts to learn from any of them.

```text
Phase 1 — Beachhead (Year 1, master plan section 3)
  Nairobi, restaurants/cafes/bars/bakeries/fast food/cloud kitchens
  Goal: repeatable onboarding, case studies, product-market fit signal

Phase 2 — Expansion (Year 2, master plan section 3)
  Add hotel/hospitality workflows, additional Kenyan cities

Phase 3 — Regional (Year 3+, master plan section 3)
  Add Hotel OS, Retail OS, expand beyond Kenya per Module 18's
  per-country compliance rollout (each new country gated on having a
  working tax adapter, not just translated UI)
```

Target segment within the beachhead, prioritized by fastest time-to-value
and most acute pain: independent single-location operators currently
using pen-and-paper or a generic (non-Africa-native) POS — this is where
the "offline-first, mobile-money-native, WhatsApp-fluent" positioning
(README.md, master plan section 1) is least contestable by an incumbent.

## Onboarding & Activation `[Fixed targets, Grounded checklist, Hypothesis support-assist call]`

Execution detail for master plan section 32's stated targets (3-step
registration, template-menu onboarding, 10-minute time-to-first-order,
WhatsApp staff invitation) — those targets are fixed; this section is
the checklist and instrumentation around hitting them.

### Activation Checklist

The moment a signup is "activated" (not just registered) is defined by
completing every step below — each step is independently trackable so a
drop-off point is identifiable, not just the end-to-end conversion rate:

```text
□ Account created (organization + first business + first location)
□ Template menu loaded or first product added
□ First staff PIN set
□ First table/counter configured (dine-in) or skip (counter-only)
□ First staff member invited via WhatsApp (if multi-staff)
□ First order placed
□ First payment taken (cash or mobile money)
□ First shift closed
```

An owner who reaches "first shift closed" within their first week is the
activation bar — this is the cohort retention analysis (below) should be
built around, not raw signups.

### Support-Assisted Onboarding (Beachhead Phase Only) `[Hypothesis]`

Per master plan section 3's "win one use case deeply": in the Nairobi
beachhead phase, white-glove onboarding (a real person helping load the
first menu, set up the first location) is worth the unit-economics cost
that section 29's CAC target (`<$50/location`) would otherwise forbid at
scale — the beachhead's job is learning what onboarding friction
actually looks like, which a support-assisted flow surfaces faster than
a fully self-serve one would. Transition to pure self-serve PLG once the
template-menu/onboarding flow (master plan section 32) has been
validated against enough real onboardings to trust it unassisted.

## Growth Channels `[Hypothesis — the whole section]`

Prioritized for a beachhead-phase, low-CAC-budget motion — not a
blended, always-on channel mix:

1. **Referrals.** The highest-trust, lowest-CAC channel in a market
   where restaurant owners know each other locally (same supplier
   networks, same business associations). Reward existing merchants for
   successful introductions — mechanics (credit vs. cash vs. subscription
   discount) are a pricing-team decision against section 29's unit
   economics, not fixed here.
2. **Local partnerships.** Payment providers (M-Pesa agents, mobile money
   aggregators), accounting firms serving small businesses, restaurant
   equipment/hardware suppliers (natural bundling with the section 29
   hardware-kit strategy), and local business associations.
3. **WhatsApp and direct outbound.** Matches the channel this market
   actually uses (README.md's WhatsApp-fluent positioning) — direct
   outreach to identified target-segment businesses, not cold email.
4. **Content/SEO**, in local languages and framed around real operator
   problems ("food cost calculation Kenya," "restaurant WhatsApp
   ordering setup") rather than generic POS-category content — this
   compounds slowly and is a Phase 2+ investment, not a beachhead-phase
   priority given the CAC-per-signup economics of organic content take
   months to pay back.
5. **Industry events and associations** — Kenyan restaurant/hospitality
   trade groups, relevant only once there's a case-study story worth
   telling (don't lead with this before Phase 1 has produced one).

Explicitly **not** prioritized in the beachhead phase: paid social/search
ads (CAC too uncertain against section 29's targets before there's
conversion-rate data to model against) and enterprise outbound sales
(the beachhead segment doesn't need or want a sales-assisted motion).

## Sales Motion `[Grounded]`

**Product-led by default.** The Starter tier is free specifically to
remove a sales conversation from the acquisition path (master plan
section 29) — self-serve signup, template-menu onboarding, and the
activation checklist above should get a single-location owner to their
first shift close with zero human intervention once the beachhead's
support-assisted phase is done.

**Sales-assisted only where the tier requires it**: Enterprise tier
(custom pricing, franchise/multi-location, dedicated SLA — section 29)
genuinely needs a conversation, since franchise royalty-engine
configuration and multi-location rollout aren't self-serve-appropriate.
This is the only segment where a traditional sales motion (discovery
call, pilot, contract) applies; it is not the default motion for Starter/
Business/Pro.

## Customer Success & Retention `[Hypothesis — specific signals/weights/thresholds; Grounded — that health should be computed from existing events at all]`

### Customer Health Score

A composite score per organization, computed from signals this
platform's own event stream (`docs/architecture/event-catalog.md`)
already produces — not a new data source, a new read of existing
events:

| Signal | Source event(s) | Weight direction |
| --- | --- | --- |
| Daily active usage (orders placed) | `OrderClosed` frequency | Positive |
| Feature adoption breadth (inventory, CRM, loyalty enabled and used) | Module-specific creation events | Positive |
| Payment method connected | `PaymentIntentCreated` presence | Positive |
| Support/failure signals | `PaymentFailed`, `SyncConflictDetected` frequency | Negative |
| Days since last login/order | Absence of recent `OrderOpened` | Negative |

A dropping health score triggers a customer-success touchpoint (a
WhatsApp check-in, per this market's channel preference) before churn,
not after — this is the same "explain, recommend" philosophy master plan
Product Rule 9 applies to the tenant-facing AI copilot, applied
internally to the platform's own retention operations.

### Retention Playbook Triggers

```text
Health score drops below threshold -> WhatsApp check-in from support
No order in > 7 days (single-location, previously active) -> automated
  "need help?" message, escalates to human outreach if unanswered
Failed payment method -> proactive prompt to reconnect, not a silent
  feature degradation
Support ticket volume spike from one org -> flagged for a success call,
  not just ticket-by-ticket resolution
```

## Metrics and RevOps `[Grounded]`

Standard SaaS funnel, instrumented from day one so channel and
onboarding decisions above can actually be evaluated against data rather
than argued from intuition indefinitely:

- **Acquisition**: signups by channel, cost per signup (once paid
  channels are introduced).
- **Activation**: percentage completing the activation checklist above
  within 7 days, broken down by which step is the most common drop-off.
- **Engagement**: daily/weekly active locations (an `OrderClosed` event
  in the period), stickiness (DAU/MAU).
- **Retention**: 30/90-day logo retention, cohorted by signup month and
  by whether onboarding was support-assisted or self-serve (this is the
  specific comparison that validates or invalidates the beachhead
  support-assistance bet above).
- **Revenue**: MRR, ARPU against the section 29 target ($35–80/month
  post-Starter), tier-upgrade rate.
- **Referral**: percentage of new signups attributable to an existing
  merchant referral — the leading indicator for whether the
  lowest-CAC channel is actually working.

This funnel is distinct from PRD 14's tenant-facing reporting (which
tells a *merchant* about their own restaurant) — this is the platform
operator's own product/business analytics, consuming the same
event-catalog but for a different audience and purpose, matching the
distinction `ENGINEERING_CHARTER.md`'s document backlog already draws
between tenant-facing reports and SaaS-side product analytics.

## Non-Goals

- Specific referral-reward amounts, ad budgets, or partnership contract
  terms — business decisions made against real unit-economics data as
  it comes in, not fixed here.
- Enterprise sales collateral/pitch decks — not needed until the
  Enterprise tier has a real prospect pipeline.
- International (non-Kenya) GTM detail — out of scope until Module 18's
  per-country compliance rollout actually reaches a second country.
