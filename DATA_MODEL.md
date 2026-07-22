# Data Model

This is the planned data model for the restaurant-first platform. PostgreSQL is
the system of record. SQLite stores offline POS data on devices. ClickHouse is
introduced later for high-volume analytics.

## Data Modeling Principles

1. Every tenant-owned table includes `organization_id`.
2. Location-scoped records include `location_id`.
3. Financial records are append-only.
4. Inventory uses stock movements, not direct quantity overwrites.
5. Offline writes use operation logs and idempotency keys.
6. Destructive actions write audit logs.
7. AI/ML outputs are stored with model version and source metrics.
8. Hotel and retail tables are later verticals, not MVP dependencies.

## Shared Foundation

### `organizations`

Top-level tenant.

Columns:

- `id`
- `name`
- `legal_name`
- `country`
- `default_currency`
- `timezone`
- `status`
- `created_at`
- `updated_at`

### `tenant_settings`

Configurable per-organization (and optionally per-location override)
key/value settings — the home for every threshold referenced across the
PRDs as "configurable": discount-approval percentage threshold (PRD 05),
price-change alert threshold (PRD 03), cash variance threshold (PRD 08),
low-stock reorder threshold (PRD 12), stock-count variance threshold
(PRD 12), notification quiet hours (PRD 09). A `location_id` value
overrides the organization-level default for that one location; a null
`location_id` row is the organization-wide default.

Columns:

- `id`
- `organization_id`
- `location_id` (nullable)
- `key`
- `value`
- `updated_by_staff_id`
- `updated_at`

### `businesses`

A business under an organization. One organization can own multiple businesses.

Columns:

- `id`
- `organization_id`
- `name`
- `vertical`
- `status`
- `created_at`
- `updated_at`

### `locations`

Branch, restaurant location, hotel property, or retail store.

Columns:

- `id`
- `organization_id`
- `business_id`
- `name`
- `code`
- `address`
- `country`
- `currency`
- `timezone`
- `phone`
- `status`
- `created_at`
- `updated_at`

### `users`

Owner/admin identity for web login. Email+password (argon2id, added during
Phase 0 implementation — not in the original outline), not PIN, since these
are desk/web logins rather than at-terminal staff logins. `email` is unique
platform-wide (case-insensitive), not per-organization, because login only
has an email to go on — the organization is looked up from it, not supplied
alongside it.

Columns:

- `id`
- `organization_id`
- `name`
- `email`
- `phone`
- `password_hash` (nullable — unset while a user is `invited`, pending
  activation)
- `status`
- `created_at`
- `updated_at`

### `staff`

Operational staff identity.

Columns:

- `id`
- `organization_id`
- `location_id`
- `name`
- `phone`
- `pin_hash`
- `status`
- `created_at`
- `updated_at`

### `roles`

Role definitions. `organization_id` is nullable: a null row is a
system-default role seeded once and available to every tenant (the examples
below); a non-null row is a tenant's own custom role. Mirrors the same
nullable-override pattern `tenant_settings` uses for location overrides —
roles are data a tenant can extend, not a fixed enum baked into code.

Examples:

- owner
- regional_manager
- branch_manager
- supervisor
- cashier
- waiter
- chef
- stock_controller
- accountant
- auditor

### `permissions`

Named capabilities.

Examples:

- `orders:create`
- `orders:void_item`
- `payments:take_cash`
- `payments:refund`
- `inventory:adjust`
- `reports:view_profit`

### `role_permissions`

Maps roles to permissions.

### `staff_roles`

Maps staff to roles by location.

### `devices`

Authorized POS, KDS, and admin devices.

Columns:

- `id`
- `organization_id`
- `location_id`
- `name`
- `device_type`
- `platform`
- `status`
- `last_seen_at`
- `created_at`

### `audit_logs`

Immutable operational audit trail.

Columns:

