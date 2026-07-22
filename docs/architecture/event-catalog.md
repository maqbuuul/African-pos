# Canonical Event Catalog

## Scope

Consolidates every domain event referenced across `docs/prd/00`–`19`
(Restaurant OS) and `docs/prd/hotel/`/`docs/prd/retail/` (Hotel OS,
Retail OS) "Events Emitted" sections into one reference, with trigger,
payload shape, and consumer registry per event.
`docs/architecture/data-platform.md` flagged this as "worth formalizing
once the event list stabilizes past active development" — all 20
Restaurant OS PRDs plus the 15 Hotel/Retail PRDs are now written, so
that condition is met for the full document set, though Hotel/Retail's
events carry the same lower-confidence status as their source PRDs (see
`docs/prd/README.md`) since neither vertical has been built yet. This
document does not introduce new events; it indexes what each PRD already
defined so the outbox (ADR 0001 decision 5), webhook delivery (PRD 19),
and analytics ingestion (`docs/architecture/data-platform.md`) have one
place to look instead of thirty-five.

## Naming and Payload Conventions

Per `docs/architecture/data-platform.md`'s event-catalog discipline,
restated as the concrete rule this document enforces:

- Every event name is `PastTenseVerb` form — a fact about something that
  already happened, never a command.
- Every payload includes `organization_id` and, where the entity is
  location-scoped, `location_id` — no event requires a secondary lookup
  to determine tenant scope.
- Every payload includes `entity_id` (the primary entity the event is
  about) and `occurred_at`.
- Fields beyond the common envelope are listed per event below as
  "Key payload fields" — the authoritative row/entity shape lives in
  `DATA_MODEL.md`; this catalog names which columns matter for the event,
  not a full schema restatement.

## Common Envelope

```json
{
  "event": "OrderClosed",
  "organization_id": "org_...",
  "location_id": "loc_...",
  "entity_type": "order",
  "entity_id": "ord_...",
  "occurred_at": "2026-07-20T12:00:00.000Z",
  "payload": {}
}
```

This is the shape both the internal event bus (Postgres transactional
outbox, ADR 0001 decision 5) and PRD 19's signed webhook delivery use —
one envelope, two delivery paths, never two independently-maintained
formats.

## PRD 00 — Organizations & Multi-Tenancy

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `OrganizationCreated` | Signup completes | `name`, `country`, `default_currency` | Onboarding flow, product analytics |
| `LocationCreated` | New location added | `business_id`, `name`, `country`, `currency` | Onboarding flow, menu-copy prompt, product analytics |
| `OrganizationSuspended` | Billing hold or manual suspension | `status`, `reason` | All modules (tenant-context middleware blocks writes), notification module |
| `SubscriptionChanged` | Plan upgrade/downgrade | `plan_code`, `previous_plan_code` | Feature-entitlement cache invalidation, billing |

## PRD 01 — Auth & Permissions

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `StaffLoggedIn` | Successful PIN or email login | `staff_id`, `device_id`, `method` | Audit log |
| `StaffLoginFailed` | Failed login attempt | `staff_id` (if resolvable), `device_id`, `attempt_number` | Audit log, PRD 17 (fraud/anomaly), branch manager lockout alerts |
| `StaffDeactivated` | Manager deactivates staff | `staff_id` | Audit log, session revocation, every module referencing that staff member |
| `ApprovalRequested` / `ApprovalGranted` / `ApprovalDenied` | Sensitive action gated by permission | `action`, `requested_by_staff_id`, `approved_by_staff_id` (nullable) | Audit log, notification module, product analytics |
| `DeviceAuthorized` / `DeviceDeauthorized` | Device activation/revocation | `device_id`, `location_id` | Audit log, admin-web device status view |

## PRD 02 — Audit Logs

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `AuditLogExported` | Manual export requested | `filter_criteria`, `exported_by_staff_id` | Product analytics, notification (large-export alert) |

