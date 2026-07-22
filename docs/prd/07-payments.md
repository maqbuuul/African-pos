# PRD 07: Payments

## Scope

Owns collecting payment against a bill: cash, mobile money, card, split
payments, tips. Corresponds to master plan section 7 Restaurant Payments
and Module 6 (Payments Integration Layer), and `DATA_MODEL.md`
(`payment_intents`, `payments`, `refunds`, `tips`). Does not own the bill
itself (PRD 05) or cash drawer reconciliation (PRD 08) — this module
takes a bill from `bill_requested`/`payment_pending` to `paid` and hands
off to those.

## Dependencies

PRD 05 (Order Engine) — payments are always against a `bill`. PRD 01
(Auth) — permission-gated actions (refund, split, cancel). Master plan
Module 18 (Africa Market Compliance) for country-specific payment
provider availability and tax/receipt implications.

## User Stories

- As a **cashier**, I need to take a cash payment and complete the sale
  instantly, fully offline, because connectivity has nothing to do with
  someone handing me physical cash.
- As a **customer**, I need to pay my share of a split bill via M-Pesa
  from my own phone using a link sent to me, without handing my phone to
  the waiter or the waiter needing my card.
- As a **cashier**, I need mobile money and card payments to wait for
  real provider confirmation before marking a bill paid, because a
  premature "paid" on an unconfirmed mobile money payment is a real
  financial loss.
- As a **manager**, I need to process a refund against a specific
  original payment, with a reason, and have it never touch or hide the
  original payment record.
- As an **owner**, I need every payment method reconciled against actual
  provider settlement, so "what we think we made" and "what actually
  landed in the bank" don't silently drift apart.

## Workflows

### Cash payment (offline-capable)

```text
Cashier selects "cash" on a bill -> enters amount tendered
  -> System calculates change
  -> payment created: method=cash, status=confirmed, provider=none,
     paid_at=now() -- no external confirmation needed, this can
     complete fully offline
  -> bill.status -> paid; if all bills for the order are paid,
     order.status -> closed (PRD 05)
  -> Cash drawer session's expected-cash total updated (PRD 08)
```

### Mobile money payment (M-Pesa / Airtel Money / etc.)

```text
Cashier selects mobile money provider, enters customer phone (or
customer initiates from their own device via a payment link)
  -> payment_intent created: status=pending, provider, amount,
     idempotency_key generated (prevents duplicate STK push on retry)
  -> System calls provider API (STK push or equivalent) via the
     integration adapter (packages/integrations, ChannelAdapter pattern)
  -> Bill stays in payment_pending -- UI shows "waiting for customer to
     confirm on their phone," not a spinner with no explanation
  -> Provider webhook/callback confirms payment
     -> payment created: status=confirmed, provider_reference stored
     -> bill.status -> paid
  -> Provider callback reports failure/timeout
     -> payment_intent.status -> failed, cashier notified, can retry or
        switch payment method
  -> If device is offline when the callback would arrive: this payment
     cannot complete offline by design (master plan section 27: "mobile
     money requires provider confirmation unless explicitly marked
     external") -- bill remains payment_pending until connectivity
     returns and the callback is processed
```

### Card payment

```text
Same intent/confirmation shape as mobile money, via a card processor
adapter -- requires online connectivity unless the specific terminal
hardware supports offline authorization (rare, not assumed by default)
```

### Split payment (multiple methods on one bill)

```text
Bill total: split across cash + mobile money (e.g. partial cash, rest
via M-Pesa)
  -> Each method's payment is its own payment record, all referencing
     the same bill_id
  -> bill.status -> paid only when sum(confirmed payments) >= bill total
  -> Overpayment (rare, e.g. rounding) is tracked, not silently absorbed
     -- shown to cashier as change due or credited to customer per
        location policy
```

### Split-check payment link per seat

```text
Bill split by seat (PRD 05) generates N sub-bills
  -> For each sub-bill, system can generate a payment link (WhatsApp/SMS,
     Module 4 Notifications) unique to that sub-bill
  -> Each guest opens their own link, pays via their own phone (mobile
     money or card), independent of the others
  -> Each link's payment follows the normal mobile money/card confirmation
     flow above, scoped to its own sub-bill
```

### Refund

```text
Manager selects a specific original payment -> initiates refund
  -> Permission check: payments:refund (often approval-gated, PRD 01)
  -> Reason required (PRD 02)
  -> refund record created, referencing the original payment_id --
     the original payment row is never modified or deleted (master
     plan: "Refund ledger. Never deletes original payment.")
  -> If original method supports reversal (mobile money, card): refund
     is pushed through the same provider adapter
  -> If cash: refund is a cash-out event, reconciled at shift close
     (PRD 08)
```

### Tips

```text
Tip captured at payment time (cash: entered amount above bill total, or
explicit tip field; mobile money/card: explicit tip step before final
confirmation)
  -> tip record created, linked to payment and to the serving staff
     member (for tip-pooling/individual reporting, PRD 14)
  -> Tips are never merged into the bill total for tax purposes --
     tracked as their own line, per country tax rules (Module 18)
```

## Screens & UI Behavior

- **Payment screen**: method selector (cash/mobile money/card/split),
  amount, change calculation for cash. Must remain usable and clear while
  a mobile money payment is pending — an explicit waiting state, with a
  visible timeout and manual "check status" retry, not just a spinner.
