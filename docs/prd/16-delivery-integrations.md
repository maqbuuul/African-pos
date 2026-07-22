# PRD 16: Delivery Platform Integrations (Uber Eats, Glovo, Bolt Food)

## Scope

Owns ingesting orders from third-party delivery platforms into the
kitchen/order pipeline and pushing status/menu updates back out.
Corresponds to `BUILD_WORKFLOW.md` P16, master plan section 7's Delivery
Intelligence ambitions, and Module 16. Uses the same `ChannelAdapter`
interface as PRD 15 — this PRD owns delivery-specific workflow
(multi-platform order consolidation, commission reconciliation), not the
adapter mechanics themselves.

## Dependencies

PRD 03 (catalog push, availability sync), PRD 05 (order creation), PRD
06 (kitchen routing — delivery orders must route exactly like any other
order), PRD 07 (payment/commission reconciliation).

## User Stories

- As a **kitchen**, I need a Glovo order to arrive as a kitchen ticket
  within seconds, indistinguishable in urgency from a dine-in order.
- As a **manager**, I need one operational view across every connected
  delivery platform, not four separate tablets to watch during a rush.
- As an **owner**, I need to know whether delivery is actually
  profitable per platform, after commission and packaging costs — not
  just gross order volume.
- As a **manager**, I need menu availability changes (86'ing an item) to
  propagate to every connected delivery platform automatically, so a
  customer can't order something we can't make.

## Workflows

### Inbound order

```text
Customer orders on a connected delivery platform
  -> Platform webhook received, signature-verified (Module 16 rule)
  -> Adapter calls PRD 05's standard order-creation command --
     channel=delivery_ubereats / delivery_glovo / delivery_boltfood,
     never a parallel order path
  -> Kitchen ticket generated exactly as any other order (PRD 06) --
     within seconds of receipt, matching BUILD_WORKFLOW.md P16's
     acceptance gate
  -> Order status pushed back to the platform as it progresses:
     accepted -> preparing -> ready for pickup (pushOrderStatus() on the
     adapter) -- the platform's own courier-dispatch logic depends on
     these status pushes arriving promptly
```

### Menu/availability sync

```text
Product availability changes (PRD 03: 86'ing an item, or a scheduled
day-part switch)
  -> Propagates to every connected delivery platform via pushCatalog()/
     availability update, within the same sync interval as commerce
     integrations (PRD 15) -- a customer must never be able to order an
     86'ed item through a delivery platform when they can't through the
     POS
```

### Consolidated operational view

```text
Manager/expo screen (extends PRD 06's KDS/expo view) shows orders from
ALL connected delivery platforms alongside dine-in/QR/counter orders in
one queue, distinguished by channel badge -- this is explicitly the
alternative to "four separate tablets," named directly in the source
planning material as a core value proposition (Delivery Intelligence:
"one operational dashboard")
```

### Commission and profitability reconciliation

```text
Order marked delivered/completed by the platform
  -> Platform's settlement data (commission rate, payout amount) ingested
     via the adapter and reconciled against the platform's own
     settlement report
  -> PRD 14 reporting surfaces per-platform metrics: order volume,
     cancellation rate, commission cost, and -- combined with PRD 12's
     ingredient cost and PRD 08's labor data -- actual delivery margin,
     not just gross revenue
  -> Throttling events during rush windows (a platform temporarily
     pausing new orders due to kitchen capacity) are tracked as their
     own signal, per master plan section 7's "throttling events during
     rush windows" reporting requirement
```

## Screens & UI Behavior

- **Consolidated delivery queue** (extends kds-web/manager-web): every
  platform's active orders in one list, channel-badged, same
  accept/prepare/ready actions regardless of source platform.
- **Delivery performance dashboard** (owner-web, PRD 14): per-platform
  volume, cancellation rate, commission cost, margin.
- **Integration health** (admin-web): shared with PRD 15's error
  dashboard pattern — sync failures, last-successful-sync per platform.

## Permissions

| Action | chef/kitchen staff | branch_manager | owner |
| --- | --- | --- | --- |
| Accept/prepare/mark ready a delivery order | Yes | Yes | Yes |
| Connect/disconnect a delivery platform | No | No | Yes |
| View per-platform profitability | No | Yes | Yes |

## Business Rules

- A delivery order is a first-class order — same order engine, same
  kitchen routing, same audit trail as any other channel. The only
  thing delivery-specific is the inbound/outbound adapter and the
  reporting lens applied afterward.
- Status pushes back to the platform are not optional/best-effort — a
  platform's own courier dispatch depends on timely `preparing`/`ready
  for pickup` signals, so this path gets the same reliability treatment
  (retry queue, Module 16) as inbound order ingestion.
- Commission/payout figures are reconciled against the platform's actual
  settlement report, never assumed from the platform's advertised
  commission rate alone — real settlement can include adjustments,
  promotions the platform funded, or disputes.

## Edge Cases & Failure States

- Platform sends an order for an item that was 86'ed but the
  availability push hadn't yet propagated (race condition): kitchen
  flags it immediately for manager decision (substitute, or reject the
  order through the platform's own cancellation flow) rather than
  silently attempting to cook something unavailable.
- A platform throttles/pauses new orders mid-rush: this is expected,
  tracked behavior (see reporting above), not treated as an integration
  failure.
- Platform reports a cancellation after the kitchen has already started
  preparing: order is voided through PRD 05's normal void flow
  (channel-aware — the loss is attributed to delivery, not treated as a
  POS-originated void for staff-performance reporting purposes).
- Duplicate webhook delivery for the same platform order: idempotency
  keyed on the platform's own order ID, same pattern as PRD 15.

## Data Model

`DATA_MODEL.md` Integrations group, shared with PRD 15:
`integration_connections`, `channel_order_mappings`, `channel_sync_logs`.
No delivery-specific tables beyond what `orders.channel` already
distinguishes.

## Events Emitted

- `DeliveryOrderReceived`, `DeliveryStatusPushed`,
  `DeliveryOrderCancelled` — consumed by: PRD 06 (kitchen routing), PRD
  14 (delivery analytics), admin health dashboard.

## API Surface

- `POST /integrations/delivery/:provider/connect`
- `POST /webhooks/delivery/:provider` (inbound orders, cancellations)
- `POST /orders/:id/push-status` (internal, triggered by order state
  changes, calls the adapter's `pushOrderStatus()`)
- `GET /integrations/delivery/:provider/sync-logs`

## Offline Behavior

Not offline-capable — requires connectivity to both the platform API and
each delivery provider, identical constraint to PRD 15. A location
losing connectivity loses delivery-platform order intake until
reconnected; this is an accepted limitation distinct from the POS's own
offline-first guarantee (PRD 11), which delivery integrations cannot
inherit since the delivery platform itself is an external online-only
system.

## Acceptance Criteria

Exactly `BUILD_WORKFLOW.md` P16's gate: an order placed on a connected
delivery platform arrives as a kitchen ticket within seconds, status
updates push back to the platform, and commission/payout figures
reconcile against the platform's own settlement report.

## Non-Goals

- Becoming a delivery company / building courier dispatch — explicitly
  integrate, never build (master plan's strategic rule, restated from
  PRD 15).
- Multi-platform menu A/B pricing experiments — later enhancement, not
  P16 scope.