## PRD 03 — Menu & Product Catalog

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `ProductCreated` / `ProductUpdated` | Product CRUD | `category_id`, `name`, `is_available` | POS/KDS/QR cache invalidation (PowerSync sync rules), search indexing, product analytics |
| `ProductPriceChanged` | New `product_prices` row inserted | `price_amount`, `currency`, `effective_from`, `reason` | PRD 14 (menu engineering), product analytics |
| `ProductAvailabilityChanged` | 86'd / restored | `is_available`, `changed_by_staff_id` | POS/KDS/QR cache invalidation, PRD 06 (in-flight ticket handling) |
| `MenuDayPartSwitched` | Scheduled day-part transition | `from_menu_id`, `to_menu_id` | POS/QR active-menu filter, manager pre-switch alert |

## PRD 04 — Floor Plan & Tables

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `TableStateChanged` | Any table state-machine transition | `from_state`, `to_state`, `table_id` | PRD 06 (prioritization), PRD 14 (turnover metrics), notification module |
| `TablesMerged` / `TableSplit` | Merge/split action | `primary_table_id`, `merged_table_id`, `order_id` | PRD 05 (order consolidation), PRD 14 (accurate table counts) |
| `TableTransferred` | Waiter reassignment | `table_id`, `from_staff_id`, `to_staff_id` | Notification module |

## PRD 05 — Order Engine

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `OrderOpened` | New order created | `channel`, `table_id` (nullable) | Product analytics |
| `OrderItemAdded` | Item added to order | `product_id`, `price_amount` (snapshot), `quantity` | PRD 12 (recipe deduction trigger candidate) |
| `OrderItemSent` | Item fired to kitchen | `station_id` | PRD 06 (kitchen ticket generation) |
| `OrderItemVoided` | Void completes | `reason`, `voided_by_staff_id` | PRD 02 (audit), PRD 14 (void reporting) |
| `OrderDiscountApplied` | Discount applied | `amount`, `discount_type`, `applied_by_staff_id` | PRD 02 (audit), PRD 14 |
| `OrderClosed` | All bills paid | `total_amount`, `channel` | PRD 04 (table → cleaning), PRD 14 (sales reporting) |
| `BillCreated` | Split or single bill generated | `order_id`, `total_amount` | PRD 07 (payment flow trigger) |
| `BillPaid` | Bill fully covered by confirmed payments | `bill_id` | PRD 09 (receipt trigger) |

## PRD 06 — Kitchen Display System

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `KitchenTicketCreated` | Order item routed to a station | `station_id`, `order_item_id` | Product analytics |
| `KitchenTicketItemBumped` | Chef bumps item/ticket | `ticket_item_id`, `station_id`, `elapsed_seconds` | PRD 05 (item status sync), PRD 04 (food_ready transition), PRD 14, PRD 17 (cook-time training data) |
| `KitchenTicketItemRecalled` | Recall within grace window | `ticket_item_id` | PRD 05 (item status sync) |
| `CrossStationImbalanceDetected` | Rebalance-alert threshold crossed | `slow_station_id`, `idle_station_id` | Manager/expo notification |

## PRD 07 — Payments

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `PaymentIntentCreated` | Payment attempt started | `method`, `provider`, `amount`, `idempotency_key` | Product analytics |
| `PaymentConfirmed` | Provider/cash confirms payment | `provider_reference`, `amount` | PRD 05 (bill status), PRD 08 (expected-cash update), PRD 09 (receipt), PRD 14, PRD 17 |
| `PaymentFailed` | Provider timeout/rejection | `failure_reason` | Notification (cashier retry prompt) |
| `RefundIssued` | Refund processed | `original_payment_id`, `amount`, `reason` | PRD 02 (audit), PRD 14, PRD 08 (cash-out if cash refund) |
| `TipRecorded` | Tip captured at payment | `amount`, `staff_id` | PRD 14 (staff tip reporting) |

