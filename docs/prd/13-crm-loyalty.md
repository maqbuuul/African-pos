# PRD 13: CRM & Loyalty

## Scope

Owns the unified customer identity, loyalty program, gift cards, credit
tabs, and review/sentiment ingestion. Corresponds to master plan section
7 Restaurant CRM Features, Module 5 (CRM And Customer Intelligence), and
`DATA_MODEL.md` CRM group (`customers`, `customer_identities`,
`customer_tags`, `loyalty_accounts`, `loyalty_events`, `gift_cards`,
`customer_credit_accounts`). Does not own marketing campaign delivery
mechanics (PRD 09 owns the channel/delivery; this module owns who to
target and why).

## Dependencies

PRD 05 (Order Engine) — order history attaches to customer identity. PRD
07 (Payments) — gift card/credit tab redemption is a payment method. PRD
09 (Receipts & Notifications) — delivery mechanism for loyalty/marketing
messages. PRD 10 (QR Ordering) — join-loyalty and dish-rating capture
points.

## User Stories

- As a **returning customer**, I need the restaurant to recognize me by
  phone number across every channel (POS, QR, WhatsApp, delivery), so I
  don't have to re-explain my order history or allergy notes every time.
- As an **owner**, I need loyalty points/tiers to work automatically at
  checkout, without a cashier needing to remember to ask or manually
  apply anything.
- As a **regular customer**, I need to run a credit tab and settle it
  periodically, the way I would with a trusted local business.
- As an **owner**, I need to know immediately when a new negative review
  lands anywhere (Google, delivery apps, in-app rating), not discover it
  a week later in a report.
- As a **branch manager**, I need a win-back list of customers who
  haven't returned in N days, so I can target them before they're gone
  for good.

## Workflows

### Customer identity resolution

```text
A touchpoint occurs with identifying information (phone number entered
at POS, QR-ordering loyalty join, WhatsApp order, delivery-platform
order with a phone number, reservation)
  -> System looks up customer_identities by the identifying value
     (phone, email, WhatsApp ID, delivery-platform customer ID)
  -> Match found: touchpoint attaches to the existing customers row
  -> No match: new customers row created, this identity attached as its
     first customer_identities entry
  -> Staff can manually merge two customer profiles later discovered to
     be the same person (e.g. customer used two phone numbers) --
     merge preserves all notes/history from both, with author and
     timestamp retained (master plan section 27's customer-merge rule:
     "preserve all notes with author and timestamp")
```

### Loyalty accrual and redemption

```text
Order closes / bill paid (PRD 05/07)
  -> If customer identity is attached to the order: loyalty_accounts
     looked up (or created on first qualifying purchase)
  -> loyalty_events row created (append-only points ledger, never a
     direct balance overwrite): points earned, based on the location's
     configured earn rule (e.g. 1 point per currency unit spent)
  -> loyalty_accounts.tier reevaluated if the earn crosses a tier
     threshold
Redemption: customer/staff applies points at checkout
  -> System checks loyalty_accounts balance (derived from summing
     loyalty_events, exactly like stock_levels derives from
     stock_movements) -> sufficient balance required
  -> loyalty_events row created: type=redemption, negative points value
  -> Redeemed value applied as a discount/payment component on the bill
     (PRD 05/07)
```

### Gift cards

```text
Gift card sold (its own transaction, or issued as a promotion)
  -> gift_cards row created: balance = purchased/issued amount
Gift card redeemed at checkout
  -> Treated as a payment method (PRD 07): balance checked, deducted
     (append-only balance-change events, not direct overwrite -- same
     pattern as loyalty points), remaining balance shown on receipt
```

### Credit tabs

```text
Customer opens a credit tab (requires a location-configured credit limit
and, for new/unknown customers, likely a manager approval -- PRD 01
pattern, "credit limit increase" is on the approval-required list)
  -> customer_credit_accounts tracks running balance
  -> Charges accrue via normal order/payment flow, method=customer_credit
  -> Settlement: customer pays down the balance (partial or full),
     recorded as its own event, never as a silent balance edit
```

### Review and sentiment monitoring

```text
Scheduled/webhook-driven ingestion from Google Reviews, delivery-platform
reviews (Module 16 integration), and in-app QR-ordering dish ratings
(PRD 10)
  -> Each review/rating stored, linked to the location and, where
     resolvable, a specific order/dish
  -> Sentiment scored (simple rule-based initially; PRD 17 can later
     replace with a proper model)
  -> New negative review (below a configured sentiment/star threshold)
     -> immediate manager alert (Module 4's real-time-only alert
        cadence, per section 31 -- never batched into a digest)
  -> Trending complaint detection: repeated similar negative themes
     within a short window surfaces as its own alert, not just
     individually-logged reviews
```

### Win-back campaigns

```text
Scheduled job identifies customers with no order in > N days
  (configurable, tiered by the customer's historical visit frequency --
  a weekly regular going quiet for 10 days is a stronger signal than a
  once-a-year visitor)
  -> Generates a win-back candidate list, surfaced to the owner/manager
     for review (not auto-sent by default, though auto-send can be
     configured for locations that want it)
  -> Sending itself delegates to PRD 09's notification pipeline
```

## Screens & UI Behavior

- **Customer profile** (POS lookup, manager-web, owner-web): identity,
  order history, favorite items (derived from order history, not
  manually maintained), allergies/notes/tags, loyalty balance/tier,
  credit balance if applicable.
