# PRD 09: Receipts & Notifications

## Scope

Owns receipt generation/delivery and the operational/customer
notification pipeline across WhatsApp, SMS, email, push, and in-app
channels, including the two-way WhatsApp command interface. Corresponds
to master plan Module 4 (Notifications), Module 18 (compliance-driven
receipt requirements), and section 31 (Automated Reporting And WhatsApp
Command Interface), plus `DATA_MODEL.md`'s `receipts` table. Does not own
report *content* (PRD 14 owns what a report says; this module owns
delivering it).

## Dependencies

PRD 05/07 (Order/Payment completion triggers receipts). PRD 08 (shift
close triggers the `SALES` report). Master plan Module 18 for
country-specific fiscal receipt requirements (e.g. KRA eTIMS).

## User Stories

- As a **customer**, I need a digital receipt (WhatsApp, SMS, or email —
  my choice) the moment I pay, without waiting for a manual send.
- As an **owner**, I need my daily sales report to just arrive on
  WhatsApp 30 minutes after close, without logging into a dashboard.
- As an **owner**, I need to reply `SALES` or `STOCK` to any automated
  message and get a real, current answer — not a static FAQ bot.
- As a **manager**, I need urgent operational alerts (cash variance,
  stockout risk, branch offline) to arrive immediately, not bundled into
  a digest I might not read for hours.
- As a **customer**, I need a `STOP` reply to actually and immediately
  stop all automated messages to my number, no exceptions.

## Workflows

### Receipt delivery

```text
Bill reaches status=paid (PRD 07: PaymentConfirmed, or all payments for
a bill confirmed)
  -> Receipt generated from the bill's final state (items, prices,
     tax breakdown, payment method(s), tips)
  -> If location's country requires fiscal compliance (e.g. Kenya KRA
     eTIMS, Module 18): fiscal submission happens as part of this flow,
     queued through the same operation log as any other offline-capable
     write if offline (BUILD_WORKFLOW.md P9 note: "a Kenya tenant never
     loses a tax submission to a dropped connection")
  -> Receipt delivered via customer's chosen/known channel: WhatsApp
     first-preference (per section 31's ~98% open rate rationale), SMS
     or email fallback, printed receipt if the location has a printer
     and the customer has no digital channel on file
  -> receipts row records delivery status per attempt (sent, delivered,
     failed) -- not a fire-and-forget assumption of success
```

### Scheduled reporting

```text
Cadence exactly as master plan section 31:
  - Real-time: event-triggered only (stockout risk, anomaly, negative
    review) -- never batched into a digest
  - Daily: 30 minutes after location's close-of-business
  - Weekly: Sunday 7 PM
  - Monthly: 1st of the month

Scheduled job (BullMQ, per ADR 0001) triggers report generation
  -> Report data pulled from the same source PRD 14's dashboards use
     (never a separately-computed number that could drift)
  -> PDF rendered via headless-Chrome pipeline from that same data
  -> Delivered via WhatsApp Business API (Module 16 integration) with
     SMS/email fallback
  -> Delivery attempt and status logged (retry via BullMQ on failure,
     never silently dropped)
```

### Two-way WhatsApp commands

```text
Inbound WhatsApp message received via webhook
  -> Sender's phone number authenticated against a staff/owner record
     -> Unrecognized number: generic reply only, no business data ever
        returned to an unauthenticated number
  -> Recognized number: message parsed against the command set (SALES,
     STOCK, STAFF, VOID, ORDER, QUERY <text>, OK, STOP, HELP)
  -> SALES/STOCK/STAFF/VOID: queries PRD 14's live report data, formats
     a WhatsApp-appropriate concise reply
  -> ORDER <ref>: looks up the named order's current status (PRD 05)
  -> QUERY <free text>: routed to the AI natural-language-query feature
     (PRD 17), answered in the merchant's language (Module 18)
  -> OK: acknowledges/dismisses the most recent alert sent to this number
  -> STOP: immediately sets notification opt-out for this number --
     honored before any other processing, no exceptions, no delay
  -> HELP: lists available commands
  -> Every inbound command is logged (who, what, when) for support/audit
     visibility, distinct from the operational audit_logs table (this is
     notification-delivery telemetry, not a business-action audit trail)
```

### Operational alerts

```text
A triggering event fires (examples from master plan Module 4): low
stock, branch offline, cash variance, large refund, kitchen delay,
stockout predicted, high-churn customer
  -> Alert generated immediately, routed to the relevant role
     (manager for cash variance, owner for high-value events) via their
     preferred channel
  -> Quiet hours respected for non-urgent alerts (a manager doesn't get
     woken up for a low-stock notice at 2 AM); genuinely urgent alerts
     (e.g. cash variance beyond a high threshold) can be configured to
     override quiet hours
  -> Escalation rule: an unacknowledged critical alert re-sends or
     escalates to a secondary recipient after a configurable window
```