## PRD 08 — Shift & Cash Drawer

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `ShiftOpened` | Shift starts | `starting_float`, `device_id` | Product analytics |
| `ShiftClosed` | Shift closes | `expected_amount`, `counted_amount`, `variance` | PRD 09 (WhatsApp `SALES` delivery), PRD 14 (shift reporting) |
| `CashVarianceDetected` | Variance exceeds threshold (`tenant_settings`) | `variance_amount`, `shift_id` | Notification (immediate manager alert), PRD 17 (fraud features), audit log |
| `CashDrawerAdjusted` | Mid-shift adjustment | `amount`, `direction`, `reason`, `approved_by_staff_id` | Audit log, live P&L recalculation |

## PRD 09 — Receipts & Notifications

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `ReceiptGenerated` | Bill paid | `bill_id`, `channel` | Product analytics |
| `ReceiptDelivered` / `ReceiptDeliveryFailed` | Delivery attempt outcome | `channel`, `provider_status` | Support/admin delivery-status view |
| `ScheduledReportSent` | Cadence-triggered report delivered | `report_type`, `recipient` | Product analytics |
| `NotificationOptedOut` | `STOP` command received | `phone_number` | Every module that might message this number |

## PRD 10 — QR / Table Ordering

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `QrSessionStarted` | QR scan opens/joins a session | `table_id`, `token` | Product analytics |
| `QrOrderSubmitted` | Customer submits cart | `order_id`, `item_count` | PRD 14 (channel-mix reporting) |
| `WaiterRequested` | Customer taps request-waiter | `table_id` | Notification module, floor staff alert |
| `DishRated` | Post-service rating | `product_id`, `rating` | PRD 14 (menu engineering, kitchen performance) |
| `FeedbackSubmitted` | Free-text/rating feedback | `rating`, `comment` | PRD 14, notification (negative-feedback alert) |

## PRD 11 — Offline Sync

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `SyncCompleted` | Device drains upload queue and catches up | `device_id`, `operations_applied` | Admin-web device health view |
| `SyncConflictDetected` | Per-entity conflict policy can't auto-resolve | `entity_type`, `entity_id`, `conflicting_devices` | Admin-web conflict queue, notification (persistent-backlog alert) |

Every event from PRD 04/05/06/07/08 above still fires from
offline-originated actions once synced — this PRD is the delivery
mechanism under degraded connectivity, not a parallel event stream.

## PRD 12 — Inventory, Recipes & Purchasing

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `StockMovementRecorded` | Any movement type (receive/sale/recipe_deduction/transfer/adjustment/wastage/return) | `movement_type`, `quantity`, `inventory_item_id` | PRD 14, PRD 17 (demand/stockout features) |
| `LowStockDetected` | Stock level crosses `tenant_settings` reorder threshold | `inventory_item_id`, `current_level` | Notification, suggested-reorder workflow |
| `PurchaseOrderApproved` | PO approved | `purchase_order_id`, `supplier_id`, `total_amount` | PRD 14 (procurement analytics) |
| `GoodsReceived` | Goods receipt recorded | `purchase_order_id`, `discrepancy_flag` | PRD 14 (supplier scorecards) |
| `WastageRecorded` | Wastage event logged | `inventory_item_id`, `quantity`, `reason` | PRD 14 (food waste analytics) |
| `StockAdjustmentApproved` | Variance-driven adjustment approved | `variance_amount`, `approved_by_staff_id` | PRD 02 (audit) |

## PRD 13 — CRM & Loyalty

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `CustomerIdentified` | Identity resolved at a touchpoint | `customer_id`, `channel` | PRD 05 (order attribution), product analytics |
| `CustomerProfilesMerged` | Manual merge | `surviving_customer_id`, `merged_customer_id` | Product analytics |
| `LoyaltyPointsEarned` / `LoyaltyPointsRedeemed` | Accrual/redemption event | `points`, `loyalty_account_id` | PRD 09 (customer message), PRD 14 |
| `LoyaltyTierChanged` | Tier threshold crossed | `from_tier`, `to_tier` | PRD 09 |
| `GiftCardIssued` / `GiftCardRedeemed` | Gift card lifecycle | `gift_card_code`, `amount` | PRD 14 (liability reporting) |
| `NegativeReviewDetected` / `TrendingComplaintDetected` | Review ingestion below threshold | `source`, `rating`, `theme` | Notification (immediate manager alert), PRD 14 |
| `WinBackCandidateListGenerated` | Scheduled inactivity scan | `candidate_count` | PRD 09 (campaign delivery), product analytics |