- **Split payment builder**: shows remaining balance as each method is
  applied, prevents confirming until the balance is fully covered (or
  explicitly marks it short with manager approval, for edge cases like
  customer credit — PRD 13).
- **Refund screen** (manager-only): searches/selects the original
  payment, shows its full context (order, amount, date), reason field,
  confirm.

## Permissions

Payments group per master plan section 22: `payments:take_cash`,
`payments:take_mobile_money`, `payments:take_card`, `payments:split`,
`payments:refund`, `payments:cancel`, `payments:reconcile`.

| Action | cashier | supervisor | branch_manager |
| --- | --- | --- | --- |
| Take any payment method | Yes | Yes | Yes |
| Split payment | Yes | Yes | Yes |
| Refund | No (approval-gated) | Yes (threshold-limited) | Yes |
| Cancel a pending payment intent | Yes (own) | Yes | Yes |
| Reconcile payments vs. provider settlement | No | No | Yes / accountant |

## Business Rules

- **Idempotency is mandatory, not optional**, on every payment-initiating
  request — a retried mobile money request (e.g. due to a flaky
  connection) must use the same `idempotency_key` and never trigger a
  second STK push or double-charge.
- Cash is the only method that can complete fully offline. This is a
  deliberate, explicit exception, not an oversight — every other method
  requires a provider confirmation this platform cannot fabricate.
- Refunds never modify or delete the original `payments` row — they are
  always a new `refunds` row referencing it. Financial history must be
  reconstructable from the full ledger, never from a mutated single row.
- A bill is `paid` only when confirmed (not pending) payments sum to at
  least its total. A bill cannot be marked paid by a pending/unconfirmed
  intent, regardless of UI pressure to "just mark it done."
- Every payment carries `provider_reference` when applicable — this is
  the join key for later reconciliation against actual provider
  settlement reports (PRD 14/18), and its absence on a supposedly
  confirmed mobile-money/card payment is itself a data-integrity bug
  worth alerting on.

## Edge Cases & Failure States

- Mobile money STK push sent, customer never completes it (walks away,
  phone dies): `payment_intent` times out to `failed` after a configured
  window; cashier is notified and can retry or switch method — the bill
  is never left silently stuck.
- Provider webhook arrives twice for the same payment (provider-side
  retry): idempotency key on the webhook processing itself prevents a
  duplicate `payments` row.
- Refund requested for a payment where the provider-side reversal fails
  (e.g. mobile money reversal window expired): refund record still
  created (financial intent is recorded), but flagged `requires_manual_
  settlement` — the platform doesn't pretend a failed reversal succeeded.
- Split-check link payment arrives after the table has already been
  fully settled by a different method (customer paid late, waiter also
  cashed them out): second payment is detected as an overpayment against
  an already-paid bill and routed to a reconciliation/refund review, not
  silently double-recorded as revenue.

## Data Model

`DATA_MODEL.md` Payments And Cash: `payment_intents`, `payments`,
`refunds`, `tips`.

## Events Emitted

- `PaymentIntentCreated` / `PaymentConfirmed` / `PaymentFailed` —
  consumed by: PRD 05 (bill status), PRD 08 (cash drawer expected-cash
  updates for cash payments), PRD 09 (receipt trigger on confirmation),
  PRD 14 (revenue reporting), PRD 17 (fraud/anomaly detection features).
- `RefundIssued` — consumed by: PRD 02 (audit), PRD 14 (refund
  reporting), PRD 08 (cash-out if cash refund).
- `TipRecorded` — consumed by: PRD 14 (staff tip reporting).

## API Surface

- `POST /bills/:id/payments` (method, amount, provider-specific params)
- `GET /payment-intents/:id` (status polling/webhook-driven)
- `POST /payment-intents/:id/cancel`
- `POST /payments/:id/refund`
- `POST /webhooks/payments/:provider` (provider callback ingestion,
  behind the integration adapter — see master plan section 6's
  `ChannelAdapter` pattern)

## Offline Behavior

Cash payments: fully offline-capable, queued via the operation log (PRD
11) exactly like any other order-engine write. Mobile money/card:
cannot complete offline by design — the bill remains `payment_pending`
until the device is online and the provider confirms. This is stated
explicitly in the UI (not a silent hang) so staff can choose cash instead
if a customer needs to leave.

## Acceptance Criteria

- A cashier can complete a cash sale fully offline with correct change
  calculation, and it reconciles cleanly once reconnected (P11 gate,
  shared with PRD 05).
- A retried mobile money payment request with the same idempotency key
  never produces two provider charges or two `payments` rows, verified
  by deliberately retrying a request against a test provider double.
- A refund is always traceable to its original payment via
  `refunds.payment_id`, and the original payment row is byte-for-byte
  unchanged after the refund, verified by comparing before/after.

## Non-Goals

- Embedded financial services (merchant cash advance, tax-savings
  wallet, Chama/SACCO auto-routing) — master plan section 7 lists these
  as a later partnership-based build, explicitly not owned by this core
  payments PRD's P7 scope.
- Payment provider-specific settlement/reconciliation reporting detail
  — PRD 14/18 own the reporting and hardening side of this.