## Screens & UI Behavior

- **Notification preferences** (owner-web, manager-web, and a
  customer-facing preference link included in every message footer):
  channel selection per notification type, quiet hours, escalation
  contacts.
- **Delivery status view** (admin-web): per-message delivery status,
  retry history — support-facing, for diagnosing "customer says they
  never got their receipt."
- **Report/receipt preview**: what's about to be sent is previewable
  before a manual resend, using the exact same rendering pipeline as the
  automated send (no separate "preview mode" that could look different
  from the real thing).

## Permissions

| Action | owner | branch_manager | cashier |
| --- | --- | --- | --- |
| Configure notification preferences (org/location level) | Yes | Own location | No |
| Manually resend a receipt | Yes | Yes | Yes (own transactions) |
| View delivery status/logs | Yes | Yes (own location) | No |
| Receive scheduled reports | Yes | Yes (location-scoped) | No |

## Business Rules

- `STOP` is honored immediately and unconditionally — this is a
  regulatory/trust requirement (opt-out compliance, master plan Module
  4), not a preference the system can delay or require confirmation for.
- WhatsApp is the default/preferred channel specifically because of its
  open-rate advantage in the target market (section 31) — SMS/email are
  fallbacks, not equal alternatives chosen at random.
- A scheduled report and its on-demand WhatsApp-command equivalent
  (`SALES` reply vs. the daily digest) must read from the identical data
  source — there is exactly one "today's sales" computation, not one for
  dashboards and a different one for WhatsApp replies.
- Fiscal receipt submission (where required by Module 18) is treated as
  a sync-tracked operation with the same reliability guarantees as any
  other offline-capable write — a tax submission is not allowed to be
  fire-and-forget.
- An unauthenticated WhatsApp sender never receives business data under
  any command, including `QUERY` — the authentication check happens
  before command parsing, not per-command.

## Edge Cases & Failure States

- WhatsApp delivery fails (customer's number invalid, API outage):
  BullMQ retry with backoff; after exhausting retries, falls back to
  SMS if a number is available, logged either way — never silently
  dropped.
- A customer replies `SALES` (a staff-only command) from a number that
  happens to also be a customer contact but not a staff/owner record:
  rejected with the generic unauthenticated reply — the authentication
  check is per-number-to-record, not per-phone-format.
- Report generation runs before the day's numbers are actually final
  (e.g. a shift closes late): the 30-minutes-after-close trigger is
  per-location and keyed to that location's actual close event (PRD 08's
  `ShiftClosed`), not a fixed wall-clock time — this avoids sending a
  materially incomplete daily report.
- Duplicate inbound webhook delivery (WhatsApp provider retry): command
  processing is idempotent per inbound message ID, so a retried `STOP`
  or `SALES` doesn't double-process.

## Data Model

`DATA_MODEL.md` Payments And Cash: `receipts`. `DATA_MODEL.md`
Notifications: `notification_preferences`, `whatsapp_command_log`.

## Events Emitted

- `ReceiptGenerated` / `ReceiptDelivered` / `ReceiptDeliveryFailed` —
  consumed by: product analytics, support/admin delivery-status view.
- `ScheduledReportSent` — consumed by: product analytics (report
  open/engagement, if trackable via WhatsApp read receipts).
- `NotificationOptedOut` — consumed by: every module that might send
  this number a message, immediately.

## API Surface

- `POST /receipts/:bill_id/send` (manual resend/redirect)
- `GET /receipts/:id/status`
- `POST /webhooks/whatsapp` (inbound command handling)
- `POST /notifications/preferences`, `GET /notifications/preferences`
- Internal (not public): scheduled-report trigger, invoked by BullMQ, not
  a client-callable endpoint.

## Offline Behavior

Receipt *generation* can be queued offline (the bill data needed to
generate it is already local); actual *delivery* requires connectivity
by definition — a WhatsApp/SMS/email cannot send offline. Fiscal
submissions queue through the operation log exactly like any other
offline-capable write and deliver on reconnect, per Module 18's explicit
requirement.

## Acceptance Criteria

- A customer receives a digital receipt within seconds of payment
  confirmation when online; when the transaction happened offline, the
  receipt sends automatically on the device's next successful sync,
  without staff needing to manually trigger it.
- A `SALES` WhatsApp reply from an authenticated owner/manager number
  returns the current day's actual sales total, matching the equivalent
  dashboard figure exactly.
- A `STOP` reply results in zero further messages to that number,
  verified by attempting to trigger both a scheduled report and an
  operational alert to it afterward.

## Non-Goals

- Marketing campaign messaging content/targeting logic (PRD 13 CRM &
  Loyalty owns campaign strategy; this module is the delivery
  mechanism only).
- The AI natural-language-query answer-generation logic itself (PRD 17
  — this module only routes `QUERY` commands to it and delivers the
  response).