## PRD 14 — Reports & BI Dashboards

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `BenchmarkComputed` | Scheduled peer-group aggregation | `metric`, `peer_group_size` (never below 10) | Owner dashboard, PRD 17 (briefing input), PRD 09 |
| `ReportViewed` | Dashboard/report opened | `report_type`, `viewer_role` | Product analytics (SaaS-side adoption, distinct from tenant-facing reporting) |

## PRD 15 — Commerce Integrations

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `StorefrontOrderReceived` | Shopify/WooCommerce webhook processed | `provider`, `external_order_id` | PRD 14 (channel-mix reporting), admin health dashboard |
| `CatalogSyncCompleted` / `CatalogSyncFailed` | Push attempt outcome | `provider`, `product_count` | Admin health dashboard |

## PRD 16 — Delivery Integrations

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `DeliveryOrderReceived` | Delivery platform webhook processed | `provider`, `external_order_id` | PRD 06 (kitchen routing), PRD 14 |
| `DeliveryStatusPushed` | Status pushed back to platform | `provider`, `status` | Admin health dashboard |
| `DeliveryOrderCancelled` | Platform-side cancellation | `provider`, `reason` | PRD 05 (void flow) |

## PRD 17 — AI/ML Service

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `BriefingGenerated` | Scheduled/pre-shift briefing composed | `briefing_type`, `location_id` | PRD 09 (delivery) |
| `AnomalyDetected` | Named threshold crossed | `threshold_name`, `threshold_value`, `actual_value` | Notification, PRD 14 (dashboard alert) |
| `StockoutRiskDetected` | Tiered stockout prediction | `tier`, `inventory_item_id` | PRD 09, PRD 12 (smarter reorder suggestions) |
| `SupplierPriceChangeDetected` | Invoice OCR flags a price delta | `supplier_id`, `previous_price`, `new_price` | PRD 12 (supplier scorecarding), notification |

## PRD 18 — Security, Compliance & Hardening

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `SecurityFindingLogged` / `SecurityFindingResolved` | Review process (internal, not tenant-facing) | `finding_type`, `severity` | Internal tracking only |
| `DrDrillCompleted` | DR drill run | `pass_fail`, `findings_count` | Internal — launch go/no-go decision |

## PRD 19 — Developer Platform

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `DeveloperAppRegistered` | App registration | `developer_app_id` | Admin review queue |
| `AppInstalled` / `AppUninstalled` | Merchant install/uninstall | `developer_app_id`, `organization_id` | Product analytics |
| `WebhookDeliveryFailed` | Delivery attempt fails | `webhook_subscription_id`, `attempt_number` | Developer portal notification |
| `WebhookSubscriptionPaused` | Repeated consistent failure | `webhook_subscription_id` | Developer portal notification |

Every event listed above (PRD 00–17) is itself a potential webhook
payload for an authorized third-party subscriber — PRD 19 re-delivers
existing events, it does not define its own separate event set beyond
the four rows above, which are specific to the developer-platform
relationship itself (app lifecycle, delivery health).

---

# Hotel OS Events

Lower-confidence than the Restaurant OS section above — see
`docs/prd/README.md`'s Hotel OS and Retail OS note.

## Hotel PRD 01 — Reservations & Booking Engine

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `ReservationCreated` / `ReservationConfirmed` | Booking created/confirmed | `room_type_id`, `rate_plan_id`, `check_in_date`, `check_out_date` | Hotel PRD 02 (arrivals list), Hotel PRD 04 (folio), Hotel PRD 08 |
| `ReservationCancelled` / `NoShowRecorded` | Cancellation or no-show cutoff | `cancellation_fee` (nullable) | Hotel PRD 02, Hotel PRD 04, Hotel PRD 08 |
| `DepositPaid` | Deposit payment confirmed | `amount` | Hotel PRD 04 (folio balance) |