- **POS customer lookup**: fast phone-number search at checkout,
  surfaces allergy/note flags prominently (a documented allergy must be
  visible to whoever's taking the order, not buried in a profile tab).
- **Loyalty/gift card management** (owner-web): program configuration
  (earn rate, tiers, redemption rules), gift card issuance and balance
  lookup.
- **Reputation dashboard** (owner-web): aggregated review/rating trend,
  recent reviews inline, trending-complaint alerts.
- **Win-back list** (manager-web): candidate customers, last-visit date,
  historical spend, one-tap trigger to send a win-back offer via PRD 09.

## Permissions

| Action | cashier/waiter | branch_manager | owner |
| --- | --- | --- | --- |
| Look up customer, view profile | Yes | Yes | Yes |
| Add notes/tags | Yes | Yes | Yes |
| Apply loyalty redemption | Yes | Yes | Yes |
| Open/increase a credit limit | No (approval-gated) | Yes | Yes |
| Configure loyalty program rules | No | No | Yes |
| Merge duplicate customer profiles | No | Yes | Yes |

## Business Rules

- Customer identity resolution is **phone-first** (master plan section
  27's conflict policy: "Merge by phone") — phone number is the primary
  matching key across channels in this market, ahead of email.
- Loyalty points and gift card balances are **derived from an append-only
  event ledger**, never a directly-editable balance column — identical
  discipline to `stock_levels`/`stock_movements` and cash-drawer
  expected-amount. This is non-negotiable per `ENGINEERING_CHARTER.md`'s
  ledger rule.
- Merging two customer profiles preserves every note/tag/order-history
  reference from both, with original authorship/timestamps intact — a
  merge is a relationship correction, never a data-loss event.
- A negative review/rating triggers a real-time alert, never a batched
  one — this is explicitly called out in master plan section 31's report
  cadence rules and repeated here because it's easy to accidentally
  implement as "just another item in the daily digest."
- Allergy/dietary notes attached to a customer profile must surface at
  every order-entry point (POS, QR, phone) where that customer is
  identified — this is a safety-relevant business rule, not a nice-to-
  have CRM feature.

## Edge Cases & Failure States

- Same phone number used by two different real people (shared family
  phone, common in this market): system doesn't force a false merge —
  staff can maintain them as separate profiles manually tagged, with
  phone-based auto-matching treated as a suggestion staff can override,
  not an unconditional rule.
- Loyalty redemption requested for more points than the current balance
  (e.g. two devices redeeming from the same account near-simultaneously
  while briefly offline): second redemption attempt fails against the
  authoritative ledger on sync — the UI must surface this as
  "insufficient balance, please resolve," not silently allow a negative
  balance.
- Gift card redeemed for more than its remaining balance: partial
  redemption applied (up to balance), remainder must be covered by
  another payment method — never allowed to go negative.
- Review ingestion receives a duplicate webhook delivery for the same
  review: deduplicated by the source platform's review ID, not
  re-alerted/re-counted.

## Data Model

`DATA_MODEL.md` CRM group, in full.

## Events Emitted

- `CustomerIdentified` / `CustomerProfilesMerged` — consumed by: PRD 05
  (order attribution), product analytics.
- `LoyaltyPointsEarned` / `LoyaltyPointsRedeemed` / `LoyaltyTierChanged`
  — consumed by: PRD 09 (tier-change/points-update customer messages,
  Module 4), PRD 14 (loyalty program performance reporting).
- `GiftCardIssued` / `GiftCardRedeemed` — consumed by: PRD 14 (gift card
  liability reporting).
- `NegativeReviewDetected` / `TrendingComplaintDetected` — consumed by:
  notification module (immediate manager alert), PRD 14.
- `WinBackCandidateListGenerated` — consumed by: PRD 09 (campaign
  delivery), product analytics.

## API Surface

- `GET /customers`, `GET /customers/:id`, `PATCH /customers/:id`,
  `POST /customers/merge`
- `POST /loyalty/accounts/:id/redeem`, `GET /loyalty/accounts/:id`
- `POST /gift-cards`, `GET /gift-cards/:code`,
  `POST /gift-cards/:code/redeem`
- `POST /customer-credit-accounts/:id/charge`,
  `POST /customer-credit-accounts/:id/settle`
- `GET /reviews`, `POST /webhooks/reviews/:source`

## Offline Behavior

Customer lookup by phone works offline if the customer has previously
synced to this device's local cache (recent/frequent customers,
PowerSync-scoped). Loyalty accrual/redemption and gift card/credit
transactions queue via the operation log (PRD 11) like any other
payment-adjacent write; balance checks against a possibly-stale offline
cache mean an offline redemption could theoretically exceed the true
current balance — this reconciles as a conflict on sync (server-side
balance is authoritative) rather than being prevented client-side with
certainty, an accepted tradeoff of offline-first operation.

## Acceptance Criteria

- A customer identified by phone at checkout has their prior order
  history, allergy notes, and loyalty balance visible to staff within
  the POS lookup, matching what the server actually holds.
- Loyalty balance is always reconstructable by summing `loyalty_events`
  from zero, verified by an automated replay test.
- A new negative review triggers a manager alert within the real-time
  cadence (not the next scheduled digest), verified end-to-end from a
  simulated webhook.

## Non-Goals

- Customer-facing loyalty wallet UI (a dedicated screen/app for
  customers to view their own points/tier) — master plan lists this
  under customer-facing products, not this backend-CRM PRD.
- RFM segmentation, CLV prediction, and churn modeling — PRD 17 (AI/ML)
  owns the modeling; this PRD supplies the clean event data those models
  need.
