# Retail PRD 04: Returns & Exchanges

## Scope

Owns the return/exchange/refund workflow for retail sales. Corresponds
to master plan section 9 (Retail POS Features: returns/exchanges/
refunds) and section 25 (return state machine, Returns And Exchanges
workflow). Reuses Restaurant OS PRD 07's refund/payment-reversal
mechanics rather than reimplementing them.

**Status note:** see Retail PRD 01 — Year 3+ priority. Build phase:
**R4**, see `BUILD_WORKFLOW_RETAIL.md`.

## Dependencies

Retail PRD 01 (returns link back to the original sale), Retail PRD 02
(returned stock movements).

## User Stories

- As a **cashier**, I need to look up a customer's original receipt to
  process a return quickly, not rebuild the transaction from memory.
- As a **customer**, I need to choose refund, exchange, or store credit
  — not be forced into whichever the cashier defaults to.
- As a **store manager**, I need return approval gated when eligibility
  is unclear (no receipt, past the return window), not silently allowed
  or silently blocked.
- As an **owner**, I need damaged returns routed to quarantine stock,
  not silently added back to sellable inventory.

## Workflows

### Return state machine

Exactly master plan section 25: `requested → approved / rejected →
refunded / exchanged / store_credit_issued`.

### Return workflow

Exactly master plan section 25:

```text
Cashier searches receipt (by receipt number, phone, or card-last-4 --
  same lookup flexibility as Restaurant OS PRD 07's payment
  reconciliation)
Cashier selects the item(s) being returned
System checks return eligibility (return window, item condition
  requirements, whether the item is on the non-returnable list)
Manager approval requested if required (no receipt, past window, or
  above a value threshold -- same approval-request pattern as
  Restaurant OS PRD 01)
Customer chooses refund, exchange, or store credit
System records the return
Stock movement created (Retail PRD 02: type=return, or routed to
  quarantine if damaged -- see Business Rules)
Payment/refund ledger updated (Restaurant OS PRD 07's refund mechanics,
  reused directly)
Receipt issued for the return transaction itself
```

### Exchange

```text
Customer wants a different size/color/item, not a refund
  -> Original item returned (stock movement: return)
  -> New item added to a new sale, linked to the return as an exchange
     pair
  -> Price difference (if any) settles via the normal payment flow --
     additional payment if the new item costs more, a refund/store
     credit for the difference if it costs less
```

### Store credit

```text
Customer opts for store credit instead of cash/card refund
  -> store_credit_issued -- creates a liability record (Retail PRD 07's
     "store credit liability" reporting), append-only, exactly like
     Restaurant OS's loyalty/gift-card balance discipline
  -> Redeemable as a payment method on a future sale (Retail PRD 01),
     following the same balance-derived-from-ledger rule as Restaurant
     OS PRD 13's gift cards
```

## Screens & UI Behavior

- **Return/exchange screen**: receipt lookup first, then item selection
  from that receipt, then disposition choice (refund/exchange/credit) —
  linear flow matching the state machine, not a free-form form.
- **Manager approval prompt**: appears inline when eligibility is
  unclear, with the specific reason shown (no receipt / past window /
  above threshold), not a generic "needs approval."

## Permissions

| Action | cashier | store_manager |
| --- | --- | --- |
| Process a standard return (in window, with receipt) | Yes | Yes |
| Process a no-receipt or past-window return | No (approval-gated) | Yes |
| Approve returns above value threshold | No | Yes |
| Issue store credit | Yes | Yes |

## Business Rules

- **Returned item must link to the original sale when possible** —
  master plan section 25's explicit rule. A returnable-without-receipt
  path exists (store credit at current price, typically, per common
  retail policy) but is distinctly approval-gated, never treated as
  equivalent to a receipted return.
- **Refund cannot exceed the original paid amount** — hard constraint,
  checked against the actual `payments` record for the original sale,
  never against the item's current listed price (which may have
  changed since purchase).
- **Store credit creates a liability** — tracked exactly like Restaurant
  OS PRD 13's gift card liability, append-only, reconstructable from its
  own event ledger.
- **Damaged returns can go to quarantine stock** — master plan section
  25's explicit rule. A damaged item is never silently returned to
  sellable `stock_levels`; it requires an explicit inspection/write-off
  decision before it could ever be resold.
- **Return reason is required** — same reason-required discipline as
  every other Restaurant OS destructive/adjustment action
  (`ENGINEERING_CHARTER.md`), applied here.

## Edge Cases & Failure States

- Return requested for an item that was part of a bundle/kit sale
  (Retail PRD 02): the return must correctly decompose back to the
  constituent variant(s) being returned, not treat the whole bundle as
  an atomic non-returnable unit unless the location's policy says so
  explicitly.
- Exchange where the new item is out of stock: the exchange cannot
  silently complete against negative stock — cashier is shown the
  actual available alternatives, or the original return proceeds as a
  refund/credit instead.
- Customer disputes the original sale exists (system shows no matching
  receipt, customer insists they bought it): routed to manager review
  as a no-receipt return, never fabricated into a matching record.
- Store credit redeemed for more than its balance: partial redemption up
  to balance, remainder covered by another payment method — identical
  rule to Restaurant OS PRD 13's gift card over-redemption handling.

## Data Model

`DATA_MODEL.md` Later Retail OS: `returns`, `exchanges`. Reuses
Restaurant OS's `refunds` ledger pattern and would extend
`customer_credit_accounts`-style liability tracking for store credit
(exact table TBD — could reuse Restaurant OS's gift-card/credit-account
tables with a retail context, or a dedicated `store_credit_accounts`
table; not decided here, flagged for whoever implements this PRD).

## Events Emitted

- `ReturnRequested` / `ReturnApproved` / `ReturnRejected` — consumed by:
  Retail PRD 02 (stock movement/quarantine), Retail PRD 07 (return
  reporting).
- `ExchangeCompleted` — consumed by: Retail PRD 01 (new sale linkage),
  Retail PRD 07.
- `StoreCreditIssued` / `StoreCreditRedeemed` — consumed by: Retail PRD
  07 (liability reporting).

## API Surface

- `GET /retail/sales/:id/return-eligibility`
- `POST /retail/returns`, `PATCH /retail/returns/:id` (approve/reject)
- `POST /retail/exchanges`
- `POST /retail/store-credit/:id/redeem`

## Offline Behavior

Follows the same offline-first posture as Retail PRD 01 for the parts
that are frontline-critical (a cashier processing a return at the
counter); refund confirmation for non-cash methods requires online
connectivity, identical constraint to Restaurant OS PRD 07.

## Acceptance Criteria

Exactly master plan section 25's rules, verified: a return links to its
original sale when a receipt is found; a refund never exceeds the
original paid amount; a damaged return routes to quarantine, not
sellable stock; every return has a recorded reason.

## Non-Goals

- Warranty/repair workflows (distinct from a standard return) — covered
  under Retail Extended Sales Models' job-card pattern if a retailer
  needs it, not this PRD.
- Cross-store returns (returning to a different store than purchased)
  policy detail — a location-configuration decision, not specified here
  beyond noting the receipt lookup itself is tenant-wide, not
  location-locked.