## Hotel PRD 02 — Front Desk

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `GuestCheckedIn` / `GuestCheckedOut` | Front desk action | `room_id`, `reservation_id` | Hotel PRD 03 (room state), Hotel PRD 04 (folio), Hotel PRD 08 |
| `RoomMoved` | Guest moved rooms mid-stay | `from_room_id`, `to_room_id` | Hotel PRD 03, Hotel PRD 04 |
| `LateCheckoutApproved` / `EarlyCheckInApproved` | Front desk approval | `fee_amount` (nullable) | Hotel PRD 03, Hotel PRD 04 |

## Hotel PRD 03 — Room & Housekeeping Management

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `RoomStateChanged` | Any room state-machine transition | `from_state`, `to_state`, `room_id` | Hotel PRD 01 (availability), Hotel PRD 02, Hotel PRD 08 |
| `HousekeepingTaskAssigned` / `HousekeepingTaskCompleted` | Task lifecycle | `room_id`, `staff_id` | Hotel PRD 08, notification |
| `InspectionFailed` | Inspector fails a cleaned room | `reason` | Hotel PRD 08, notification |
| `DamageReported` | Checklist damage report | `room_id`, `description` | Hotel PRD 05 (ticket creation), Hotel PRD 04 (charge) |

## Hotel PRD 04 — Folio, Hotel Payments & Night Audit

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `FolioOpened` / `FolioChargePosted` / `FolioClosed` | Folio lifecycle | `charge_type`, `amount` | Hotel PRD 02 (checkout gate), Hotel PRD 08 |
| `FolioSplit` | Front desk splits a stay's charges | `resulting_folio_ids` | Hotel PRD 02, Hotel PRD 08 |
| `RoomChargePosted` | Restaurant room-charge posted | `originating_order_id` | Restaurant OS PRD 07, Hotel PRD 08 |
| `NightAuditCompleted` | Night audit run finishes | `business_date`, `rooms_audited` | Hotel PRD 08, notification |

## Hotel PRD 05 — Maintenance

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `MaintenanceTicketCreated` / `MaintenanceTicketAssigned` / `MaintenanceTicketResolved` | Ticket lifecycle | `priority`, `asset_id` (nullable) | Hotel PRD 03 (room release), Hotel PRD 08 |
| `SlaBreached` | SLA countdown exceeded | `ticket_id`, `priority` | Notification |

## Hotel PRD 06 — Guest CRM

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `GuestProfileCreated` / `GuestProfilesMerged` | Identity resolution/merge | shared shape with Restaurant OS PRD 13 | Hotel PRD 01/02 |
| `GuestFlaggedVip` | VIP flag set | `guest_id` | Hotel PRD 02 (arrivals), Hotel PRD 08 |
| `ComplaintLogged` | Staff logs a complaint | `severity` | Hotel PRD 08, notification |

## Hotel PRD 07 — Channel Management

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `ChannelReservationReceived` | OTA webhook processed | `provider`, `external_reservation_id` | Hotel PRD 01, Hotel PRD 08 |
| `ChannelSyncCompleted` / `ChannelSyncFailed` | Rate/availability push outcome | `provider` | Admin health dashboard |
| `OverbookingDetected` | Cross-channel race | `room_type_id`, `conflicting_reservations` | Notification |

## Hotel PRD 08 — Reports, BI Dashboards & AI

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `HotelBenchmarkComputed` / `HotelReportViewed` | Scheduled/on-demand | same shape as Restaurant OS PRD 14 equivalents | GM dashboard, product analytics |
| `HotelBriefingGenerated` / `HotelAnomalyDetected` | Scheduled/threshold-crossed | `threshold_name` (anomaly) | Hotel PRD 08 delivery, notification |

---

# Retail OS Events

Lower-confidence than the Restaurant OS section above — see
`docs/prd/README.md`'s Hotel OS and Retail OS note.