- `id`
- `organization_id`
- `location_id`
- `actor_type`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `old_value`
- `new_value`
- `reason`
- `device_id`
- `ip_address`
- `created_at`

### `approval_requests`

Manager approvals for risky actions.

Columns:

- `id`
- `organization_id`
- `location_id`
- `requested_by_staff_id`
- `approved_by_staff_id`
- `action`
- `entity_type`
- `entity_id`
- `reason`
- `status`
- `created_at`
- `approved_at`
- `consumed_at` — set the instant a manager-approved override is actually
  spent by the requester's retried action (`PermissionsGuard`), not at
  approval time. Makes an approval a one-time grant: an approved-but-not-yet-
  consumed row lets exactly one retry through, never a standing bypass.

### `auth_sessions`

Server-side-revocable refresh-token sessions (added during P2 implementation
to cover master plan Module 2's "Refresh tokens" / "Session management",
which the original outline named but didn't schema out). The access token
stays a short-lived stateless JWT; this table is what makes the longer-lived
refresh token revocable on logout.

Columns:

- `id`
- `organization_id`
- `actor_type`
- `actor_id` — no FK, same reasoning as `audit_logs.actor_id`: points into
  `users` or `staff` depending on `actor_type`
- `device_id` (nullable)
- `refresh_token_hash` — argon2id hash of a per-session random secret; the
  session id and that secret both travel inside the signed refresh JWT, so a
  refresh never needs an unscoped table scan to find its row
- `expires_at`
- `revoked_at` (nullable)
- `created_at`

## Restaurant MVP

### `menus`

Restaurant menu.

### `menu_categories`

Menu grouping and KDS routing defaults.

### `products`

Sellable menu item or retail product.

Columns:

- `id`
- `organization_id`
- `location_id`
- `category_id`
- `name`
- `local_name`
- `description`
- `price_amount` — cache of the currently-active `product_prices` row for
  this product; never written directly, always derived from closing the
  prior `product_prices` row and inserting a new one (see below)
- `currency`
- `tax_category_id`
- `is_available`
- `created_at`
- `updated_at`

### `product_prices`

Append-only price history. A price change never updates
`products.price_amount` in place — it closes the current row's
`effective_to` and inserts a new row. Every `order_item` captures the
`product_prices` row (price and product name) active at the moment it
was added, so historical orders are never affected by later price
changes (PRD 03, PRD 05).

Columns:

- `id`
- `organization_id`
- `product_id`
- `price_amount`
- `currency`
- `effective_from`
- `effective_to` (nullable — null means currently active)
- `reason`
- `changed_by_staff_id`
- `created_at`

### `modifier_groups`

Example: spice level, sides, add-ons.

### `modifiers`

Individual modifier option.

### `floor_plans`

Restaurant floor plan.

### `restaurant_tables`

Physical or temporary table.

States:

- available
- seated
- ordered
- food_ready
- eating
- bill_requested
- payment_pending
- paid
- cleaning
- reserved
- blocked

### `table_merges`

Tracks tables merged into one logical order session (PRD 04). Merging
combines orders for billing/service purposes; each merged table's own
identity and its items' original seat/table lineage are preserved, not
flattened, so a post-merge split-by-seat bill can still attribute every
item correctly.

Columns:

- `id`
- `organization_id`
- `location_id`
- `primary_table_id` — the table the merged order is tracked under
- `merged_table_id`
- `order_id`
- `merged_by_staff_id`
- `merged_at`
- `unmerged_at` (nullable — null while the merge is active)

### `table_qr_sessions`

Rotating, short-lived token binding a QR-code scan to a table's current
open order (PRD 10). Prevents a stale/reused QR code from attaching a
new customer session to a prior, already-closed order after a table
turns over.

Columns:

- `id`
- `organization_id`
- `location_id`
- `table_id`
- `order_id`
- `token`
- `issued_at`
- `expires_at`

### `orders`

Restaurant order/check.

Columns:

- `id`
- `organization_id`
- `location_id`
- `table_id`
- `customer_id`
- `staff_id`
- `channel`
- `status`
- `subtotal_amount`
- `discount_amount`
- `tax_amount`
- `service_charge_amount`
- `total_amount`
- `opened_at`
- `closed_at`
- `created_at`
- `updated_at`

### `order_items`

Items on an order.

States:

- draft
- sent
- accepted
- in_progress
- ready
- served
- void_requested
- voided
- comped

### `order_item_modifiers`

Modifiers captured at time of sale.

### `bills`

Payable bill generated from one order. Supports split bills.

### `bill_items`

Line allocation to a bill.

### `kds_stations`

Kitchen station.

Examples:

- grill
- bar
- cold
- pastry
- expo

### `kitchen_tickets`

Ticket sent to kitchen.

### `kitchen_ticket_items`

Items routed to a station.

## Payments And Cash

### `payment_intents`

Attempt to collect payment.

### `payments`

Confirmed payment ledger.

Columns:

- `id`
- `organization_id`
- `location_id`
- `order_id`
- `bill_id`
- `method`
- `provider`
- `provider_reference`
- `amount`
- `currency`
- `status`
- `idempotency_key`
- `paid_at`
- `created_at`

### `refunds`

Refund ledger. Never deletes original payment.

### `tips`

Tip allocation.

### `cash_drawer_sessions`

Cash drawer open/close and expected vs counted cash.

### `shifts`

Operational shift.

### `receipts`

Receipt records and delivery status.

## Inventory

### `suppliers`

Vendor profile.

### `inventory_items`

Ingredients, supplies, products, packaging, hotel supplies later.

### `stock_locations`

Storage area or warehouse.

### `stock_levels`

Materialized current stock by location/item.

### `stock_movements`

Append-only inventory movement.

Movement types:

- receive
- sale
- recipe_deduction
- transfer_out
- transfer_in
- adjustment
- wastage
- return

### `purchase_orders`

Supplier order.

### `purchase_order_items`

Items ordered.

### `goods_receipts`

Received stock event.

### `stock_counts`

Inventory count session.

### `stock_adjustments`

Approved stock correction.

### `recipes`

Recipe for a menu item. Versioned, not overwritten (PRD 12) — the same
pattern as `product_prices`: editing a recipe closes the current
version's `effective_to` and inserts a new row, so an order's recipe
deduction always reflects the recipe version active when the deducting
sale happened, not whatever the recipe looks like today.

Columns:

- `id`
- `organization_id`
- `product_id`
- `version_number`
- `effective_from`
- `effective_to` (nullable — null means currently active)
- `status`
- `created_by_staff_id`
- `created_at`

### `recipe_ingredients`

Ingredient quantities for a specific `recipes` version (`recipe_id`
always references one immutable version row, never a "current recipe"
that could change underneath an already-recorded deduction).

### `wastage_events`

Wasted stock with reason.

## CRM

### `customers`

Unified customer profile.

### `customer_identities`

Phone, email, WhatsApp, M-Pesa identity, booking identity.

### `customer_tags`

Flexible labels such as VIP, allergy, credit customer.

### `loyalty_accounts`

Points and tier.

### `loyalty_events`

Append-only points ledger.

### `gift_cards`

Gift card balance.

### `customer_credit_accounts`

Customer tab/credit balance.

### `customer_feedback`

Ratings, comments, survey responses.

## Notifications

Backs master plan Module 4 and section 31 (Automated Reporting And
WhatsApp Command Interface), PRD 09.

### `notification_preferences`

Channel/quiet-hours preferences per staff member or customer. One row
per subject; `channel_preferences` holds per-notification-type channel
choices (e.g. receipts via WhatsApp, scheduled reports via email) rather
than one blanket channel for every message type.

Columns:

- `id`
- `organization_id`
- `subject_type` (`staff`/`customer`)
- `subject_id`
- `channel_preferences`
- `quiet_hours_start`
- `quiet_hours_end`
- `opted_out` — set immediately and unconditionally on a `STOP` reply
  (PRD 09), checked before any other send logic runs
- `updated_at`

### `whatsapp_command_log`

Every inbound two-way WhatsApp command (`SALES`, `STOCK`, `STAFF`,
`VOID`, `ORDER`, `QUERY`, `OK`, `STOP`, `HELP`) and its authentication
outcome — distinct from `audit_logs`, which records business actions;
this is notification-delivery/command telemetry (PRD 09).

Columns:

- `id`
- `organization_id` (nullable — null when the sending number couldn't be
  authenticated to any organization)
- `phone_number`
- `command`
- `authenticated_staff_id` (nullable)
- `response_summary`
- `created_at`

## Offline Sync

### `sync_operations`

Operations uploaded from devices.

### `sync_cursors`

Per-device pull cursor.

### `sync_conflicts`

Conflicts requiring review.

### `device_snapshots`

Device cache/sync metadata.

## Reporting And Intelligence

### `events`

Product analytics and domain events.

### `report_snapshots`

Saved report results.

### `daily_location_metrics`

Daily rollup per location.

### `product_sales_metrics`

Product performance rollups.

### `staff_performance_metrics`

Staff performance rollups.

### `forecast_runs`

ML forecast metadata.

### `predictions`

Prediction outputs.

### `recommendation_events`

AI/ML recommendation lifecycle.

### `anomaly_events`

Suspicious activity detection.

### `ai_briefings`

Generated daily briefings.

## Integrations

Shared by Shopify/WooCommerce (BUILD_WORKFLOW P15), delivery platforms
(P16), and any future accounting/tax/hardware adapter (master plan
Module 16).

### `integration_connections`

One row per tenant per external system. Columns: `id`, `organization_id`,
`location_id`, `provider`, `credentials_encrypted`, `status`,
`last_synced_at`, `created_at`, `updated_at`.

### `channel_product_mappings`

`internal_product_id` ↔ `external_product_id`/`external_variant_id`.

### `channel_order_mappings`

`internal_order_id` ↔ `external_order_id`.

### `channel_sync_logs`

Append-only log of every push/pull attempt, success/failure, payload hash.

## Developer Platform

Backs BUILD_WORKFLOW P19 / master plan Module 17. Distinct from
`integration_connections` above: these tables serve third-party
developers building *against* the platform, not systems we integrate
*into*.

### `developer_apps`

A registered third-party application. Columns: `id`, `owner_organization_id`
(nullable — an app can be platform-registered by a developer who isn't
necessarily a merchant), `name`, `redirect_urls`, `requested_scopes`,
`status` (`draft`/`in_review`/`listed`/`suspended`), `created_at`.

### `api_keys`

Server-to-server credentials. Columns: `id`, `organization_id`,
`developer_app_id` (nullable for a merchant's own first-party key),
`key_prefix`, `key_hash`, `scopes`, `environment` (`sandbox`/`live`),
`revoked_at`, `created_at`.

### `oauth_grants`

A merchant's scope grant to an app, created at OAuth install time.
Columns: `id`, `organization_id`, `developer_app_id`, `granted_scopes`,
`status`, `granted_at`, `revoked_at`.

### `oauth_tokens`

Access/refresh token pairs issued against an `oauth_grants` row.

### `webhook_subscriptions`

Developer-facing event subscriptions. Columns: `id`, `organization_id`,
`developer_app_id`, `target_url`, `event_types`, `signing_secret_encrypted`,
`status` (`active`/`paused`/`failed`), `created_at`.

### `webhook_deliveries`

Append-only delivery attempt log per subscription: `id`,
`webhook_subscription_id`, `event_type`, `payload_hash`, `attempt_number`,
`response_status`, `delivered_at`.

### `api_usage_logs`

Per-request log used for rate limiting, idempotency-key lookups, and
per-app usage analytics in the developer portal.

### `marketplace_listings`

Publicly listed app metadata: category, pricing, revenue-share terms,
review status.

### `marketplace_installs`

`organization_id` ↔ `marketplace_listing_id` install record, links to the
`oauth_grants` row created at install time.

## Africa Market Compliance

Backs master plan Module 18.

### `tax_compliance_submissions`

One row per receipt submitted to a country's tax authority. Columns:
`id`, `organization_id`, `location_id`, `receipt_id`, `country`,
`provider` (`kra_etims`/`firs`/`sars`), `submission_status`
(`queued`/`sent`/`confirmed`/`failed`), `provider_reference`,
`submitted_at`, `created_at`. Queued/failed rows drive the P11 offline
sync retry, never silently dropped.

### `mobile_money_registered_numbers`

The business's registered till/paybill/phone numbers per provider, used
to flag a confirmed payment against an unregistered number (staff fraud
detection).

### `chama_savings_links`

Linked SACCO/Chama savings account and the configured auto-route
percentage of daily net profit.

### `supplier_credit_schedules`

Due-date schedule per supplier balance (extends `purchase_orders`), used
to drive the WhatsApp reminder before a payment is due.

## Pricing And Billing

Backs master plan section 29.

### `subscription_plans`

Plan catalog: `id`, `code` (`starter`/`business`/`pro`/`enterprise`),
`name`, `price_amount`, `currency`, `billing_interval`, `feature_entitlements`.

### `organization_subscriptions`

`organization_id` ↔ `subscription_plans` with status and current period,
supporting the "one subscription, multiple businesses, one consolidated
bill" model from Module 1.

### `billing_invoices`

Platform billing invoice per organization per period (distinct from a
retail-side `invoices` row, which is a customer-facing sales document).

### `usage_charges`

Metered charges against an organization for the usage-based revenue
layers: payment-processing basis points, marketplace revenue share,
premium feature add-ons.

## Restaurant Extensions

### `brands`

A virtual brand for multi-brand/ghost-kitchen operation, sharing one
physical `location_id` and kitchen but with its own menu and its own KDS
lane color.

### `benchmark_snapshots`

Anonymized, aggregated peer-group metric snapshots (city + category +
price tier), computed only for peer groups with at least 10 tenants;
never stores a merchant-identifiable value alongside another merchant's
data.

### `external_reviews`

Ingested reviews from Google/delivery platforms plus QR dish ratings,
feeding the review/sentiment monitoring feature.

## Later Hotel OS

Tables:

- `properties`
- `room_types`
- `rooms`
- `rate_plans`
- `hotel_reservations`
- `stays`
- `folios`
- `folio_charges`
- `housekeeping_tasks`
- `maintenance_tickets`
- `guest_requests`
- `channel_bookings`

## Later Retail OS

Tables:

- `retail_products`
- `retail_variants`
- `barcodes`
- `serial_numbers`
- `batches`
- `sales`
- `sale_items`
- `returns`
- `exchanges`
- `quotes`
- `invoices`
- `coupons`
- `warehouses`
- `stock_transfers`

## Later Retail Extensions

Backs master plan section 9, Retail Extended Sales Models.

### `layaway_plans`

Deposit + installment schedule per sale; goods release only once the
plan's paid threshold is met.

### `layaway_installments`

Scheduled/paid installment rows against a `layaway_plans` row.

### `rentals`

Rented item with due date, deposit, and condition notes captured at
checkout and at return.

### `job_cards`

Repair/service job lifecycle: `intake → diagnosis → quote_approved →
in_progress → ready → collected`, with WhatsApp status push at each
transition.

### `event_tickets`

QR-issued ticket with capacity tracking, door-scanner check-in status,
and refund/transfer state.

### `franchise_royalty_rules`

Per-branch royalty percentage, compliance scoring inputs, and HQ price
floors for franchise/chain operation.