## Retail PRD 01 — POS & Checkout

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `SaleStarted` / `SaleSuspended` / `SaleResumed` / `SaleVoided` | Cart lifecycle | `sale_id` | Product analytics |
| `SaleCompleted` | Payment confirmed | `total_amount` | Retail PRD 02 (stock deduction), Retail PRD 07 |
| `QuoteCreated` / `QuoteConverted` / `QuoteExpired` | Quote lifecycle | `validity_period` | Retail PRD 07 |

## Retail PRD 02 — Inventory & Variants

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `VariantCreated` / `VariantUpdated` | Variant CRUD | `parent_product_id` | Retail PRD 01 (catalog), search indexing |
| `StockMovementRecorded` | Any movement type | `movement_type`, `quantity` | Retail PRD 07, Retail PRD 03 (reorder) |
| `StockCountVarianceDetected` | Count variance beyond threshold | `variance_amount`, `tier` | Notification |
| `BatchExpiryApproaching` / `BatchExpired` | Expiry date approaching/passed | `batch_id` | Notification, Retail PRD 07 |

## Retail PRD 03 — Procurement

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `PurchaseOrderApproved` / `GoodsReceived` | PO lifecycle | `supplier_id`, `total_amount` | Retail PRD 07 |
| `RfqSent` / `RfqResponseReceived` | RFQ lifecycle | `supplier_id` | Retail PRD 07 |
| `SupplierPerformanceUpdated` | Scheduled scorecard update | `supplier_id`, `fill_rate` | Retail PRD 07 |

## Retail PRD 04 — Returns & Exchanges

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `ReturnRequested` / `ReturnApproved` / `ReturnRejected` | Return lifecycle | `original_sale_id` | Retail PRD 02, Retail PRD 07 |
| `ExchangeCompleted` | Exchange finalized | `new_sale_id` | Retail PRD 01, Retail PRD 07 |
| `StoreCreditIssued` / `StoreCreditRedeemed` | Store credit lifecycle | `amount` | Retail PRD 07 (liability) |

## Retail PRD 05 — Extended Sales Models

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `LayawayPlanCreated` / `LayawayInstallmentPaid` / `LayawayForfeited` | Layaway lifecycle | `plan_id` | Notification, Retail PRD 07 |
| `RentalCheckedOut` / `RentalReturned` / `LateFeeCalculated` | Rental lifecycle | `rental_id` | Retail PRD 07 |
| `JobCardStatusChanged` | Any state-machine transition | `job_card_id`, `to_status` | Notification (WhatsApp push) |
| `TicketIssued` / `TicketCheckedIn` / `TicketRefunded` / `TicketTransferred` | Ticket lifecycle | `event_id`, `ticket_code` | Retail PRD 07 |
| `RoyaltyCalculated` / `ComplianceScoreUpdated` / `PriceFloorViolated` | Franchise scheduled/threshold | `branch_id` | Franchise dashboard, notification |

## Retail PRD 06 — Omnichannel

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `StockReserved` / `StockReservationReleased` | Online order reservation lifecycle | `variant_id`, `channel` | Retail PRD 02, other channels |
| `BopisOrderReady` / `ShipFromStoreOrderPacked` | Fulfillment status | `order_id` | Notification |
| `OmnichannelSaleReceived` | Channel webhook processed | `channel` | Retail PRD 07 |

## Retail PRD 07 — CRM, Reports, BI & AI

| Event | Trigger | Key payload fields | Consumers |
| --- | --- | --- | --- |
| `RetailCustomerIdentified` / `RetailBenchmarkComputed` / `RetailReportViewed` | Various | same shape as Restaurant OS PRD 13/14 equivalents | Dashboards, product analytics |
| `RetailBriefingGenerated` / `RetailAnomalyDetected` / `RetailStockoutRiskDetected` | Scheduled/threshold-crossed | `threshold_name` (anomaly) | Delivery, notification |

## Maintenance

When a new event is added to any PRD's "Events Emitted" section, add the
corresponding row here in the same change — this catalog is a derived
index, not a second source of truth; if it drifts from the PRDs, the
PRDs win and this document is stale and needs a follow-up fix.
