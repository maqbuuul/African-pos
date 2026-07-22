# African Hospitality OS Master Plan

## Table Of Contents

1. North Star
2. Product Philosophy
3. Platform Strategy
4. Target Customers
5. User Types
6. Shared Platform Modules
7. Restaurant OS
8. Hotel OS
9. Retail OS
10. Customer-Facing Products
11. Hardware Ecosystem
12. Technical Architecture
13. Data Model Outline
14. AI And ML Model Catalog
15. Roadmap
16. MVP Scope
17. Success Metrics
18. What To Build First
19. Final Commitment
20. Development Operating Manual
21. Product Surfaces
22. Permission And Approval Matrix
23. Restaurant Detailed Build Spec
24. Hotel Detailed Build Spec
25. Retail Detailed Build Spec
26. Backend Module Contracts
27. Offline Sync Detailed Spec
28. Development Acceptance Criteria
29. Pricing And Monetization Model
30. BI Dashboard Design System
31. Automated Reporting And WhatsApp Command Interface
32. UX Design Principles, Performance Budgets, And Onboarding

## 1. North Star

### Mission

Build the AI-powered Hospitality and Commerce Operating System for Africa.

### Vision

Give African restaurants, hotels, retailers, and hospitality businesses one
offline-first platform to run operations, understand customers, make better
decisions, and grow faster.

### Positioning

We are not building only a POS.

We are not building a payment company.

We are not building a bank.

We are building the operating system for African service businesses:

- POS
- PMS
- CRM
- Inventory
- BI
- ML
- AI
- Offline sync
- WhatsApp workflows
- East African payment integrations
- Multi-tenant SaaS

### Strategic Rule

Integrate everything. Build only what differentiates us.

In the first phase, we do not build:

- Payment processor
- Banking
- Lending
- Payroll provider
- Card infrastructure
- Tax authority infrastructure
- Delivery marketplace

We integrate:

- M-Pesa
- Airtel Money
- EVC Plus
- eDahab
- Zaad
- Stripe
- Flutterwave
- Paystack
- Visa
- Mastercard
- Odoo
- QuickBooks
- Xero
- WhatsApp
- SMS providers
- Booking channels
- Delivery channels

We build:

- Restaurant workflows
- Hotel workflows
- Retail workflows
- Offline-first operations
- AI insight layer
- BI dashboards
- ML forecasting
- Customer intelligence
- East African localization
- Developer-grade APIs
- Multi-tenant operations

## 2. Product Philosophy

### What We Learn From The Leaders

| Company | What We Learn |
| --- | --- |
| Toast | Restaurant ecosystem and workflow depth |
| Oracle MICROS | Enterprise hospitality operations |
| Cloudbeds | Property management workflows |
| Mews | Guest experience and modern PMS design |
| Lightspeed | Inventory and retail operations |
| Shopify | Simplicity and omnichannel commerce |
| Square | Fast, friendly UX |
| Stripe | APIs, docs, reliability, developer experience |
| Starbucks | Customer intelligence and loyalty |
| SpotOn | Labor management |
| Clover | Hardware ecosystem |
| Apple | Design discipline |

### What We Steal

- Workflows, not branding
- UX patterns, not UI copying
- Operational depth, not marketing language
- Reliability, not logos
- Simplicity, not superficial minimalism
- Customer intelligence, not vanity analytics

### Product Rules

1. One screen should do one job well.
2. The fastest path must serve the frontline worker.
3. Owners should see decisions, not just charts.
4. Managers should see exceptions first.
5. Cashiers should be able to sell in seconds.
6. Offline must be a first-class mode, not a fallback.
7. Every destructive action must have permissions and audit logs.
8. Every feature should produce useful business data.
9. AI should explain, recommend, and automate, but never hide the source data.
10. Build the simplest thing that can scale to thousands of businesses.

## 3. Platform Strategy

### One Platform, Three Vertical Experiences

The long-term product is one shared platform with vertical operating systems on
top.

```text
Core Platform
|
+-- Restaurant OS
+-- Hotel OS
+-- Retail OS
```

The shared platform should contain roughly 80% of the codebase:

- Organizations
- Locations
- Users
- Roles and permissions
- Authentication
- Audit logs
- Notifications
- CRM
- Payments integrations
- Inventory primitives
- Reporting
- Analytics
- BI
- AI
- ML services
- Offline sync
- APIs
- Webhooks
- Billing
- Feature flags
- Integration framework

Each vertical should add its own workflows, vocabulary, screens, reports, and
domain-specific automations.

### Year 1 Focus

Become the easiest restaurant POS in East Africa.

Do not try to become the biggest POS in Africa first. Win one use case deeply:

- Nairobi restaurants
- Cafes
- Bars
- Bakeries
- Fast food
- Cloud kitchens

### Year 2 Focus

Add hotel and hospitality workflows:

- Hotels
- Resorts
- Lodges
- Guest houses
- Event venues
- Clubs
- Beach resorts

### Year 3 Focus

Deepen intelligence:

- ML forecasting
- AI assistant
- Customer intelligence
- Inventory optimization
- Staffing optimization
- Automated reporting

### Year 4 Focus

Open the ecosystem:

- Marketplace
- Third-party apps
- Partner integrations
- Public API
- Developer portal
- Hardware partners

### Year 5+ Focus

Only after earning trust and transaction volume, evaluate:

- Payments infrastructure
- Payroll
- Lending
- Banking
- Embedded finance
- Insurance

## 4. Target Customers

### Restaurant Segment

- Full-service restaurants
- Quick-service restaurants
- Cafes
- Coffee shops
- Bakeries
- Bars
- Food courts
- Cloud kitchens
- Catering businesses
- Event food vendors

### Hospitality Segment

- Hotels
- Resorts
- Lodges
- Guest houses
- Serviced apartments
- Beach resorts
- Clubs
- Event venues
- Conference centers

### Retail Segment

- Mini markets
- Supermarkets
- Pharmacies
- Boutiques
- Electronics shops
- Hardware stores
- Beauty shops
- Wholesalers
- Specialty retailers
- Multi-branch retail chains

## 5. User Types

### Owner

Owns one or many businesses. Wants revenue, profit, risk, growth, and clear
recommendations.

Main screens:

- Executive dashboard
- Branch comparison
- Profit and loss
- Customer intelligence
- Forecasts
- Alerts
- AI assistant
- Billing and subscription

Key actions:

- View performance
- Approve high-risk actions
- Set permissions
- Review recommendations
- Export reports
- View audit logs

### Regional Manager

Manages multiple branches or properties.

Main screens:

- Branch ranking
- Exceptions dashboard
- Sales by location
- Inventory by location
- Staff performance
- Offline branch alerts
- Compliance alerts

Key actions:

- Compare branches
- Transfer stock
- Review managers
- Investigate anomalies
- Approve inter-branch actions

### Branch Manager

Runs day-to-day operations.

Main screens:

- Daily operations dashboard
- Staff attendance
- Inventory
- Orders or bookings
- Cash reconciliation
- Customer issues
- Shift reports

Key actions:

- Open and close shifts
- Approve voids, discounts, and refunds
- Assign staff
- Receive stock
- Handle escalations
- Submit daily report

### Supervisor

Supports the branch manager during service.

Main screens:

- Live service view
- Staff status
- Queue status
- Table or checkout exceptions
- Customer complaints

Key actions:

- Reassign orders
- Approve minor discounts
- Resolve service delays
- Escalate issues

### Cashier

Handles fast transactions.

Main screens:

- POS checkout
- Product search
- Cart
- Payment
- Receipt
- Returns

Key actions:

- Scan or select items
- Add customer
- Take payment
- Print or send receipt
- Process return with permission

### Waiter Or Server

Handles table service.

Main screens:

- Floor plan
- Tables
- Order entry
- Order status
- Payment
- Tips

Key actions:

- Open table
- Add items
- Send to kitchen
- Split bill
- Transfer table
- Close order

### Chef Or Kitchen Staff

Handles food production.

Main screens:

- Kitchen display system
- Station queue
- Ticket detail
- Prep tasks
- Allergy alerts

Key actions:

- Accept ticket
- Mark item started
- Mark item ready
- Bump ticket
- Report unavailable item

### Receptionist

Handles hotel front desk operations.

Main screens:

- Reservations
- Availability calendar
- Check-in
- Check-out
- Guest profile
- Room assignment

Key actions:

- Create booking
- Assign room
- Check guest in
- Check guest out
- Add charges
- Resolve guest requests

### Housekeeping

Handles room readiness.

Main screens:

- Assigned rooms
- Room status
- Checklist
- Inspection
- Lost and found

Key actions:

- Start cleaning
- Mark room clean
- Report maintenance issue
- Complete checklist
- Request inspection

### Maintenance

Handles hotel and store maintenance.

Main screens:

- Work orders
- Preventive maintenance
- Asset list
- Priority queue

Key actions:

- Accept ticket
- Update ticket status
- Add parts used
- Close ticket
- Escalate issue

### Stock Controller

Owns inventory accuracy.

Main screens:

- Stock levels
- Receiving
- Transfers
- Adjustments
- Stock counts
- Expiry and batch tracking

Key actions:

- Receive stock
- Count stock
- Transfer stock
- Adjust stock with reason
- Investigate variances

### Accountant

Owns finance, reconciliation, and compliance.

Main screens:

- Revenue
- Payments
- Taxes
- P&L
- Cash flow
- Expenses
- Reconciliation

Key actions:

- Reconcile M-Pesa
- Reconcile cash
- Export reports
- Review tax submissions
- Sync accounting system

### Auditor

Reviews risk and compliance.

Main screens:

- Audit log
- Permission changes
- Voids and discounts
- Refunds
- Cash variances
- Login activity

Key actions:

- Search audit events
- Export audit trail
- Flag suspicious activity
- Review policy violations

### Customer Or Guest

Uses customer-facing experiences.

Main surfaces:

- QR ordering
- Online ordering
- WhatsApp ordering
- Loyalty wallet
- Digital receipt
- Booking engine
- Feedback survey
- Gift card balance

## 6. Shared Platform Modules

### Module 1: Organizations And Multi-Tenancy

Purpose:

Represent every customer business safely and scalably.

Features:

- Organizations
- Businesses
- Locations
- Branches
- Properties
- Departments
- Tenant isolation
- Organization settings
- Country, currency, timezone, language
- Subscription plan
- Feature entitlements
- Data retention settings

Core entities:

- organization
- business
- location
- department
- subscription
- feature_flag
- tenant_setting

Workflow:

```text
Owner signs up
Create organization
Create first business
Create first location
Invite staff
Configure products or rooms
Start operating
```

Reports:

- Organization usage
- Branch count
- Active users
- Active devices
- Feature adoption
- Subscription health

### Module 2: Authentication And Permissions

Purpose:

Make login fast for frontline workers and secure for admins.

Features:

- Email login for owners and managers
- PIN login for POS and staff terminals
- Device authorization
- Refresh tokens
- Session management
- Role-based access control
- Permission groups
- Manager approvals
- Two-factor authentication for owners
- Staff deactivation
- Login audit trail

Roles:

- owner
- regional_manager
- branch_manager
- supervisor
- cashier
- waiter
- chef
- receptionist
- housekeeping
- maintenance
- stock_controller
- accountant
- auditor

Sensitive actions requiring approval:

- Void order
- Refund
- Large discount
- Stock adjustment
- Cash drawer adjustment
- Room rate override
- Credit limit increase
- Staff permission change
- Delete or deactivate record

Reports:

- Login history
- Failed PIN attempts
- Permission changes
- Manager overrides
- Suspicious login activity

### Module 3: Audit Logs

Purpose:

Every important change must be traceable.

Features:

- Immutable audit events
- Actor, action, entity, before, after
- Reason required for destructive actions
- IP and device metadata
- Offline audit event queue
- Search and filtering
- Exportable audit reports

Audit event examples:

- order_voided
- discount_applied
- refund_issued
- stock_adjusted
- room_rate_overridden
- staff_pin_changed
- payment_reconciled
- customer_credit_limit_changed

Reports:

- Voids by staff
- Discounts by staff
- Refunds by staff
- Stock adjustments
- Permission changes
- Audit export by date range

### Module 4: Notifications

Purpose:

Deliver operational alerts and customer messages across the right channels.

Channels:

- WhatsApp
- SMS
- Email
- Push notification
- In-app notification
- Webhook

Features:

- Templates
- Localization
- Delivery status
- Retry queue
- Quiet hours
- Escalation rules
- Customer opt-in
- Notification preferences

Operational alerts:

- Low stock
- Branch offline
- Cash variance
- Large refund
- Kitchen delay
- Room not ready
- VIP guest arriving
- Stockout predicted
- High churn customer

Customer messages:

- Digital receipt
- Loyalty update
- Booking confirmation
- Order status
- Feedback request
- Birthday offer
- Win-back campaign
- Gift card balance

### Module 5: CRM And Customer Intelligence

Purpose:

Create a unified customer profile across restaurants, hotels, and retail.

Customer data sources:

- Digital receipts
- M-Pesa phone numbers
- QR ordering
- WhatsApp
- Reservations
- Loyalty
- Gift cards
- Wi-Fi capture
- Online ordering
- Feedback
- Mobile app

Features:

- Customer profile
- Phone as primary identifier
- Email and identity merge
- Visit history
- Order history
- Booking history
- Purchase history
- Preferences
- Allergies
- Favorite products
- Favorite rooms or packages
- Tags
- Notes
- Loyalty points
- Loyalty tiers
- Credit account
- Gift cards
- Feedback history
- Consent management

Customer attributes:

- name
- phone
- email
- birthday
- gender optional
- address optional
- country
- language preference
- visit count
- total spend
- average spend
- last visit date
- favorite items
- favorite branch
- LTV
- churn score
- loyalty tier
- credit balance

Reports:

- New customers
- Returning customers
- Top customers
- At-risk customers
- Customer lifetime value
- Cohorts
- Retention
- Loyalty usage
- Credit balances
- Feedback trends

### Module 6: Payments Integration Layer

Purpose:

Accept payment through local and global payment rails without becoming a payment
processor in phase one.

Payment methods:

- Cash
- M-Pesa
- Airtel Money
- EVC Plus
- eDahab
- Zaad
- Card terminal
- Stripe
- Flutterwave
- Paystack
- Loyalty points
- Gift card
- Customer credit
- Bank transfer

Features:

- Split payments
- Partial payments
- Tips
- Deposits
- Refunds
- Payment reversals
- Payment status polling
- Webhook handling
- Reconciliation
- Offline cash mode
- Offline QR fallback
- Settlement reports

Workflows:

```text
Order or booking created
Payment method selected
Payment request initiated
Provider confirms payment
Receipt issued
Ledger updated
Reconciliation queue updated
```

Reports:

- Payments by method
- Failed payments
- Pending payments
- Reconciled payments
- M-Pesa variance
- Cash variance
- Refunds
- Tips
- Deposits outstanding

### Module 7: Inventory Core

Purpose:

Create one inventory foundation that supports food, retail products, hotel
supplies, housekeeping items, and maintenance parts.

Features:

- Items
- Products
- Ingredients
- SKUs
- Variants
- Units of measure
- Batches
- Serial numbers
- Expiry dates
- Stock levels
- Warehouses
- Storage locations
- Branch inventory
- Transfers
- Stock counts
- Adjustments
- Reservations
- Wastage
- Reorder points
- Safety stock
- Inventory valuation

Inventory workflows:

```text
Supplier
Purchase order
Approval
Receiving
Quality check
Storage
Usage or sale
Stock deduction
Reorder alert
Reporting
```

Reports:

- Inventory valuation
- Fast movers
- Slow movers
- Dead stock
- Stock aging
- Expiry risk
- Stockouts
- Transfers
- Adjustments
- Wastage
- Supplier performance

### Module 8: Procurement And Suppliers

Purpose:

Help businesses buy smarter, avoid stockouts, and control supplier costs.

Features:

- Supplier profiles
- Supplier catalogs
- Purchase orders
- RFQs
- Approval workflows
- Partial receiving
- Supplier returns
- Price history
- Supplier credit tracking
- Delivery notes
- Invoice matching
- WhatsApp purchase order sending
- Suggested purchase orders from ML

Reports:

- Supplier lead time
- Supplier cost trend
- Supplier quality issues
- Ordered vs received
- Supplier credit outstanding
- Purchase order aging
- Procurement spend

### Module 9: Staff And Labor

Purpose:

Track people, shifts, attendance, performance, and labor cost.

Features:

- Staff profiles
- Roles and permissions
- PIN login
- Clock in and out
- Optional selfie verification
- Scheduling
- Shift swaps
- Break tracking
- Attendance
- Overtime
- Performance metrics
- Commissions
- Tips allocation
- Staff loans or salary advances
- Payroll export or integration
- Staff deactivation

Reports:

- Attendance
- Late arrivals
- No-shows
- Overtime
- Labor cost
- Sales by cashier
- Sales by waiter
- Voids by staff
- Discounts by staff
- Tips by staff
- Staff performance ranking

### Module 10: Finance And Ledger

Purpose:

Give owners reliable financial visibility without building a full accounting
system in phase one.

Features:

- Revenue ledger
- Payment ledger
- Cash drawer sessions
- Expenses
- Cost of goods sold
- Taxes
- Deposits
- Credit accounts
- Gift card liability
- Supplier payables
- P&L summaries
- Accounting exports
- Accounting integrations

Reports:

- Daily revenue
- Monthly revenue
- P&L
- Cash flow
- Tax summary
- Gross margin
- Net margin
- COGS
- Expense categories
- Gift card liability
- Customer credit outstanding
- Supplier payable outstanding

### Module 11: Reporting

Purpose:

Make every operational workflow measurable.

Report capabilities:

- Saved reports
- Scheduled reports
- PDF export
- CSV export
- Email delivery
- WhatsApp delivery
- Role-based report access
- Report comments
- Drill-down
- Comparison periods
- Branch comparison

Shared reports:

- Sales report
- Payment report
- Customer report
- Inventory report
- Staff report
- Audit report
- Tax report
- Profit report
- Branch comparison
- Product performance
- Forecast report

### Module 12: BI Dashboards

Purpose:

Turn raw reports into decision dashboards.

Dashboards:

- Executive dashboard
- Branch dashboard
- Restaurant dashboard
- Hotel dashboard
- Retail dashboard
- Customer dashboard
- Inventory dashboard
- Staff dashboard
- Finance dashboard
- AI recommendations dashboard

Executive dashboard:

- Revenue
- Profit
- Customers
- Branches
- Forecasts
- Alerts
- Recommendations
- Top risks
- Top opportunities

Branch dashboard:

- Revenue
- Profit
- Transactions
- Staff on duty
- Inventory alerts
- Customer feedback
- Offline status
- Ranking vs other branches

### Module 13: AI Layer

Purpose:

Provide plain-language explanations, recommendations, and automations.

AI principles:

- Explain the data behind every recommendation.
- Use business language, not technical language.
- Route simple tasks through deterministic logic.
- Use LLMs for summarization, reasoning, and natural language.
- Keep humans in control for financial or destructive actions.

AI features:

- Morning briefing
- Daily close summary
- Natural language business questions
- Revenue explanation
- Inventory recommendations
- Staff recommendations
- Menu recommendations
- Promotion suggestions
- Guest upsell suggestions
- Customer win-back messages
- Report narrative summaries
- Anomaly explanation
- WhatsApp ordering assistant
- Owner AI assistant

Example:

```text
Good morning.

Yesterday revenue was KES 142,000, up 12% from last Tuesday.

Main drivers:
1. Dinner traffic increased by 18%.
2. Chicken platter sold 42 units.
3. Average ticket increased from KES 820 to KES 910.

Risks:
1. Chicken stock may run out in 2 days.
2. Cash variance at closing was KES 1,200.

Recommended actions:
1. Order 18 kg of chicken today.
2. Review cashier shifts between 8 PM and 10 PM.
3. Add one extra server on Friday evening.
```

### Module 14: ML Platform

Purpose:

Use historical data to forecast, score, rank, detect, and recommend.

ML lifecycle:

```text
Events captured
Data cleaned
Features generated
Model trained
Model evaluated
Prediction served
Prediction monitored
Recommendation displayed
Outcome tracked
```

Model families:

- Forecasting
- Classification
- Ranking
- Anomaly detection
- Recommendation
- Optimization
- Segmentation

Core models:

- Revenue forecasting
- Demand forecasting
- Stockout prediction
- Occupancy forecasting
- Customer churn
- Guest churn
- Customer lifetime value
- Fraud detection
- Recommendation engine
- Staffing forecast
- Inventory optimization
- Dynamic pricing
- Promotion effectiveness
- Next best action
- Autonomous business agent

### Module 15: Offline Sync

Purpose:

Keep businesses operating during internet outages, power issues, and unreliable
connectivity.

Offline requirements:

- POS must continue selling offline.
- Cash payments must always work.
- Offline orders must queue locally.
- Offline audit events must queue locally.
- Sync must resume automatically.
- Users must see offline status clearly.
- Conflicts must be resolved predictably.

Offline architecture:

```text
Client device
Local SQLite database
Local operation log
Background sync
API sync endpoint
PostgreSQL
Conflict resolver
Audit log
```

Offline features:

- Offline login cache
- Offline product catalog
- Offline pricing
- Offline customer lookup cache
- Offline order creation
- Offline cash payments
- Offline receipt printing
- Offline queue visibility
- Conflict resolution
- Sync status
- Branch offline alerts

Conflict examples:

- Same stock adjusted on two devices
- Product price changed while device offline
- Customer profile updated on two devices
- Order paid on one device and edited on another

Conflict rules:

- Financial events are append-only.
- Audit events are append-only.
- Product settings use server version after sync.
- Orders merge by operation log when possible.
- Stock uses movement ledger, not direct overwrite.
- Manual review queue handles unresolved conflicts.

### Module 16: Integration Framework

Purpose:

Make external systems pluggable without rewriting core workflows.

Integration types:

- Payments
- Messaging
- Accounting
- Delivery
- Hospitality channels
- Ecommerce
- Marketing
- Analytics
- Storage
- Tax
- Hardware

Integration features:

- Provider registry
- Credentials vault
- Webhook handling
- Retry queue
- Rate limit handling
- Idempotency keys
- Mapping configuration
- Sync logs
- Error dashboard
- Manual retry
- Sandbox mode

### Module 17: Developer Platform And Public API

Purpose:

Every global leader we benchmark against (Toast, Square, Clover, Revel) wins
part of its market not on POS features alone but on being a platform other
software is built on top of. This module is what turns the product from a
closed POS into a platform: a stable external API, an app ecosystem, and a
hardware partner program. It is deliberately separate from Module 16
(Integration Framework), which is inbound/outbound plumbing we build and
own; Module 17 is the surface third-party developers who are not us build
against.

Public API:

- Versioned, external-facing surface at `/api/v1/...`, entirely distinct
  from the internal app API used by our own POS/manager/owner clients.
  Internal endpoints can change freely between releases; `/api/v1` cannot.
- Resource coverage at launch: orders (read, create), products/catalog
  (read, write), customers (read, write), inventory levels (read),
  payments (read), reports/analytics summaries (read).
- Every response uses the same envelope as the internal API (section 26),
  so client code and our own documentation examples stay consistent.
- API versioning policy: breaking changes always ship as a new version
  (`/api/v2`); a version is supported for a minimum 12 months after the
  next version ships, with a visible deprecation notice (response header +
  developer portal banner + email to registered app owners) starting the
  day the new version ships.

Authentication and authorization:

- Two auth modes: **API keys** (simple server-to-server integrations, one
  key per merchant, merchant-generated in the developer portal) and
  **OAuth 2.0 authorization-code flow** (for installed marketplace apps
  that act on behalf of a merchant who explicitly grants access).
- Scope model, granted per key/app, never implicit: `pos:read`, `pos:write`,
  `orders:read`, `orders:write`, `products:read`, `products:write`,
  `customers:read`, `customers:write`, `inventory:read`, `inventory:write`,
  `reports:read`, `webhooks:manage`, `admin:write`. An app requests the
  scopes it needs; the merchant sees exactly what they're granting at
  install time.
- Tokens are short-lived and refreshable (OAuth) or long-lived but
  merchant-revocable at any time from the owner dashboard (API keys). A
  revoked key/token fails closed immediately, not on next cache expiry.
- Every external-facing token is tied to one `organization_id`; there is no
  cross-tenant token. This is the same tenant-isolation rule as the
  internal API, extended outward.

Rate limiting and idempotency:

- Standard tier: 60 requests/minute per key/token. Bulk/sync tier (catalog
  push, initial data import): 600 requests/minute, opt-in per app after
  review. `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  headers on every response; `429` with `Retry-After` when exceeded.
- Every state-mutating call (and all payment-adjacent calls without
  exception) requires an `Idempotency-Key` header; replays with the same
  key return the original result rather than repeating the effect. Same
  rule as the internal payments API (section 26), extended to the whole
  public write surface, not payments alone.

Webhooks for third-party developers:

- A merchant (or the app they installed) can register webhook
  subscriptions via `POST /api/v1/webhooks`, list them
  (`GET /api/v1/webhooks`), and remove them (`DELETE /api/v1/webhooks/:id`)
  — this is a developer-facing subscription registry, distinct from the
  inbound webhooks Module 16 receives from payment/commerce/delivery
  providers.
- Event catalog at launch: `order.created`, `order.updated`,
  `order.voided`, `order.refunded`, `payment.received`,
  `payment.completed`, `payment.failed`, `stock.alert.critical`,
  `inventory.low_stock`, `customer.created`, `customer.loyalty_tier`,
  `staff.clock_in`, `staff.clock_out`, `report.daily.ready`. New event
  types are additive, never repurpose an existing event name.
- Every outbound webhook is signed (`HMAC-SHA256` over the raw payload,
  secret shown once at subscription time), delivered within 30 seconds of
  the triggering event, and retried with exponential backoff on non-2xx or
  timeout. A subscription that fails consistently is auto-paused and
  surfaced to the developer in the portal, not silently dropped forever.

Sandbox:

- Every registered developer app gets a sandbox mode: a dedicated test
  tenant seeded with demo data, test-mode API keys that never touch real
  money or a real kitchen, and a "send test event" button per webhook
  subscription in the developer portal so an integration can be built and
  demoed before a live merchant installs it.
- Sandbox and production keys are visually distinct in every response and
  in the portal (test keys prefixed, e.g. `sk_test_...` vs `sk_live_...`)
  so a developer cannot accidentally point a production install at test
  data or vice versa.

Developer portal and SDKs:

- Public developer docs site: API reference generated from an OpenAPI
  spec (kept in lockstep with the actual API, not hand-maintained
  separately), quick-start guides per resource, a Postman collection, and
  a changelog.
- Official SDKs: JavaScript/TypeScript and Python at launch, generated
  from the same OpenAPI spec so they never drift from the documented
  contract.
- App registration console: a developer creates an app, sets requested
  scopes, redirect URLs (for OAuth apps), and webhook endpoint; sees
  per-app usage analytics (calls/day, error rate, webhook delivery
  success rate) so they can self-diagnose before opening a support
  ticket.

App marketplace:

- Merchant-facing install flow: browse by category (accounting, delivery,
  marketing, vertical-specific add-ons — e.g. veterinary practice
  management, beauty/salon scheduling, auto-parts lookup, targeted at
  local African software companies who want to build on top of this
  platform rather than build a POS from scratch), review requested
  scopes, one-click install/uninstall.
- Revenue share: a published split (modeled on the ~70/30 pattern common
  across Clover/Shopify-style app stores, exact number is a business
  decision at launch, not an engineering one) on any paid app sold through
  the marketplace; free apps are always free to install.
- App review process before an app is publicly listed: scope
  justification, basic security review (no plaintext credential storage,
  webhook signature verification present), functional test in sandbox.
  Apps used privately by a single merchant (custom integrations) skip
  public listing but still go through the same OAuth scope-grant UX.
- White-label / franchise tier: large multi-branch or franchise groups can
  request a branded API/portal instance (their name, their domain) instead
  of building on the standard marketplace surface — same underlying API,
  different presentation layer.

Hardware partner program:

- Certification path for third-party POS terminal, printer, scanner, and
  cash-drawer vendors (modeled on the PAXSTORE-style "app store on
  hardware" pattern): a published hardware integration SDK, a
  certification checklist, and a public list of certified devices in the
  developer portal so merchants know what "just works" before buying
  hardware.
- Certified hardware partners get a dedicated support channel and early
  access to API changes that affect device-level integrations (printing,
  card-reader, barcode scanning).

Enterprise controls:

- Large accounts (enterprise/franchise tier) can request IP allowlisting
  on their API keys, a dedicated (higher) rate-limit tier with an SLA, and
  programmatic audit-log export via the API rather than only the admin
  console UI.

New schema for this module (add to `DATA_MODEL.md` under a "Developer
Platform" section when this phase starts): `developer_apps`, `api_keys`,
`oauth_grants`, `oauth_tokens`, `webhook_subscriptions`,
`webhook_deliveries`, `api_usage_logs`, `marketplace_listings`,
`marketplace_installs`.

### Module 18: Africa Market Compliance And Localization

Purpose:

Tax compliance is the single biggest forcing function for POS adoption in
several target markets right now, not a nice-to-have. In Kenya, KRA's
eTIMS mandate (effective January 2026) rejects tax returns not backed by
an eTIMS-compliant receipt, with penalties up to KES 1,000,000 or 10% of
the tax due, and closure orders are possible for repeat non-compliance.
A restaurant owner cannot legally operate without this — it outranks
almost every other feature in this document for the Kenya launch market.
This module is where every requirement that is specific to operating in
African markets — not generic to any POS — lives, so it stays a first-class,
tracked part of the plan instead of scattered assumptions.

Tax compliance (pluggable per country, same adapter pattern as Module 16):

- **Kenya — KRA eTIMS**: every receipt includes the business's KRA PIN,
  the ETR (Electronic Tax Register) serial number, and a KRA-issued QR
  code; every sale is submitted to eTIMS in real time (or queued and
  submitted the moment connectivity returns — this is why Module 15
  Offline Sync must treat tax submission as a sync-tracked operation, not
  a fire-and-forget call); a daily Z-report is submitted automatically;
  ESD (Electronic Signature Device) sign-off is captured where required.
  Ship this before any other country's tax integration — it is the
  unblock for the first paying cohort.
- **Nigeria — FIRS e-invoicing** and **South Africa — SARS**: same
  adapter pattern, built when those markets are prioritized on the
  roadmap; do not hardcode Kenya-only assumptions into the tax module's
  interface.

Power resilience:

- Detect power loss / load-shedding windows (many target markets have
  scheduled outages that land during dinner rush) via device battery
  discharge rate and, where the terminal hardware exposes it, a
  mains-power-loss signal. This is a detection and UX layer on top of
  Module 15's offline sync, not a replacement for it — offline must
  already be full-capability, not degraded, for this to matter.
- UX during a detected outage: a persistent "running on battery, X minutes
  remaining" banner, automatic screen dimming, non-essential features
  (analytics dashboards, non-urgent sync) disabled to conserve battery,
  and automatic failover to a mobile hotspot if the primary router loses
  power before the POS device does.

Mobile money integrity:

- Staff M-Pesa (and other mobile money) fraud detection: if a confirmed
  payment references a till/paybill/phone number that is not one of the
  business's registered receiving numbers, raise an immediate flag to the
  manager — this is the concrete defense against a waiter quietly
  redirecting a customer's payment to a personal number, described in
  market research as "virtually undetectable without a reconciled POS."
- Automated reconciliation of mobile money SMS confirmations against
  system-recorded payments, replacing a manual nightly line-by-line
  reconciliation that otherwise costs 30-60 minutes per location per
  night.

Informal and low-connectivity access:

- USSD access (`*XXX#` dial flow) for feature-phone use: record a sale,
  check today's running total, add stock — a lightweight parallel entry
  point for the most informal segment of the market, not a replacement
  for the full app.
- Informal-sector mode: no-barcode inventory entry (photo + name + price
  instead of a SKU lookup), bulk/loose selling priced by weight, a
  cash-only drawer mode that hides card/mobile-money payment options
  entirely rather than showing unusable buttons, and a daily summary
  delivered in the owner's local language.

Community and credit finance:

- Chama/SACCO group-savings integration: auto-route a configurable
  percentage of daily net profit to a linked savings account.
- Supplier credit (informal "Mkopo") tracking: who the business owes,
  payment due schedule, and a WhatsApp reminder sent ahead of the due
  date ("before the supplier comes").
- Customer credit tab ("Oweame") mechanics, extending the `customer_credit`
  primitive already in Module 5/6: per-customer credit limit set by a
  manager, an automatic WhatsApp statement sent on the 1st of each month,
  a credit-risk flag on any balance outstanding more than 30 days, and
  manager-PIN gating on any credit-limit increase.

Multi-currency and cross-border trade:

- Real-time exchange-rate feed from the relevant central bank API, a
  forex-move alert when the rate has moved more than 2% since prices were
  last updated, and dual-currency, tax-compliant receipts for businesses
  trading across a border — positioned for AFCFTA-era cross-border retail
  and hospitality trade.

Denomination-aware cash handling:

- A change calculator that works in the local currency's actual
  denominations (e.g. KES 1000/500/200/100/50 notes and coins), not just
  a decimal amount.
- A mid-shift short-change alert if a cashier makes repeated
  (3+ in one shift) change-calculation errors, in addition to the
  shift-close denomination count already specified in section 23.

Local language:

- Full UI translation (Swahili/Sheng at launch, extensible per market),
  staff-set language preference per user, receipts printed in the
  customer's selected language, and AI/WhatsApp assistant responses that
  work in the local language including code-switched queries (e.g.
  "Niuambie mauzo yangu ya jana" — "tell me yesterday's sales").

## 7. Restaurant OS

### Restaurant Workflow

```text
Procurement
Inventory
Prep
Open shift
Reservations
Waitlist
Table assignment
Order
Kitchen
Serve
Payment
Tips
Close shift
Reporting
Marketing
```

### Restaurant User Types

- Owner
- Regional manager
- Branch manager
- Supervisor
- Cashier
- Waiter
- Chef
- Bar staff
- Host
- Stock controller
- Accountant
- Auditor
- Customer

### Front Of House Features

- Counter POS
- Table service POS
- Handheld ordering
- Floor plan
- Table status
- Table merge
- Table split
- Table transfer
- Reservations
- Waitlist
- QR ordering
- Kiosk ordering
- Customer display
- Tips
- Split bill by item
- Split bill by seat
- Split bill evenly
- Split-check payment link per seat (each diner gets an individual
  WhatsApp/SMS payment link and pays their own share from their own phone)
- Bar tabs with card pre-authorization (open a tab against a card hold or
  a mobile-money deposit hold, accumulate charges, settle at close)
- Dual pricing / cash-card surcharging (display and charge a card price
  that includes the processing surcharge alongside a lower cash price)
- Gift cards
- Digital receipts
- Customer feedback
- Drive-thru mode (order-ahead lane, vehicle/order pairing, time-in-lane
  tracking, one-tap reorder for recognized regulars)

### Order Management Features

- Open order
- Add items
- Modifiers
- Modifier groups
- Combos
- Course management
- Seat numbers
- Notes to kitchen
- Hold and fire
- Discounts
- Voids
- Refunds
- Reprint receipt
- Order status
- Order history
- Order source tracking

Order channels:

- POS terminal
- Server handheld
- QR table ordering
- Kiosk
- WhatsApp
- Phone (caller-ID matched to customer history — recognize the inbound
  number, load their last order, one-word "same as last time?" confirm)
- Online ordering page
- Delivery integration

### Multi-Brand And Ghost Kitchen Features

- Run multiple virtual brands out of one physical kitchen, each with its
  own menu, own order channel (own delivery-platform storefronts), and
  its own color-coded lane on the KDS
- Brand-level performance comparison (revenue, margin, order volume per
  virtual brand)
- Cross-brand upsell suggestions at checkout
- Shared-ingredient stockout alerts (an ingredient used by two brands
  triggers one alert, not two)

### Kiosk And Self-Ordering Features

- Self-service ordering kiosk as a first-class channel, not a shrunk POS
  screen: large-format touch UI, accessibility mode (screen reader,
  high-contrast, larger targets)
- AI-driven upsell prompts at the kiosk, A/B tested for conversion
- Gamified loyalty reveal at checkout (e.g. a scratch-card-style reveal of
  a loyalty reward) to encourage phone-number capture
- Cash payment support with a change-dispenser hardware flow where
  installed, alongside card and mobile money

### Kitchen Features

- Kitchen display system
- Station routing
- Grill station
- Bar station
- Cold station
- Pastry station
- Expo screen
- Ticket timers
- Bump item
- Bump ticket
- Recall ticket
- Allergy alerts
- Prep tasks
- Kitchen printer fallback
- Cook time analytics
- AI-adjusted cook-time estimates (learns actual time per item per
  station, not a static menu-level estimate)
- Cross-station coordination alerts (grill running behind while cold
  station is idle triggers a rebalance prompt, not a silent delay)
- Order consolidation / production batching (batch identical items across
  concurrent tickets so the station cooks one pass, not N separate ones)
- Recipe/plating photo displayed on the ticket for new or infrequently
  made items
- Rush and VIP ticket visual differentiation on the KDS/expo screen
- Pour cost tracking at the bar station: actual liquor poured vs.
  theoretical pour per recipe, drink recipe display for bartenders, tab
  transfer between bar staff, batch-close-all-tabs at night

### Menu Features

- Categories
- Products
- Product photos
- Local language names
- Modifiers
- Add-ons
- Combos
- Set menus
- Price books
- Happy hour pricing
- Staff meal pricing
- Catering pricing
- Mark item unavailable
- Recipe management
- Ingredient costing
- Food cost percentage
- Menu engineering with a price-simulation slider (drag a proposed price,
  see the item's star/plowhorse/puzzle/dog quadrant update live) and a
  seasonal overlay (an item's quadrant can shift by month — e.g. a Star in
  December, a Dog in August — shown, not collapsed into one number)
- Time-based day-part menus with automatic switching (breakfast → lunch →
  dinner) and a 5-minute pre-switch manager alert
- Ramadan/Iftar mode: automatic switch to an Iftar menu at the
  location-based sunset time during Ramadan, with Iftar pre-order support

### Inventory And Recipe Features

- Ingredients
- Recipes
- Recipe ingredients
- Prep batches
- Wastage
- Stock deductions
- Low stock alerts
- Purchase orders
- Supplier credit
- Stock count
- Stock adjustment
- Inter-branch transfer
- Suggested reorder

### Restaurant CRM Features

- Customer profile
- Phone-based identity
- Order history
- Favorite items
- Allergies
- Loyalty points
- Loyalty tiers
- Birthday offers
- Win-back campaigns
- Credit tabs
- Customer feedback
- Gift cards
- Tags
- Notes
- Review and sentiment monitoring (ingest Google/Yelp/delivery-app
  reviews and QR-ordering dish ratings, alert on a new negative review,
  surface trending complaints before they show up in a report cycle)
- QR-ordering dish-level ratings fed back to the kitchen and menu
  engineering in near-real-time, not just aggregated after the fact

### Restaurant Payments

- Cash
- M-Pesa
- Airtel Money
- Card
- Split payment
- Tips
- Loyalty points
- Gift cards
- Customer credit
- Deposit for reservation
- Deposit for catering

Embedded financial services (modeled on Toast Capital / Square Banking /
Lightspeed Capital — build as a partnership with a licensed lender, not as
a lender ourselves):

- Merchant cash advance sized as a percentage of trailing monthly GMV,
  repaid automatically as a percentage of daily sales rather than a fixed
  installment
- Business wallet with automatic tax-savings sub-account (auto-sets aside
  a configurable percentage, e.g. 16% VAT-equivalent, of revenue as it's
  earned)
- Automatic M-Pesa till sweep into the business wallet on a schedule
- Chama/SACCO auto-routing of a configured share of profit (see Module 18)

### Restaurant Reports

Sales:

- Daily sales
- Weekly sales
- Monthly sales
- Sales by hour
- Sales by category
- Sales by product
- Sales by channel
- Average ticket
- Revenue per table
- Revenue per seat
- Anonymized peer benchmark (this location vs. similar locations by city,
  category, and price tier — see Competitive Benchmarking below)

Operations:

- Table turnover
- Wait time
- Kitchen ticket time
- Void report
- Discount report
- Refund report
- Shift summary
- Close shift report
- Real-time shift P&L (live revenue, labor cost, food cost, and gross
  profit mid-service, not only at shift close)
- Delivery platform performance (per-platform order volume, cancellation
  rate, commission cost, throttling events during rush windows)
- Supplier invoice variance (flags a price change vs. the last invoice
  from the same supplier — see Restaurant AI Features)

Inventory:

- Food cost percentage
- Ingredient usage
- Wastage
- Stockout report
- Low stock report
- Inventory valuation
- Ordered vs received

Staff:

- Sales by waiter
- Sales by cashier
- Voids by staff
- Discounts by staff
- Tips by staff
- Attendance
- Labor cost percentage

Customer:

- Top customers
- New customers
- Returning customers
- Churn risk
- Loyalty activity
- Feedback
- Customer LTV

Finance:

- Cash reconciliation
- M-Pesa reconciliation
- Tax summary
- P&L summary
- Gross margin
- Credit tabs outstanding

### Competitive Benchmarking

A named, top-priority differentiator across the researched leaders
(most explicitly Lightspeed) and repeatedly called out as a retention
moat for the target market: a merchant who only sees their own numbers
has no idea if they're doing well; a merchant who can see "you're in the
top 20% of similar restaurants in Nairobi for average ticket, bottom
30% for table turnover" has a reason to keep paying and keep improving.

- Peer group defined by city, restaurant category, and price tier — never
  by named competitor.
- Anonymized aggregation only: a peer group must contain a minimum of 10
  merchants before any benchmark is shown, to make any single competitor
  unidentifiable from the numbers.
- Positive framing rule: benchmarks are shown as an opportunity
  ("you're 15% below peer average on dessert attach rate") not a
  scoreboard of shame; never rank-order named businesses.
- Benchmarked metrics at launch: average ticket, table turnover, revenue
  per seat, food cost percentage, dessert/beverage attach rate.
- Feeds the owner dashboard (below) and the AI daily briefing.

### Restaurant BI Dashboards

Owner dashboard:

- Live revenue
- Profit estimate
- Branch performance
- Peer benchmark comparison
- Alerts
- Forecasts
- Recommendations

Manager dashboard:

- Shift sales
- Staff on duty
- Open orders
- Kitchen delays
- Stock alerts
- Cash drawer status

Kitchen dashboard:

- Tickets by station
- Average prep time
- Delayed tickets
- Items 86ed
- Station load

Customer dashboard:

- Retention
- Loyalty
- Customer segments
- Win-back list
- Feedback trends

### Restaurant ML Models

Revenue forecasting:

- Predict daily and hourly revenue.
- Inputs: historical sales, day of week, holidays, weather, events, branch,
  and the African-market-specific signals that make this forecast useful
  rather than generic: `days_after_payday` (spending surges in the days
  following month-end/mid-month payroll cycles), `is_school_term`,
  `is_rainy_season`, local market-day flags, and Ramadan/Iftar calendar
  effects.
- Output: expected revenue and confidence range (quantile regression, not
  a single point estimate).
- Fallback: when a location has under 14 days of history, fall back to a
  simple moving average rather than a model with no reliable signal.
- Used by: owner dashboard, staffing, inventory planning.

Demand forecasting:

- Predict product and ingredient demand.
- Inputs: item sales, recipes, seasonality, events, weather, plus the same
  payday/school-term/market-day/Ramadan calendar features as revenue
  forecasting.
- Output: expected quantity needed.
- Used by: purchase orders, prep planning, stockout prevention.

Stockout prediction:

- Predict items likely to run out.
- Inputs: current stock, sales velocity, pending POs, forecast demand.
- Output: a tiered risk score, not a flat list — Critical (stocks out
  within 24h), Warning (within 3 days), Planned (within 7 days, already
  on an open PO), Watch (trending down, no action needed yet). A merchant
  should not receive more than 3 stock alerts in one day; consolidate
  same-day alerts into one notification rather than firing one per item.
- Used by: manager alerts, procurement.

Waste and prep intelligence:

- Predict pre-service how much of a prepped batch will actually sell,
  e.g. "you prepped 40 portions, will sell approximately 28, hold the
  remaining 12" — a prep-planning signal distinct from post-hoc wastage
  reporting.
- Inputs: prep batch size, historical sell-through of the same item on
  comparable dayparts, demand forecast.
- Output: recommended hold-back quantity and timing.
- Used by: kitchen prep planning, wastage reduction.

Customer churn:

- Predict customers unlikely to return.
- Inputs: recency, frequency, monetary value, visit trend, feedback.
- Output: churn probability and recommended action.
- Used by: WhatsApp win-back campaigns.

Menu engineering:

- Classify products into stars, plowhorses, puzzles, and dogs.
- Inputs: margin, volume, trend, prep time, waste.
- Output: promote, reprice, reposition, or retire recommendation.
- Used by: menu optimization.

Fraud and anomaly detection:

- Detect unusual voids, discounts, refunds, and cash variances against
  concrete, tunable thresholds rather than an opaque score alone: a
  sales drop of 40%+ below the same weekday's 4-week average, a food-cost
  spike of 8%+ above baseline, a staff void rate 3x the location average
  (or exceeding 5% of that staff member's revenue), a cash variance
  exceeding a configured amount (default KES 500-equivalent), or a
  transaction 5x the location's average order value.
- Inputs: staff behavior, shift patterns, transaction history.
- Output: anomaly score, the specific threshold crossed, and a
  plain-language explanation.
- Used by: owner alerts and audit review.

Competitive benchmarking:

- Compare a location's key metrics against an anonymized peer group
  sharing city, category, and price tier (see Competitive Benchmarking
  above for the privacy rule: minimum 10 merchants per peer group).
- Inputs: average ticket, table turnover, revenue per seat, food cost
  percentage, attach rates — this location's values plus the peer group's
  distribution.
- Output: percentile rank per metric with positive framing, never a
  named-competitor comparison.
- Used by: owner dashboard, AI daily briefing.

Staffing forecast:

- Predict staffing needs by daypart.
- Inputs: reservations, sales forecast, weather, historical labor.
- Output: recommended staff count by role.
- Used by: scheduling.

Recommendation engine:

- Recommend add-ons during checkout.
- Inputs: cart, historical baskets, time of day, customer preferences.
- Output: suggested items.
- Used by: POS upsell and QR ordering.

### Restaurant AI Features

- Morning briefing to owner
- Manager pre-shift briefing
- Kitchen delay explanation
- Natural language sales query (works in English and local languages —
  see Module 18 — e.g. "Niuambie mauzo yangu ya jana")
- Menu recommendation summary
- Stock reorder explanation
- Customer win-back message generation
- Feedback summary
- Staff performance explanation with specific, actionable coaching notes
  per underperforming staff member (not just a flagged metric)
- WhatsApp order parsing
- Supplier invoice OCR: photograph a paper invoice, AI extracts line
  items and prices, flags any price that changed versus the same
  supplier's last invoice
- Waste and prep hold-back suggestions (see Restaurant ML Models)
- Review and sentiment summary across Google/Yelp/delivery-app reviews
  and QR dish ratings, with trending-complaint detection

Specialized agents, not one general assistant: the AI layer is organized
as a small set of task-specific agents (promotions, pricing, scheduling,
waste reduction, staff coaching, daily digest) that each own one
narrow job and hand off structured output to the briefing/notification
layer, rather than a single model asked to do everything at once.

Example restaurant AI briefing:

```text
Revenue yesterday was KES 186,400, up 9% from last Tuesday.

Chicken platter and passion juice drove most of the growth.
Food cost increased because chicken supplier prices rose by 7%.

Recommended actions:
1. Order chicken today before 2 PM.
2. Add one waiter on Friday dinner shift.
3. Promote passion juice with lunch combos.
```

## 8. Hotel OS

### Hotel Workflow

```text
Availability search
Reservation
Booking confirmation
Pre-arrival message
Check-in
Room assignment
Guest services
Housekeeping
Maintenance
Restaurant or spa charges
Check-out
Payment
Feedback
Reporting
Retention
```

### Hotel User Types

- Owner
- General manager
- Revenue manager
- Front office manager
- Receptionist
- Housekeeping manager
- Housekeeper
- Maintenance
- Restaurant manager
- Accountant
- Auditor
- Guest

### Reservation Features

- Booking engine
- Availability calendar
- Rate plans
- Room types
- Room inventory
- Reservation deposits
- Group bookings
- Corporate bookings
- Waitlists
- Booking notes
- Guest preferences
- Cancellation policies
- No-show handling
- Booking modifications

### Front Desk Features

- Check-in
- Check-out
- Room assignment
- Guest profile
- ID capture
- Deposit handling
- Folio
- Extra charges
- Room move
- Late checkout
- Early check-in
- Key card integration later
- Guest requests

### Room Management Features

- Room types
- Room status
- Availability
- Room rates
- Dynamic pricing
- Out of order rooms
- Maintenance hold
- Housekeeping status
- Room inspection

Room statuses:

- available
- occupied
- reserved
- cleaning
- inspected
- maintenance
- out_of_order

### Housekeeping Features

- Task assignment
- Room cleaning checklist
- Inspection checklist
- Lost and found
- Linen tracking
- Minibar tracking
- Priority rooms
- Cleaning time tracking
- Maintenance issue reporting

### Maintenance Features

- Work orders
- Preventive maintenance
- Room issue tracking
- Asset tracking
- Parts usage
- Priority levels
- SLA tracking
- Maintenance history

### Guest CRM Features

- Guest profile
- Preferences
- Stay history
- Spend history
- Loyalty
- VIP status
- Special requests
- Feedback
- Complaint history
- Upsell history
- Birthday or anniversary

### Hotel Revenue Features

- Rate plans
- Seasonal pricing
- Dynamic pricing recommendations
- Occupancy forecast
- ADR tracking
- RevPAR tracking
- Packages
- Upsells
- Corporate rates
- Channel performance

### Channel Management Features

Phase one can start with manual or limited integrations. Later phases add:

- Booking.com
- Airbnb
- Expedia
- Agoda
- Google Hotel Ads
- Direct booking engine
- Channel inventory sync
- Rate sync
- Reservation import

### PMS Integration For Restaurant Room-Charge

For a hotel property that also runs Restaurant OS on its F&B outlets
(modeled on the Lightspeed/Oracle MICROS pattern): a `POST
/hotel/room-charge` endpoint that posts a restaurant bill directly to a
guest's folio instead of taking payment at the table, with the charge
appearing on the folio (see Hotel Detailed Build Spec, Folio Rules) and
settling at checkout through the standard hotel night-audit process. When
the hotel side of the property runs on a third-party PMS (e.g. Opera,
Protel, Mews) rather than this platform's own Hotel OS, the same
room-charge posting goes out through a PMS adapter in
`packages/integrations` (same adapter pattern as Module 16) instead of
writing to a local folio table.

### Hotel Payments

- Cash
- Card
- M-Pesa
- Airtel Money
- Deposit
- Split folio
- Corporate account
- Guest credit
- Refund
- No-show fee

### Hotel Reports

Revenue:

- Occupancy
- ADR
- RevPAR
- Revenue by room type
- Revenue by channel
- Revenue by package
- Upsell revenue

Operations:

- Arrivals
- Departures
- Stayovers
- No-shows
- Cancellations
- Room status
- Housekeeping productivity
- Maintenance tickets

Guest:

- Guest satisfaction
- Repeat guests
- VIP guests
- Complaints
- Preferences
- Guest churn

Finance:

- Deposit report
- Folio balances
- Payment reconciliation
- Tax report
- Corporate account aging
- P&L

### Hotel BI Dashboards

General manager dashboard:

- Occupancy
- ADR
- RevPAR
- Arrivals
- Departures
- Guest issues
- Maintenance issues
- Forecasts

Reception dashboard:

- Today's arrivals
- Today's departures
- Rooms ready
- Rooms not ready
- VIP guests
- Open balances

Housekeeping dashboard:

- Assigned rooms
- Cleaning status
- Inspection queue
- Delayed rooms
- Maintenance blockers

Revenue dashboard:

- Occupancy forecast
- ADR trend
- RevPAR trend
- Channel performance
- Pricing recommendations

### Hotel ML Models

Occupancy forecasting:

- Predict occupancy by date and room type.
- Inputs: booking pace, seasonality, events, holidays, cancellations.
- Output: expected occupancy and confidence range.
- Used by: staffing, pricing, owner dashboard.

Dynamic pricing:

- Recommend room rate changes.
- Inputs: occupancy forecast, competitor rates if available, seasonality, demand.
- Output: suggested rates by room type and date.
- Used by: revenue manager.

Guest churn:

- Predict guests unlikely to return.
- Inputs: stay history, satisfaction, complaints, booking frequency.
- Output: churn score and win-back action.
- Used by: marketing automation.

Upsell recommendation:

- Recommend packages or add-ons.
- Inputs: guest profile, stay purpose, booking type, past spend.
- Output: upsell suggestion.
- Used by: pre-arrival and front desk.

Housekeeping staffing forecast:

- Predict cleaning workload.
- Inputs: arrivals, departures, stayovers, room types, cleaning times.
- Output: housekeepers needed by shift.
- Used by: housekeeping scheduling.

Maintenance prediction:

- Predict recurring maintenance issues.
- Inputs: asset age, room history, ticket patterns.
- Output: risk score and preventive task.
- Used by: maintenance manager.

### Hotel AI Features

- Daily GM briefing
- Reception shift briefing
- Guest complaint summary
- Review sentiment summary
- Room pricing explanation
- Maintenance priority explanation
- Guest upsell message generation
- Natural language hotel queries

Example hotel AI briefing:

```text
Occupancy tonight is 87% and forecast to reach 95% on Saturday.

Risks:
1. Six rooms are still waiting for inspection.
2. Two VIP guests arrive before noon.
3. Standard rooms are nearly sold out.

Recommended actions:
1. Prioritize inspection for rooms 204, 205, and 301.
2. Increase Saturday standard room rate by 8%.
3. Offer suite upgrades to corporate guests arriving Friday.
```

## 9. Retail OS

### Retail Workflow

```text
Supplier
Purchase order
Approval
Receive inventory
Quality check
Warehouse
Shelf placement
Customer purchase
Payment
Returns or exchanges
Inventory update
Accounting
Analytics
Marketing
Retention
```

### Retail User Types

- Owner
- Regional manager
- Store manager
- Cashier
- Stock controller
- Warehouse staff
- Procurement officer
- Accountant
- Auditor
- Customer

### Retail POS Features

- Fast checkout
- Barcode scanning
- Product search
- Multiple carts
- Saved carts
- Suspend transaction
- Quotes
- Invoices
- Discounts
- Coupons
- Gift cards
- Store credit
- Returns
- Exchanges
- Refunds
- Split payments
- Customer display
- Receipt printing
- Digital receipts

### Retail Inventory Features

- Products
- Variants
- SKUs
- Barcodes
- Serial numbers
- Batch numbers
- Expiry dates
- Bundles
- Kits
- Warehouses
- Bin locations
- Transfers
- Stock counts
- Stock adjustments
- Safety stock
- Reorder points
- Inventory reservations
- Inventory valuation

Variant example:

```text
Product: Nike Shoe
Sizes: 40, 41, 42
Colors: Black, White, Blue
```

### Retail Procurement Features

- Purchase orders
- Supplier catalogs
- RFQs
- Approval workflow
- Partial receiving
- Supplier returns
- Cost tracking
- Supplier lead time
- Suggested reorder

### Retail Omnichannel Features

- Store sales
- Website sales
- WhatsApp commerce
- Instagram orders
- Facebook orders
- Marketplace orders
- Buy online, pick up in store
- Ship from store
- Return anywhere
- Unified inventory
- Unified customer profile
- Unified reporting

### Retail Extended Sales Models

Called out repeatedly across competitor research (NCR Counterpoint, KORONA
POS) as African-market-relevant differentiators beyond a standard
sell-now checkout:

- Layaway / rent-to-own: deposit at start, scheduled installment payments,
  goods released only once the balance (or an agreed threshold) is paid,
  automatic reminder before each installment is due, and a defined
  forfeiture policy if payments lapse.
- Rentals: due-date and deposit tracking, damage/condition notes at
  checkout and return, automatic late-return fee calculation.
- Job cards (repairs and services): a job card tracks intake → diagnosis →
  quote approval → in-progress → ready → collected, with WhatsApp status
  pushes to the customer at each stage — same underlying state-machine
  pattern as an order, applied to a service instead of a product.
- Event ticketing: QR ticket issuance and sale, door-scanner check-in
  mode, capacity tracking, and refund/transfer handling.
- Franchise/chain royalty engine: automatic royalty calculation as a
  percentage of branch sales, a branch compliance score (opens on time,
  buys only from approved suppliers, stays within margin thresholds), and
  an HQ-set price floor that branches cannot undercut without override.

### Retail CRM Features

- Customer profile
- Purchase history
- Favorite products
- Loyalty points
- Loyalty tiers
- Coupons
- Cashback
- Store credit
- Birthday offers
- Churn score
- LTV
- Segments

### Retail Finance Features

- Revenue
- Expenses
- Margins
- P&L
- Taxes
- Cash flow
- COGS
- Stock valuation
- Store credit liability
- Gift card liability

### Retail Reports

Sales:

- Daily sales
- Weekly sales
- Monthly sales
- Annual sales
- Hourly sales
- Sales by category
- Sales by product
- Sales by cashier
- Sales by branch

Inventory:

- Inventory valuation
- Dead stock
- Fast movers
- Slow movers
- Stock aging
- Stockouts
- Expiry risk
- Shrinkage
- Transfers

Customer:

- Top customers
- New customers
- Returning customers
- Churn
- LTV
- Segments
- Loyalty activity

Finance:

- P&L
- Taxes
- Cash flow
- Margin by product
- Margin by branch

Staff:

- Attendance
- Sales by cashier
- Commission
- Refunds by cashier
- Performance

### Retail BI Dashboards

Owner dashboard:

- Revenue
- Profit
- Customers
- Inventory value
- Branches
- Growth
- Alerts
- Forecasts

Inventory dashboard:

- Fast movers
- Slow movers
- Dead stock
- Stockouts
- Expiry risk
- Reorder suggestions

Customer dashboard:

- LTV
- Retention
- Churn
- Segments
- Loyalty

Operations dashboard:

- Branches
- Suppliers
- Employees
- Warehouses
- Stock transfers

### Retail ML Models

Revenue forecasting:

- Predict sales by branch, category, and product.
- Inputs: sales history, promotions, seasonality, holidays.
- Output: expected revenue.
- Used by: owner dashboard and procurement.

Demand forecasting:

- Predict product demand.
- Inputs: historical sales, seasonality, promotions, price changes.
- Output: expected units sold.
- Used by: purchasing and inventory planning.

Stockout prediction:

- Predict which SKUs will run out.
- Inputs: stock on hand, sales velocity, pending POs, lead time.
- Output: stockout risk and reorder date.
- Used by: stock controller.

Customer churn:

- Predict customers likely to stop buying.
- Inputs: recency, frequency, monetary value, categories purchased.
- Output: churn probability and offer suggestion.
- Used by: marketing automation.

Customer lifetime value:

- Predict future customer spend.
- Inputs: spend history, purchase frequency, product categories.
- Output: predicted spend and tier recommendation.
- Used by: loyalty and promotions.

Fraud detection:

- Detect abnormal refunds, discounts, and cash variances.
- Inputs: cashier behavior, refund rates, transaction history.
- Output: anomaly score.
- Used by: owner and auditor.

Recommendation engine:

- Recommend related products.
- Inputs: basket history, customer preferences, inventory.
- Output: next best product.
- Used by: cashier upsell and WhatsApp commerce.

Inventory optimization:

- Recommend reorder quantities.
- Inputs: demand forecast, lead time, safety stock, holding cost.
- Output: purchase quantity.
- Used by: procurement.

Promotion effectiveness:

- Estimate promotion impact.
- Inputs: past promotions, sales uplift, margin, customer segments.
- Output: expected lift and margin impact.
- Used by: marketing.

Supplier performance prediction:

- Predict supplier delays or quality issues.
- Inputs: supplier history, lead time, discrepancy rate.
- Output: risk score.
- Used by: procurement.

### Retail AI Features

- Daily retail briefing
- Inventory risk summary
- Supplier recommendation explanation
- Promotion suggestions
- Natural language inventory query
- Customer segment summary
- WhatsApp commerce assistant
- Slow-moving stock action plan

Example retail AI briefing:

```text
Revenue yesterday was KES 92,300, up 18%.

Top product: 2 kg rice.

Alerts:
1. Milk may stock out tomorrow.
2. Branch 3 has unusually high refunds.
3. Cooking oil margin dropped by 4%.

Recommended actions:
1. Increase milk order by 25%.
2. Review Branch 3 refund activity.
3. Check supplier price change for cooking oil.
```

## 10. Customer-Facing Products

### QR Ordering

Features:

- Scan table QR
- View menu
- Add items
- Customize modifiers
- Submit order
- Live order status timeline ("received", "in the kitchen", "on its way")
- Multi-phone shared table basket: several diners at the same table scan
  and order independently into the same open order, each seeing the
  shared cart, and each able to pay only their own items at bill time
- Fire next course (guest-triggered "send the next course now" for
  multi-course meals, distinct from a single flat order submit)
- Rate a dish immediately after it's served, fed back to kitchen/menu
  engineering in near-real-time
- Pay now or pay later
- Join loyalty
- Request waiter
- Leave feedback

### WhatsApp Ordering

Features:

- Customer sends order in natural language
- System parses simple orders locally
- Complex messages escalate to AI
- Customer confirms order
- Payment link or M-Pesa prompt
- Order appears in POS or KDS
- Receipt sent on WhatsApp

### Online Ordering

Features:

- Branded ordering page
- Pickup
- Delivery
- Menu availability
- Online payment
- Customer login optional
- Loyalty capture
- Order status

### Booking Engine

Features:

- Hotel availability search
- Room selection
- Guest details
- Deposit
- Confirmation
- Pre-arrival message
- Upsell offers

### Loyalty Wallet

Features:

- Points balance
- Tier status
- Rewards
- Gift cards
- Store credit
- Receipts
- Offers

## 11. Hardware Ecosystem

Supported hardware:

- Android tablets
- Android phones
- Receipt printers
- Kitchen printers
- Cash drawers
- Barcode scanners
- Customer displays
- Weighing scales
- Card terminals
- Label printers
- Kiosks
- Handheld POS devices

Hardware principles:

- Android first
- Low-cost devices first
- Local network printing
- Bluetooth printing
- USB printing
- Offline operation
- Device authorization
- Device health monitoring

## 12. Technical Architecture

Full rationale and alternatives considered for every choice below:
`docs/adr/0001-tech-stack.md`.

### Recommended Stack

Monorepo:

- pnpm
- Turborepo
- TypeScript project references where useful

Internal web apps:

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand
- React Hook Form
- Zod

Use for:

- Manager Portal
- Owner Dashboard
- Kitchen Display System
- Internal Admin Console
- Developer Portal

Customer-facing web apps:

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Explicit performance budget (small bundle, aggressive code splitting) —
  reached via QR-code scan or direct link on cheap Android phones over
  patchy 3G/4G, not organic search, so SSR/SEO isn't worth the weight

Use for:

- QR ordering
- Online ordering
- Booking engine
- Loyalty wallet
- Digital receipts

Public marketing and docs site:

- Astro
- Ships near-zero JS by default — this surface is mostly static content
  and actually benefits from SEO, unlike the customer ordering apps above

Mobile:

- React Native, bare/dev-client workflow (not managed Expo Go — most POS
  peripherals need native modules Expo Go doesn't support)
- SQLite on device
- PowerSync for the download/replication path (catalog, prices, tables,
  settings streamed from Postgres); custom upload-queue + operation log
  for the write path (see section 27 and ADR 0001 decision 6)

Use for:

- Restaurant POS
- Waiter handheld
- Cashier tablet
- Manager mobile workflows later

Desktop POS:

- Tauri
- React
- SQLite

Use later for:

- Counter terminals
- Larger cashier stations
- Environments where native desktop packaging matters

Backend:

- NestJS
- TypeScript
- Modular monolith, Domain-Driven Design module boundaries
- WebSocket Gateways (Socket.io) for live KDS/table push updates
- class-validator/Zod validation
- OpenAPI
- Pino logging

Use for:

- POS workflows
- Payments
- Offline sync
- Inventory ledgers
- Multi-tenancy
- Permissions
- Audit logs
- Shared contracts with web/mobile clients

AI/ML service:

- FastAPI
- Python
- scikit-learn
- XGBoost
- LightGBM
- PyTorch later
- MLflow later

Use for:

- Forecasting
- Churn scoring
- Recommendations
- Anomaly detection
- AI briefings
- Embeddings and retrieval

Database:

- PostgreSQL
- Row-level tenant isolation, enforced as an actual PostgreSQL Row-Level
  Security policy on every tenant-scoped table
  (`organization_id = current_setting('app.current_org_id')::uuid`), not
  only an `organization_id = ?` clause hand-added to every query — RLS is
  the backstop for the query someone forgets to scope.
- JSONB where useful
- Partitioning later
- pgvector first for embeddings

Cache and queues:

- Redis
- BullMQ

Search:

- Postgres full-text search (`pg_trgm`) first
- Meilisearch added only once that's insufficient (ADR 0001 decision 8)

Analytics:

- PostgreSQL first
- ClickHouse later
- dbt
- Metabase for internal BI
- Custom dashboards for customers

AI:

- OpenAI
- Anthropic
- Provider adapter
- Tool-calling business assistant
- Retrieval over business data

Storage:

- Cloudflare R2

Infrastructure:

- Docker Compose in local development
- Fly.io or Hetzner + Coolify in production — chosen over a hyperscaler
  or Kubernetes specifically for African hosting economics and low
  solo-builder ops overhead
- Kubernetes later only when operationally justified

Observability:

- Sentry
- OpenTelemetry
- Prometheus
- Grafana
- Uptime Kuma

Product analytics:

- PostHog

The operating principle:

```text
TypeScript runs the business.
Python runs the intelligence.
PostgreSQL protects the truth.
SQLite protects the frontline.
ClickHouse powers analytics once scale arrives.
```

### Architecture Shape

Start with a modular monolith.

Do not start with microservices.

```text
Clients
|
+-- Manager Web (React + Vite)
+-- Owner Web (React + Vite)
+-- KDS Web (React + Vite)
+-- Developer Portal (React + Vite)
+-- Customer Web (React + Vite, bandwidth-budgeted)
+-- Marketing/Docs (Astro)
+-- POS Mobile (React Native bare/dev-client + SQLite, synced via PowerSync)
+-- Desktop POS later (Tauri + SQLite)
|
NestJS TypeScript Modular Monolith
|
+-- Auth module
+-- Organization module
+-- Restaurant module
+-- Hotel module later
+-- Retail module later
+-- CRM module
+-- Inventory module
+-- Payment module
+-- Reporting module
+-- Integration module
+-- Offline sync module (operation log + conflict rules; PowerSync owns
    the replication transport)
|
PostgreSQL (Neon)
Redis
Cloudflare R2
PowerSync service
Meilisearch later
Python FastAPI AI/ML service
ClickHouse later
```

### Data Pipeline

```text
PostgreSQL
Outbox/events
Custom ELT or Airbyte later
ClickHouse later
dbt
Metabase internal BI
Custom customer dashboards
Feature store later
ML models
AI summaries
```

### Event Strategy

Year 1:

- PostgreSQL transactional tables
- Outbox table
- BullMQ workers
- Redis queues/cache
- Webhooks

Year 2+:

- Add Kafka only if event volume and team maturity justify it.

### API Principles

- REST first
- OpenAPI documented
- Idempotency keys for payments and sync
- Cursor pagination
- Consistent response envelope
- Problem details for errors
- Tenant context on every request
- Audit event for important changes
- Webhooks for external systems

## 13. Data Model Outline

Shared:

- organizations
- businesses
- locations
- departments
- users
- staff
- roles
- permissions
- sessions
- devices
- audit_logs
- notifications
- files
- feature_flags
- subscriptions

CRM:

- customers
- customer_identities
- customer_tags
- loyalty_accounts
- loyalty_events
- gift_cards
- customer_credit_accounts
- feedback
- marketing_campaigns

Payments:

- payment_intents
- payments
- refunds
- payment_provider_events
- reconciliations
- cash_drawer_sessions
- tips
- deposits

Inventory:

- suppliers
- supplier_catalog_items
- purchase_orders
- purchase_order_items
- goods_receipts
- inventory_items
- products
- variants
- stock_locations
- stock_levels
- stock_movements
- stock_counts
- stock_adjustments
- transfers
- recipes
- recipe_ingredients

Restaurant:

- menus
- menu_categories
- menu_items
- modifier_groups
- modifiers
- price_books
- floor_plans
- tables
- reservations
- waitlist_entries
- orders
- order_items
- order_courses
- kitchen_tickets
- kds_stations
- catering_orders

Hotel:

- properties
- room_types
- rooms
- rate_plans
- reservations
- stays
- folios
- folio_charges
- housekeeping_tasks
- maintenance_tickets
- guest_requests
- channel_bookings

Retail:

- retail_products
- retail_variants
- barcodes
- serial_numbers
- batches
- carts
- sales
- sale_items
- returns
- exchanges
- quotes
- invoices
- coupons
- omnichannel_orders

Analytics and ML:

- events
- report_snapshots
- forecast_runs
- predictions
- recommendation_events
- anomaly_events
- model_versions
- ai_briefings

## 14. AI And ML Model Catalog

### Revenue Forecasting

Applies to:

- Restaurant
- Hotel
- Retail

Predicts:

- Daily revenue
- Hourly revenue
- Branch revenue
- Category revenue

Features:

- Historical revenue
- Day of week
- Seasonality
- Holidays
- Weather
- Events
- Promotions
- Occupancy
- Reservations
- Customer traffic

Outputs:

- Forecast value
- Confidence interval
- Drivers
- Risk factors
- Recommended actions

### Demand Forecasting

Applies to:

- Restaurant
- Retail

Predicts:

- Product demand
- Ingredient demand
- SKU demand

Features:

- Historical sales
- Menu or product category
- Recipe mapping
- Promotions
- Seasonality
- Stockouts
- Price changes

Outputs:

- Expected quantity
- Reorder recommendation
- Prep recommendation
- Stockout risk

### Occupancy Forecasting

Applies to:

- Hotel

Predicts:

- Occupancy by date
- Occupancy by room type
- Arrival volume
- Departure volume

Features:

- Booking pace
- Historical occupancy
- Channel data
- Events
- Holidays
- Cancellation trends

Outputs:

- Occupancy forecast
- Staffing recommendation
- Pricing recommendation

### Stockout Prediction

Applies to:

- Restaurant
- Retail
- Hotel supplies

Predicts:

- Item stockout probability
- Estimated stockout date

Features:

- Stock on hand
- Sales velocity
- Usage velocity
- Lead time
- Pending purchase orders
- Safety stock

Outputs:

- Risk score
- Reorder date
- Suggested quantity
- Supplier suggestion

### Customer Churn

Applies to:

- Restaurant
- Retail

Predicts:

- Probability a customer will not return

Features:

- Recency
- Frequency
- Monetary value
- Trend
- Feedback
- Loyalty activity
- Offer response

Outputs:

- Churn score
- Reason codes
- Recommended campaign
- Suggested offer

### Guest Churn

Applies to:

- Hotel

Predicts:

- Probability a guest will not book again

Features:

- Stay frequency
- Last stay
- Satisfaction
- Complaints
- Spend
- Channel

Outputs:

- Churn score
- Win-back message
- Offer suggestion

### Customer Lifetime Value

Applies to:

- Restaurant
- Hotel
- Retail

Predicts:

- Expected future spend
- Expected future visits

Features:

- Historical spend
- Visit frequency
- Customer age
- Category mix
- Loyalty behavior

Outputs:

- LTV
- Confidence
- Tier suggestion
- Credit limit suggestion

### Fraud And Anomaly Detection

Applies to:

- Restaurant
- Hotel
- Retail

Detects:

- Void spikes
- Refund abuse
- Discount abuse
- Cash variance
- Inventory shrinkage
- Room rate overrides
- Suspicious login behavior

Features:

- Staff history
- Shift behavior
- Transaction patterns
- Branch baseline
- Time of day

Outputs:

- Anomaly score
- Explanation
- Suggested investigation

### Recommendation Engine

Applies to:

- Restaurant
- Retail
- Hotel

Recommends:

- Add-on items
- Related products
- Upsells
- Guest packages
- Next best action

Features:

- Basket history
- Customer profile
- Inventory availability
- Time
- Margin
- Popularity

Outputs:

- Recommended item
- Expected value
- Explanation

### Staffing Forecast

Applies to:

- Restaurant
- Hotel
- Retail

Predicts:

- Staff required by role and shift

Features:

- Revenue forecast
- Reservations
- Foot traffic
- Occupancy
- Transactions
- Historical service times

Outputs:

- Required staff count
- Role mix
- Understaffing risk
- Labor cost estimate

### Inventory Optimization

Applies to:

- Restaurant
- Retail
- Hotel supplies

Recommends:

- Reorder quantities
- Safety stock
- Transfer opportunities

Features:

- Demand forecast
- Lead time
- Holding cost
- Stockout cost
- Supplier reliability

Outputs:

- Suggested purchase order
- Suggested transfer
- Expected savings

### Dynamic Pricing

Applies to:

- Hotel first
- Restaurant events later
- Retail promotions later

Recommends:

- Room rates
- Package rates
- Promotion pricing

Features:

- Demand
- Occupancy
- Seasonality
- Competitor data if available
- Booking pace

Outputs:

- Suggested price
- Expected revenue impact
- Risk level

### Promotion Effectiveness

Applies to:

- Restaurant
- Retail
- Hotel packages

Predicts:

- Sales lift
- Margin impact
- Customer response

Features:

- Historical promotions
- Customer segments
- Product margins
- Seasonality

Outputs:

- Recommended promotion
- Target segment
- Expected lift
- Expected margin

### Autonomous Business Agent

Applies to:

- Owner and manager workflows

Capabilities:

- Read dashboards
- Explain performance
- Draft campaigns
- Draft purchase orders
- Draft schedules
- Draft reports
- Watch anomalies
- Recommend actions
- Ask for approval before execution

Guardrails:

- No autonomous refunds
- No autonomous payments
- No autonomous staff termination
- No autonomous price changes without approval
- No destructive action without audit log

## 15. Roadmap

### Phase 0: Foundation

Goal:

Create the product base.

Build:

- Monorepo
- Docker Compose
- Database schema
- Auth
- Organizations
- Locations
- Staff
- Permissions
- Audit logs
- Product catalog
- Basic POS API
- Health checks
- Seed data

Exit criteria:

- Local environment runs.
- API is healthy.
- Database migrations run cleanly.
- PIN login works.
- Tenant isolation works.

### Phase 1: Restaurant MVP

Goal:

A real restaurant can sell daily.

Build:

- POS
- Products
- Categories
- Tables
- Orders
- KDS
- Cash payments
- M-Pesa integration
- Receipts
- Shift close
- Basic inventory
- Customer profile
- Loyalty basics
- Manager portal
- Owner dashboard
- Offline order queue

Exit criteria:

- One restaurant can take dine-in and counter orders.
- Kitchen receives tickets.
- Cash and M-Pesa payments work.
- Receipts work.
- Owner sees daily sales.
- Offline mode can take cash orders.

### Phase 2: Restaurant Operating Depth

Goal:

Become operationally useful beyond checkout.

Build:

- Reservations
- Waitlist
- Split bills
- Tips
- Refunds
- Voids
- Discounts
- Inventory receiving
- Purchase orders
- Recipes
- Food costing
- Wastage
- Staff attendance
- Scheduling
- WhatsApp receipts
- WhatsApp ordering beta
- Reports

Exit criteria:

- Manager can run daily operations.
- Owner can understand margins.
- Staff activity is auditable.
- Inventory has useful alerts.

### Phase 3: Hospitality OS

Goal:

Add hotel workflows on shared platform.

Build:

- Properties
- Room types
- Rooms
- Reservations
- Availability calendar
- Check-in
- Check-out
- Folios
- Housekeeping
- Maintenance
- Guest profiles
- Deposits
- Hotel reports

Exit criteria:

- Small hotel or lodge can manage bookings and room operations.
- Guest profiles are shared with CRM.
- Restaurant charges can connect to guest folio.

### Phase 4: Intelligence Layer

Goal:

Make the product smarter than traditional POS/PMS tools.

Build:

- Revenue forecasting
- Demand forecasting
- Stockout prediction
- Churn prediction
- Customer LTV
- Menu engineering
- Occupancy forecasting
- AI morning briefing
- Natural language reporting
- Anomaly detection

Exit criteria:

- Owners receive useful daily recommendations.
- Forecasts are visible and measured.
- ML outputs drive real workflows.

### Phase 5: Retail OS

Goal:

Add inventory-heavy commerce workflows.

Build:

- Retail POS
- Barcode scanning
- Variants
- SKUs
- Batches
- Serial numbers
- Returns
- Exchanges
- Quotes
- Invoices
- Warehouses
- Supplier catalogs
- Retail dashboards
- Retail ML

Exit criteria:

- Retail businesses can sell, manage stock, and reorder intelligently.

### Phase 6: Ecosystem

Goal:

Become a platform.

Full spec for everything in this phase: Module 17 (Developer Platform And
Public API) in section 6.

Build:

- Public API
- Developer docs
- Webhooks
- App marketplace
- Partner portal
- Hardware partner program
- Integration marketplace
- Enterprise controls

Exit criteria:

- Third parties can build on the platform.
- Partners can onboard integrations safely.

## 16. MVP Scope

### Restaurant MVP

Must have:

- PIN login
- Products
- Categories
- POS cart
- Orders
- Tables
- KDS
- Cash payment
- M-Pesa payment
- Receipt
- Shift close
- Basic customer profile
- Basic reports
- Offline cash orders
- Owner dashboard

Should have:

- Inventory counts
- Low stock alerts
- WhatsApp receipts
- Staff attendance
- Basic loyalty

Not in MVP:

- Full payroll
- Lending
- Banking
- Marketplace
- Dynamic pricing
- Complex hotel workflows
- Full retail omnichannel

### Hotel MVP

Must have:

- Room types
- Rooms
- Availability calendar
- Reservations
- Check-in
- Check-out
- Folio
- Payments
- Housekeeping status
- Guest profile
- Occupancy report

Should have:

- Deposits
- Guest messages
- Maintenance tickets
- Revenue dashboard

Not in MVP:

- Full channel manager
- Key card integration
- Advanced revenue management

### Retail MVP

Must have:

- POS
- Products
- SKUs
- Barcode scanning
- Stock levels
- Cash and mobile money payments
- Returns
- Basic customer profile
- Daily sales
- Inventory report

Should have:

- Variants
- Purchase orders
- Supplier profiles
- Loyalty

Not in MVP:

- Marketplace
- Full ecommerce
- Advanced warehouse management

## 17. Success Metrics

### North Star Metric

Gross Merchandise Volume (GMV) processed through the platform is the one
metric that forces every team to care about the same outcome: merchants
actually selling more, not just logging in. Every other metric in this
section is a supporting signal, not a competing priority.

### Target Thresholds

Concrete numbers, not just metric names to track — these are the bars a
metric needs to clear to be considered healthy, revisited at each roadmap
phase boundary (section 15):

- 90-day merchant retention: greater than 80%.
- Daily active merchant (at least one staff login or POS action that day):
  greater than 70% of active locations.
- WhatsApp receipt/notification delivery success rate: greater than 90%.
- Offline sync success rate (operations that sync cleanly with no manual
  conflict resolution): greater than 99.5%.
- Churn interview policy: when a merchant cancels, ask exactly one
  question before offering to help them leave — a long exit survey
  depresses response rate and yields worse signal than one well-chosen
  question answered by nearly everyone.

### Business Metrics

- Active businesses
- Active locations
- Monthly transaction volume
- Gross payment volume tracked
- Monthly recurring revenue
- Churn rate
- Net revenue retention
- Average revenue per account
- Time to first sale

### Product Metrics

- Orders per active location
- Offline orders synced successfully
- Payment success rate
- Receipt delivery rate
- Daily active staff
- Weekly active owners
- Report views
- AI briefing open rate
- Recommendation acceptance rate

### Operational Metrics

- API uptime
- Sync failure rate
- Queue failure rate
- Payment webhook latency
- Error rate
- Average POS action latency
- Database query latency

### Customer Outcome Metrics

- Revenue growth
- Reduced stockouts
- Reduced wastage
- Improved table turnover
- Improved occupancy
- Improved customer retention
- Reduced cash variance
- Reduced manual reporting time

## 18. What To Build First

The first build path should be boring, useful, and revenue-focused:

1. Database and tenant foundation
2. Auth and permissions
3. Audit logs
4. Product catalog
5. POS order flow
6. Cash payment
7. M-Pesa payment
8. Receipt
9. KDS
10. Shift close
11. Basic reports
12. Offline cash orders
13. Customer profile
14. Inventory basics
15. Owner dashboard
16. WhatsApp receipts
17. AI daily briefing

This earns the right to build the rest.

## 19. Final Commitment

The company should start by solving one problem extremely well:

Help African restaurants operate better, make better decisions, and grow faster.

Then expand into hospitality, retail, intelligence, integrations, and eventually
financial products only after earning trust.

The long-term product is:

```text
The AI-Powered Hospitality and Commerce Operating System for Africa
```

Built on:

- Operational workflows
- Offline-first architecture
- Customer intelligence
- AI recommendations
- ML forecasting
- BI dashboards
- East African localization
- Trusted integrations
- Simple UX
- Reliable infrastructure

This is the decade-scale product.

## 20. Development Operating Manual

This section converts the vision into a buildable product specification.

### How To Use This File

Use this document as the product and engineering source of truth. When building
a feature, every ticket should answer:

1. Which user role needs this?
2. Which screen owns the action?
3. Which module owns the data?
4. What permissions are required?
5. What audit event is written?
6. What happens offline?
7. What report or dashboard uses the data?
8. What is the happy path?
9. What are the failure states?
10. What is the acceptance test?

### Industry Patterns To Follow

The product should follow patterns proven by leading systems:

- Restaurant POS should support fast payment, split checks, tips, receipts, and
  closing orders from the service flow.
- Full-service restaurants need floor plans, bills/checks, table movement,
  item movement, coursing, and kitchen workflows.
- Retail POS needs role-based permissions for sensitive work such as returns,
  discounts, cash tracking, and inventory actions.
- Hotel PMS workflows should center daily operations around arrivals,
  departures, room status, folios, housekeeping, and payments.
- Housekeeping should have room condition, front desk status, assigned cleaners,
  bulk actions, print/export lists, and inspection status.

### Product Design Rule

Each role gets a narrow workspace:

- Waiter sees tables, orders, payment, and tips.
- Cashier sees checkout, returns, receipts, and cash drawer.
- Manager sees exceptions, approvals, staff, inventory, and reports.
- Owner sees money, risk, trends, and recommendations.
- Chef sees only production work.
- Receptionist sees arrivals, departures, rooms, folios, and guest requests.
- Housekeeping sees assigned rooms and checklists.
- Stock controller sees receiving, transfers, counts, and variances.

Do not give everyone one giant admin dashboard.

### Build Priority Rule

Build features in this order:

1. Transaction correctness
2. Offline safety
3. Permissions and audit logs
4. Operational speed
5. Reporting
6. ML and AI
7. Automation

AI should never compensate for weak core workflows.

### Data Integrity Rules

Financial and inventory systems should use ledgers, not overwrites.

Use append-only movement records for:

- Payments
- Refunds
- Tips
- Cash drawer activity
- Gift card balance changes
- Loyalty points
- Customer credit
- Stock movements
- Recipe deductions
- Room folio charges
- Audit events

Mutable summary tables are allowed for performance, but they must be
rebuildable from source events.

### Naming Rule

Use business language in product and code:

- `order`
- `bill`
- `payment`
- `refund`
- `table`
- `room`
- `folio`
- `stock_movement`
- `shift`
- `cash_drawer_session`
- `audit_log`

Avoid vague names:

- `thing`
- `record`
- `data`
- `payload`
- `misc`

## 21. Product Surfaces

### POS Terminal

Users:

- Cashier
- Waiter
- Supervisor
- Manager

Devices:

- Android tablet
- Android phone
- Desktop POS later
- Tauri counter terminal later

Primary jobs:

- Sell quickly
- Work offline
- Print or send receipts
- Take payments
- Send food to kitchen
- Close orders

Screens:

- PIN login
- Device activation
- Location selector
- Mode selector
- Product grid
- Cart
- Table floor plan
- Order detail
- Payment
- Split bill
- Tips
- Receipt
- Offline queue
- Shift open
- Shift close
- Cash drawer count

Critical latency targets:

- Product tap adds to cart in under 150 ms locally.
- Cart total recalculates instantly.
- Open table loads in under 500 ms from local cache.
- Cash payment can complete fully offline.
- Sync should never block order entry.

### Kitchen Display System

Users:

- Chef
- Kitchen staff
- Expo
- Manager

Devices:

- Android tablet
- Web browser screen
- Kitchen printer fallback

Screens:

- Station queue
- Ticket detail
- All-day item count
- Delayed tickets
- Ready queue
- Recalled tickets
- Item unavailable

States:

- new
- accepted
- in_progress
- ready
- served
- recalled
- voided

Critical behavior:

- Tickets appear by station.
- Timers are visible.
- Allergies are prominent.
- Item notes are readable.
- Bump action is one tap.
- Offline/local-network fallback is planned for later.

### Manager Portal

Users:

- Branch manager
- Supervisor
- Stock controller
- Accountant

Screens:

- Today dashboard
- Live service
- Orders
- Inventory
- Receiving
- Purchase orders
- Staff
- Attendance
- Cash reconciliation
- Payments
- Customers
- Reports
- Audit log
- Settings

Primary jobs:

- Run the branch today.
- Fix operational exceptions.
- Approve risky actions.
- Keep inventory accurate.
- Close the day cleanly.

### Owner Dashboard

Users:

- Owner
- Regional manager
- Investor/operator

Screens:

- Executive overview
- Branch comparison
- Revenue
- Profit
- Customers
- Forecasts
- AI briefing
- Alerts
- Recommendations
- Reports
- Billing

Primary jobs:

- Know if the business is healthy.
- Know what changed.
- Know what to do next.
- Compare branches.
- Catch risk early.

### Customer Web

Users:

- Restaurant customer
- Hotel guest
- Retail shopper

Surfaces:

- QR ordering
- Online ordering
- Booking engine
- Loyalty wallet
- Digital receipts
- Feedback form
- Gift card balance

Primary jobs:

- Order or book without friction.
- Pay easily.
- Receive confirmation.
- Return through loyalty and offers.

### Admin Console

Users:

- Internal support
- Implementation team
- System admin

Screens:

- Tenant search
- Location search
- Device status
- Sync status
- Integration logs
- Payment provider events
- Feature flags
- Billing status
- Support impersonation with audit trail

Rules:

- Every support action is audited.
- Impersonation requires reason.
- Support cannot see secrets.
- Support cannot issue refunds without explicit elevated permission.

## 22. Permission And Approval Matrix

### Permission Groups

Create permissions as named capabilities, not hard-coded role checks.

Sales:

- `orders:create`
- `orders:update_own`
- `orders:update_any`
- `orders:void_item`
- `orders:void_bill`
- `orders:discount_small`
- `orders:discount_large`
- `orders:refund`
- `orders:reopen_closed`

Payments:

- `payments:take_cash`
- `payments:take_mobile_money`
- `payments:take_card`
- `payments:split`
- `payments:refund`
- `payments:cancel`
- `payments:reconcile`

Cash drawer:

- `cash_drawer:open`
- `cash_drawer:count`
- `cash_drawer:adjust`
- `cash_drawer:close`

Inventory:

- `inventory:view`
- `inventory:receive`
- `inventory:adjust`
- `inventory:transfer`
- `inventory:count`
- `inventory:approve_adjustment`

Staff:

- `staff:view`
- `staff:create`
- `staff:update`
- `staff:deactivate`
- `staff:change_pin`
- `staff:schedule`
- `staff:approve_clock`

Reports:

- `reports:view_sales`
- `reports:view_profit`
- `reports:view_staff`
- `reports:view_audit`
- `reports:export`

Hotel:

- `rooms:view`
- `rooms:assign`
- `rooms:change_status`
- `reservations:create`
- `reservations:update`
- `reservations:cancel`
- `folios:add_charge`
- `folios:adjust_charge`
- `folios:close`

Retail:

- `returns:create`
- `returns:approve`
- `products:update_price`
- `stock:receive`
- `stock:transfer`
- `stock:adjust`

### Default Role Permissions

Owner:

- Full access
- Can grant roles
- Can view all reports
- Can approve high-risk actions
- Can configure billing

Regional manager:

- View all assigned branches
- Compare branch performance
- Approve branch-level exceptions
- Transfer stock between branches
- View staff and reports

Branch manager:

- Manage one branch
- Approve voids, discounts, refunds
- Receive stock
- Manage staff shifts
- Close day
- Export branch reports

Supervisor:

- Manage service floor
- Approve small discounts
- Move tables and bills
- Reassign orders
- Handle customer issues

Cashier:

- Create counter orders
- Take payments
- Print receipts
- Process returns only with approval
- Count assigned drawer if enabled

Waiter:

- Create orders for assigned tables
- Add items
- Send to kitchen
- Move own table with approval optional
- Split bills
- Take payments for assigned tables
- Add tips
- Send receipts

Chef:

- View KDS
- Update ticket status
- Mark item unavailable with manager confirmation
- Cannot edit prices
- Cannot take payments

Receptionist:

- Create reservations
- Check guests in and out
- Assign rooms
- Add standard folio charges
- Take hotel payments
- Cannot change room rates beyond threshold without approval

Housekeeping:

- View assigned rooms
- Update cleaning status
- Complete checklist
- Report maintenance
- Cannot see guest financials

Stock controller:

- Receive stock
- Count stock
- Transfer stock
- Propose adjustments
- Large adjustment needs manager approval

Accountant:

- View finance reports
- Reconcile payments
- Export tax reports
- Sync accounting
- Cannot change orders without approval

Auditor:

- View audit logs
- Export audit reports
- Read-only access

### Waiter Payment Policy

Waiters should be allowed to collect payments because table-service restaurants
need fast checkout at the table.

Allowed:

- Take cash payment for assigned table
- Start M-Pesa STK push for assigned table
- Confirm externally paid mobile money payment when provider event arrives
- Take card payment if device is assigned
- Split bill by seat, item, or amount
- Add customer-approved tip
- Send receipt
- Close table

Requires manager approval:

- Refund
- Void after kitchen send
- Discount above configured threshold
- Reopen paid bill
- Delete payment
- Change bill total after payment
- Move paid item to another bill
- Cash variance adjustment

Audit events:

- waiter_payment_taken
- waiter_tip_added
- bill_split
- table_closed
- manager_approval_requested
- manager_approval_granted
- manager_approval_denied

### Approval Workflow

```text
User attempts restricted action
System shows approval request
Manager enters PIN or approves from manager device
System records approval actor and reason
Action executes
Audit log is written
Report metrics update
```

Approval fields:

- requested_by_staff_id
- approved_by_staff_id
- location_id
- action
- entity_type
- entity_id
- reason
- approved_at
- device_id

## 23. Restaurant Detailed Build Spec

### Restaurant Operating States

Location day state:

- not_open
- opening
- open
- closing
- closed

Shift state:

- draft
- open
- closing
- closed
- reconciled

Table state:

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

Order state:

- draft
- open
- sent_to_kitchen
- partially_ready
- ready
- served
- bill_requested
- payment_pending
- paid
- voided
- refunded

Order item state:

- draft
- sent
- accepted
- in_progress
- ready
- served
- void_requested
- voided
- comped

Payment state:

- pending
- processing
- authorized
- paid
- failed
- cancelled
- refunded
- partially_refunded

### Dine-In Happy Path

```text
Waiter logs in with PIN
Waiter opens floor plan
Waiter taps available table
System creates open order
Waiter adds party size
Waiter adds items and modifiers
Waiter taps Send
System creates kitchen tickets by station
KDS displays tickets
Kitchen bumps items ready
Waiter serves table
Customer asks for bill
Waiter opens bill
Waiter optionally splits bill
Waiter selects payment method
Customer pays
System records payment
Receipt is printed or sent
Table moves to cleaning
Manager sees payment in shift report
```

Failure states:

- Kitchen station offline: print fallback ticket.
- Payment provider timeout: keep payment pending and allow retry.
- Device offline: allow cash payment and queue order sync.
- Price changed while offline: preserve price captured at order time.
- Item unavailable after order: manager or kitchen marks 86 and waiter resolves.

Acceptance tests:

- Waiter can complete dine-in cash order with no internet.
- Waiter can split bill and close both bills.
- Kitchen sees only station-relevant items.
- Manager approval is required for void after kitchen send.
- Audit log shows who approved the void.

### Counter-Service Happy Path

```text
Cashier opens POS
Cashier selects products
Cashier adds customer optional
Cashier applies allowed discount optional
Cashier takes payment
System prints receipt
Order closes immediately
Inventory movements are created
Sales report updates
```

Acceptance tests:

- Cashier can sell in under 4 taps for common items.
- Cashier cannot issue refund without permission.
- Product search works by name, local name, SKU, and barcode.

### Kitchen Ticket Routing

Routing rules:

- Each menu category has a default station.
- Each item can override category station.
- Modifiers may print/display under parent item.
- One order can create multiple station tickets.
- Expo can see combined table ticket.

Example:

```text
Order 104 - Table 7

Grill station:
- 2 Chicken platter
- 1 Beef skewers

Bar station:
- 2 Passion juice
- 1 Soda
```

KDS actions:

- accept ticket
- start item
- mark item ready
- bump ticket
- recall ticket
- report delay
- mark item unavailable

KDS metrics:

- ticket first seen time
- accepted time
- first item ready time
- all items ready time
- bump time
- total prep time
- station delay

### Bill Splitting Rules

Split modes:

- By seat
- By item
- By amount
- Even split
- Custom split

Rules:

- A paid item cannot be moved without manager approval.
- Tax and service charge must be allocated proportionally.
- Discount allocation must be visible.
- Tips can be per bill or total bill.
- Each split bill has its own payment records.
- Original order keeps parent-child bill link.

### Discounts, Comps, Voids, Refunds

Discount:

- Applied before payment.
- Can be percentage or fixed amount.
- Threshold controls approval.
- Reason optional for small discount, required for large discount.

Comp:

- Reduces item price to zero.
- Reason required.
- Manager approval required by default.
- Shows in comp report.

Void:

- Removes item from payable bill.
- Before kitchen send: waiter may void own item.
- After kitchen send: manager approval required.
- After payment: refund workflow, not void.

Refund:

- Creates negative payment/refund ledger entry.
- Requires manager permission.
- Requires reason.
- Never deletes original payment.

### Restaurant Receipt Requirements

Receipt fields:

- Business name
- Location
- Tax PIN if configured
- Receipt number
- Order number
- Date and time
- Staff name or code
- Table number optional
- Items
- Modifiers
- Discounts
- Service charge
- Tax
- Payment method
- Amount paid
- Change due
- Tip
- Customer phone optional
- Loyalty points earned
- QR code when required

Delivery methods:

- Thermal print
- WhatsApp
- SMS link
- Email
- PDF download

### Shift Close Requirements

Shift close workflow:

```text
Manager starts close
System checks open orders
System checks pending payments
Cashier counts drawer by denomination
System compares expected vs counted cash
Manager enters reason for variance
System summarizes mobile money payments
Manager confirms close
Shift report is locked
Audit event is written
```

Cannot close shift if:

- Open paid-but-not-closed payments exist.
- Offline queue has unsynced financial events unless manager override allowed.
- Cash drawer is not counted.
- Required manager approval is missing.

Shift report includes:

- Gross sales
- Net sales
- Taxes
- Discounts
- Voids
- Refunds
- Cash expected
- Cash counted
- Cash variance
- M-Pesa expected
- M-Pesa confirmed
- Tips
- Orders
- Average ticket
- Sales by staff

## 24. Hotel Detailed Build Spec

### Hotel Operating States

Reservation state:

- inquiry
- reserved
- confirmed
- deposit_pending
- deposit_paid
- checked_in
- in_house
- checked_out
- cancelled
- no_show

Room state:

- available
- reserved
- occupied
- dirty
- cleaning
- inspected
- maintenance
- out_of_order

Folio state:

- open
- balance_due
- paid
- closed
- disputed

Housekeeping task state:

- pending
- assigned
- in_progress
- done
- inspected
- failed_inspection

Maintenance ticket state:

- open
- assigned
- in_progress
- waiting_parts
- resolved
- closed

### Reservation Happy Path

```text
Receptionist opens availability calendar
Receptionist selects room type and dates
System shows available rooms and rates
Receptionist creates guest profile
Receptionist confirms reservation
System creates folio
Guest pays deposit optional
System sends confirmation
Reservation appears in arrivals list
```

Acceptance tests:

- Room cannot be double booked.
- Reservation can hold room type before room assignment.
- Deposit updates folio balance.
- Cancellation policy calculates fee.

### Check-In Happy Path

```text
Receptionist opens arrivals
Receptionist selects guest
System checks room readiness
Receptionist verifies guest details
Receptionist assigns room
System changes room to occupied
System changes reservation to checked_in
Folio opens
Guest receives welcome message
```

Blocked states:

- Room dirty: show alternative rooms or wait.
- Payment required: request deposit/payment before check-in.
- Missing guest info: require minimum fields.

### Check-Out Happy Path

```text
Receptionist opens departures
Receptionist reviews folio
System shows unpaid charges
Guest pays balance
Receptionist closes folio
System checks guest out
Room changes to dirty
Housekeeping task is created
Guest receives receipt and feedback request
```

Acceptance tests:

- Cannot close folio with unpaid balance unless corporate account approved.
- Room status changes automatically after checkout.
- Housekeeping task is generated.

### Folio Rules

Folio charges:

- Room charge
- Tax
- Restaurant charge
- Spa charge
- Laundry
- Minibar
- Damage charge
- Discount
- Deposit
- Refund

Rules:

- Folio is a ledger.
- Closed folio cannot be edited directly.
- Adjustments create new entries.
- Room rate override requires permission above threshold.
- Restaurant charges can post to room if guest is in-house and credit allowed.

### Housekeeping Workflow

```text
Checkout creates dirty room
Housekeeping manager assigns task
Housekeeper starts cleaning
Housekeeper completes checklist
Room moves to cleaning_done
Inspector approves
Room becomes available
```

Checklist examples:

- Change linen
- Clean bathroom
- Restock amenities
- Check minibar
- Check lights and AC
- Report damage
- Upload photo optional

### Hotel Night Audit

Night audit workflow:

```text
Review arrivals not checked in
Review departures not checked out
Review open folios
Post room charges
Reconcile payments
Generate daily reports
Roll business date
```

Reports:

- Arrivals
- Departures
- In-house guests
- No-shows
- Occupancy
- ADR
- RevPAR
- Payments
- Open balances

## 25. Retail Detailed Build Spec

### Retail Operating States

Sale state:

- cart
- quoted
- pending_payment
- paid
- fulfilled
- returned
- partially_returned
- voided

Return state:

- requested
- approved
- rejected
- refunded
- exchanged
- store_credit_issued

Stock count state:

- draft
- counting
- submitted
- variance_review
- approved
- posted

Purchase order state:

- draft
- pending_approval
- approved
- sent
- partially_received
- received
- closed
- cancelled

### Retail Checkout Happy Path

```text
Cashier opens POS
Cashier scans barcode
System adds product variant
Cashier adds customer optional
Cashier applies discount if permitted
Cashier takes payment
System records sale
Stock movement is created
Receipt is printed or sent
Customer loyalty updates
```

Acceptance tests:

- Barcode scanning finds exact variant.
- Product with serial number requires serial capture.
- Product with batch/expiry records stock from selected batch.
- Cashier cannot sell below allowed price without approval.

### Returns And Exchanges

Return workflow:

```text
Cashier searches receipt
Cashier selects item
System checks return eligibility
Manager approval requested if required
Customer chooses refund, exchange, or store credit
System records return
Stock movement is created
Payment/refund ledger is updated
Receipt is issued
```

Rules:

- Returned item must link to original sale when possible.
- Refund cannot exceed original paid amount.
- Store credit creates liability.
- Damaged return can go to quarantine stock.
- Return reason is required.

### Inventory Count Workflow

```text
Manager creates stock count
System freezes expected snapshot
Stock controller counts items
Variances are calculated
Manager reviews high variances
Approved variances create stock movements
Inventory valuation updates
Audit events are written
```

Variance thresholds:

- Low variance: auto-approve optional.
- Medium variance: manager review.
- High variance: owner/auditor review.

### Retail Reorder Workflow

```text
System calculates reorder suggestions
Stock controller reviews suggestions
Purchase order draft is created
Manager approves purchase order
PO sent to supplier
Goods received
Stock levels update
Supplier performance updates
```

Suggestion inputs:

- Sales velocity
- Current stock
- Pending POs
- Supplier lead time
- Safety stock
- Seasonality
- Promotion calendar

## 26. Backend Module Contracts

### Module Boundary Rule

Each module owns its tables, commands, queries, and events. Other modules call
module services instead of writing directly to another module's tables.

Example:

- Payment module records payment.
- Order module asks payment module for payment state.
- Reporting module reads projections or analytics tables.
- Audit module receives events from all modules.

### Command And Query Pattern

Use commands for state changes:

- `CreateOrder`
- `SendOrderToKitchen`
- `TakePayment`
- `VoidOrderItem`
- `CloseShift`
- `CreateReservation`
- `CheckInGuest`
- `ReceiveStock`

Use queries for reads:

- `GetOrderDetail`
- `ListOpenTables`
- `GetShiftSummary`
- `GetRoomAvailability`
- `GetInventoryValuation`

### Required API Behaviors

Every mutation endpoint must:

- Authenticate user.
- Resolve tenant.
- Check permission.
- Validate input.
- Use idempotency key when money, sync, or external integration is involved.
- Write domain record.
- Write audit event when important.
- Emit internal event when downstream work is needed.
- Return consistent response envelope.

### API Response Envelope

Success:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_123",
    "timestamp": "2026-07-17T12:00:00.000Z"
  }
}
```

Error:

```json
{
  "error": {
    "type": "permission_denied",
    "title": "Permission denied",
    "detail": "Manager approval is required for this discount.",
    "status": 403
  },
  "meta": {
    "request_id": "req_123",
    "timestamp": "2026-07-17T12:00:00.000Z"
  }
}
```

### Core API Groups

Auth:

- `POST /auth/pin`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/device/activate`

Organizations:

- `GET /organizations/current`
- `POST /locations`
- `GET /locations`
- `PATCH /locations/:id`

Staff:

- `GET /staff`
- `POST /staff`
- `PATCH /staff/:id`
- `POST /staff/:id/change-pin`
- `POST /staff/:id/deactivate`
- `POST /staff/clock-in`
- `POST /staff/clock-out`

Products:

- `GET /products`
- `POST /products`
- `PATCH /products/:id`
- `POST /products/:id/mark-unavailable`
- `POST /products/:id/mark-available`

Orders:

- `POST /orders`
- `GET /orders/:id`
- `POST /orders/:id/items`
- `PATCH /orders/:id/items/:item_id`
- `POST /orders/:id/send`
- `POST /orders/:id/split`
- `POST /orders/:id/void`
- `POST /orders/:id/close`

Payments:

- `POST /orders/:id/payments/cash`
- `POST /orders/:id/payments/mobile-money`
- `POST /orders/:id/payments/card`
- `POST /payments/:id/refund`
- `POST /payments/webhooks/:provider`

Restaurant:

- `GET /floor-plans`
- `POST /floor-plans`
- `GET /tables`
- `PATCH /tables/:id/status`
- `POST /reservations`
- `GET /kds/stations/:id/tickets`
- `POST /kds/tickets/:id/bump`

Hotel:

- `GET /rooms`
- `GET /availability`
- `POST /reservations`
- `POST /reservations/:id/check-in`
- `POST /reservations/:id/check-out`
- `GET /folios/:id`
- `POST /folios/:id/charges`
- `POST /housekeeping/tasks/:id/status`

Retail:

- `POST /sales`
- `POST /sales/:id/payments`
- `POST /returns`
- `POST /stock-counts`
- `POST /purchase-orders`
- `POST /purchase-orders/:id/receive`

Reports:

- `GET /reports/sales`
- `GET /reports/payments`
- `GET /reports/inventory`
- `GET /reports/staff`
- `GET /reports/audit`
- `POST /reports/:id/export`

AI:

- `GET /ai/briefing/today`
- `POST /ai/query`
- `POST /ai/recommendations/:id/approve`
- `POST /ai/recommendations/:id/dismiss`

## 27. Offline Sync Detailed Spec

Full rationale for choosing PowerSync over a hand-built sync engine:
`docs/adr/0001-tech-stack.md` decision 6. This section is the concrete
design built on that decision — bucket definitions, the upload-queue
handler contract, and the sync-rules configuration — replacing the
earlier annotated-but-not-designed version of this section.

### Architecture Summary

```text
PostgreSQL (source of truth, RLS-enforced)
        |
PowerSync Service (reads Postgres logical replication stream,
  evaluates Sync Rules, maintains per-bucket state)
        |
        +-- Download: bucket contents streamed to each authenticated
        |   device's local SQLite (read-only mirror, PowerSync-managed)
        |
        +-- Upload: device's local CRUD queue drained via the app's
            uploadData() handler -> POST /sync/push (custom, this
            platform's own business logic, unchanged by PowerSync)
```

PowerSync owns the download path's transport, connection management,
and incremental catalog replication. It does not own conflict
resolution, validation, or any business rule — those remain fully custom
and are enforced server-side, exactly as they would be for an online
request, which is the point: an offline write is a normal write that
happens to be queued locally until connectivity returns, not a
different, weaker code path.

### Sync Rules (Download Path)

Sync Rules define named **buckets** — parameterized subsets of tables a
device is authorized to receive, evaluated against claims in the
device's sync JWT (see Authentication below). Buckets for this platform:

```yaml
bucket_definitions:
  catalog:
    parameters: SELECT location_id FROM devices WHERE id = token_parameters.device_id
    data:
      - SELECT * FROM products WHERE location_id = bucket.location_id
      - SELECT * FROM product_prices WHERE product_id IN
          (SELECT id FROM products WHERE location_id = bucket.location_id)
          AND effective_to IS NULL
      - SELECT * FROM menu_categories WHERE location_id = bucket.location_id
      - SELECT * FROM modifier_groups WHERE location_id = bucket.location_id
      - SELECT * FROM modifiers
      - SELECT * FROM floor_plans WHERE location_id = bucket.location_id
      - SELECT * FROM restaurant_tables WHERE location_id = bucket.location_id

  staff_and_permissions:
    parameters: SELECT location_id FROM devices WHERE id = token_parameters.device_id
    data:
      - SELECT * FROM staff WHERE location_id = bucket.location_id
      - SELECT * FROM staff_roles WHERE location_id = bucket.location_id
      - SELECT * FROM role_permissions
      - SELECT * FROM permissions

  active_orders:
    parameters: SELECT location_id FROM devices WHERE id = token_parameters.device_id
    data:
      # Bounded window, not full history -- a device does not need to
      # replicate every order this location has ever taken.
      - SELECT * FROM orders WHERE location_id = bucket.location_id
          AND (status != 'closed' OR closed_at > now() - interval '24 hours')
      - SELECT * FROM order_items WHERE order_id IN
          (SELECT id FROM orders WHERE location_id = bucket.location_id
           AND (status != 'closed' OR closed_at > now() - interval '24 hours'))

  tenant_settings:
    parameters: SELECT organization_id, location_id FROM devices WHERE id = token_parameters.device_id
    data:
      - SELECT * FROM tenant_settings WHERE organization_id = bucket.organization_id
          AND (location_id = bucket.location_id OR location_id IS NULL)
```

Rules:

- Every bucket is parameterized by `device_id` resolved from the sync
  JWT, never by a client-supplied location/organization value — a device
  cannot request another location's bucket by changing a request
  parameter, because the parameterization query runs server-side against
  the token's own claims.
- `active_orders` is intentionally bounded (24-hour window on closed
  orders) — full order history lives in Postgres/the reporting layer
  (PRD 14), not on every POS device. A device that needs older order
  data (e.g. reprinting a receipt from three days ago) fetches it
  on-demand from the API when online, rather than carrying it in the
  permanent local mirror.
- Recipe (`recipes`, `recipe_ingredients`) and inventory
  (`stock_levels`) buckets are added when PRD 12's offline behavior is
  implemented, following the same `location_id`-parameterized pattern —
  not included above because PRD 12's own "Offline Behavior" section
  scopes recipe deduction as the priority, not full inventory
  management, for offline operation.

### Upload Queue (Write Path)

Every local write (order created, item added, payment taken, void, shift
closed — any write from PRD 04/05/06/07/08's workflows) is captured by
PowerSync's client-side CRUD queue automatically, from ordinary SQLite
inserts/updates against the watched local tables — the app does not
manually maintain a separate log table for this.

The app implements one function, `uploadData()`, called whenever the
queue has pending entries and the device is online:

```text
uploadData(database):
  batch = database.getCrudBatch()
  for each queued operation in batch:
    map to the operation shape:
      {
        op_id: <PowerSync's own queue entry id>,
        tenant_id, location_id, device_id, actor_id (from local session),
        entity_type, entity_id,
        operation: <derived from the queued table + op type>,
        payload: <the row's changed columns>,
        created_at,
        base_version: <local row's known version, for conflict detection>
      }
  POST /sync/push { operations: [...] }
  on success: batch.complete()  // removes from local queue
  on failure: leave queued, retry on next connectivity/trigger
```

`POST /sync/push` behavior — unchanged from the original operation-log
design, because this part was never PowerSync's concern:

- Operation IDs must be globally unique.
- The endpoint is idempotent — a retried push with the same `op_id`
  never re-applies.
- Server validates tenant and device before applying anything.
- Server applies operations in order and returns accepted-ops plus any
  conflicts (per Sync Conflict Policy below).
- Server response includes the mapping from local (device-generated)
  IDs to server-assigned IDs, which the client applies to its local
  SQLite rows so subsequent local references resolve correctly.

### Authentication For Sync

PowerSync requires a JWT per connected device. This platform issues one
as an extension of PRD 01's existing PIN-login session, not a separate
credential:

```text
Staff completes PIN login (PRD 01) -> server issues the normal session
  token AND a PowerSync-scoped JWT, signed with the same identity but
  carrying only the claims PowerSync's bucket parameterization needs:
  device_id, organization_id, location_id, expiry
  -> Device's PowerSync client connects using this token
  -> Token is short-lived, matching PRD 01's session-token lifetime
     rules -- a device that needs a new sync session re-authenticates
     through the normal PIN-login flow, there is no separate
     longer-lived sync credential to manage or leak
```

### Sync Cycle

```text
Device comes online
  -> Upload: local CRUD queue drains via uploadData() (device's own
     pending writes go first, so its local state becomes authoritative
     for what it did before accepting external changes)
  -> Download: PowerSync streams any bucket changes since the device's
     last synced checkpoint (incremental, not a full re-fetch)
  -> Device's local SQLite reflects both: its own writes now
     server-acknowledged, and everything else that changed at this
     location while it was offline
```

### Offline Data Stored On Device

POS device should cache:

- Location settings
- Staff allowed on device
- Role permissions
- Product catalog
- Menu categories
- Prices
- Taxes
- Service charges
- Tables
- Open orders assigned to device/location
- Recent customers
- Printer settings
- Payment method settings

POS device should create locally:

- Orders
- Order items
- Cash payments
- Tips
- Receipts
- Audit events
- Sync operations

Operation shape and sync cycle mechanics are specified once, above
(Sync Rules and Upload Queue subsections) — not repeated here.

### Sync Conflict Policy

Orders:

- Merge append-only item operations.
- Paid orders cannot be edited without reopen approval.
- Duplicate payment attempts are deduped by idempotency key.

Inventory:

- Use stock movements, not direct quantity overwrite.
- Conflicting counts go to variance review.

Products:

- Server wins for product configuration.
- Offline orders preserve captured price and product name.

Customers:

- Merge by phone.
- Preserve all notes with author and timestamp.

Payments:

- Cash payment can sync offline.
- Mobile money requires provider confirmation unless explicitly marked external.
- Card payments require online provider unless terminal supports offline auth.

### Failure Modes

- **PowerSync service itself is unreachable** (distinct from the
  device's own connectivity): the device behaves exactly as if it were
  offline — local reads/writes continue against the existing SQLite
  mirror, the upload queue keeps accumulating. The device cannot
  distinguish "my network is down" from "PowerSync is down" and doesn't
  need to; both degrade to the same offline-first behavior.
- **Device offline long enough that its local mirror is meaningfully
  stale** (days, not hours): on reconnect, the download path must fully
  catch up before price-sensitive actions (selling at a since-changed
  price) are treated as trustworthy — the sync-status UI (PRD 11) shows
  "catching up" distinctly from "fully synced," not a binary online/
  offline indicator.
- **A device is lost/stolen while holding unsynced writes**:
  deauthorizing the device (PRD 01) stops it from syncing anything
  further but does not retroactively invalidate data it already synced
  before deauthorization — this is a device-management concern, not a
  sync-engine one.
- **Two devices at the same location conflict on the same entity while
  both offline**: both operations reach the server on reconnect; the
  Sync Conflict Policy above determines the resolution, and — per PRD
  02 — both devices' audit trails are preserved regardless of which
  business outcome wins, so the conflict itself remains visible in
  history.

## 28. Development Acceptance Criteria

### Definition Of Ready

A feature is ready for engineering when it has:

- User role
- Screen
- Workflow
- Permissions
- Data model
- API endpoints
- Offline behavior
- Audit events
- Reports impacted
- Error states
- Acceptance tests

### Definition Of Done

A feature is done when:

- Backend command exists.
- API validation exists.
- Permission checks exist.
- Audit logs exist where required.
- UI happy path works.
- Error states are visible.
- Offline behavior is handled or explicitly blocked.
- Tests cover core business rules.
- Report data is captured.
- Product analytics event is emitted.
- Documentation is updated.

### Test Strategy

Unit tests:

- Pricing calculations
- Tax calculations
- Permission checks
- State transitions
- Split bill allocation
- Inventory movement creation
- Folio balance calculation

Integration tests:

- Create order to payment
- Send order to KDS
- Void with approval
- Close shift
- Receive stock
- Check in guest
- Check out guest
- Return retail item
- Sync offline order

End-to-end tests:

- Waiter dine-in order
- Cashier counter sale
- Manager shift close
- Chef bumps ticket
- Receptionist check-in/check-out
- Housekeeper room clean flow
- Retail checkout and return

Load tests:

- Product search
- Order creation
- Payment webhook
- KDS ticket polling or subscription
- Report generation
- Sync batch upload

### Non-Negotiable Rules

- No payment deletion.
- No inventory quantity overwrite without movement record.
- No destructive action without audit event.
- No cross-tenant reads.
- No order total calculated only on the client.
- No AI recommendation without source metrics.
- No feature that blocks cash sales when offline.
- No manager override without approver identity.
- No report that cannot be traced to source data.

### First Production Beta Checklist

Before the first real restaurant uses the product:

- Tenant isolation tested.
- PIN login tested.
- Product catalog works.
- Tables work.
- Orders work.
- KDS works.
- Cash payments work offline.
- M-Pesa happy path works online.
- Receipts work.
- Shift close works.
- Audit logs work.
- Basic sales report works.
- Backup and restore tested.
- Error monitoring enabled.
- Admin support console has read-only tenant view.
- Manual incident playbook exists.

### Industry Reference Notes

This specification intentionally follows broad patterns from leading products:

- Toast-style fast restaurant payment, split check, tip, and receipt flows.
- Square-style floor plan, bills/checks, item movement, coursing, and service
  speed for restaurants.
- Shopify-style role-based POS permissions for retail teams and sensitive
  actions.
- Cloudbeds-style hotel daily operations around reservations, folios,
  housekeeping, room status, and payments.

The goal is not to clone any product. The goal is to adopt proven operational
patterns and localize them for African restaurants, hotels, and retailers.

## 29. Pricing And Monetization Model

### Revenue Model

Stack revenue in layers, the way every mature POS platform we benchmarked
against does — no single layer alone reaches the unit economics needed to
subsidize a genuinely affordable software price for the target market:

1. Software subscription (recurring, tiered — see Subscription Tiers below).
2. Payment processing (a percentage of GMV on every transaction that runs
   through our payment rails).
3. Financial products (lending/merchant-cash-advance margin, float income
   on the business wallet — see Module 7 Restaurant Payments, embedded
   financial services).
4. Hardware (starter-kit sale or rental margin — see Hardware Strategy
   below).
5. Marketplace and app revenue share (Module 17 App Marketplace).
6. Premium features (add-on modules sold above the base tier — e.g.
   advanced BI, multi-brand/ghost-kitchen, franchise royalty engine).
7. Data and insights B2B products (anonymized, aggregated market
   intelligence sold to suppliers/brands — never sold in a form that could
   re-identify a single merchant; subject to the same minimum-10-merchant
   privacy threshold as Competitive Benchmarking in section 7).

### Subscription Tiers

Indicative tiers (final numbers are a business decision revisited at
launch, not an engineering constant baked into code):

- **Starter** — free. Core POS, cash and mobile money payments, basic
  reporting. This is the acquisition tier — free forever for a
  single-location, low-volume business, not a time-limited trial.
- **Business** — approximately KES 1,999–2,500/month. Adds inventory,
  staff management, CRM/loyalty, WhatsApp receipts.
- **Pro** — approximately KES 4,999–14,000/month. Adds full BI dashboards,
  AI features, multi-location, delivery/commerce integrations.
- **Enterprise** — custom pricing. Adds the Developer Platform's
  enterprise controls (Module 17), franchise royalty engine, dedicated
  SLA, white-label options.

### Pricing Anti-Patterns (Explicit Product Rules)

These are rules, not suggestions — violating them undermines the
affordability positioning this platform is built on:

- Never lock payment processing at a non-competitive rate merchants
  cannot see or negotiate; negotiate bulk processing rates with providers
  (target 0.5–1% GMV share range) rather than passing a high default rate
  through unchanged.
- Never require a long-term contract at launch — month-to-month by
  default while trust is being built in a new market.
- Never price only in USD — every tier is priced and billed in local
  currency.
- Never charge for integrations that are essential to operating in the
  target market — M-Pesa/mobile money, WhatsApp receipts, and basic tax
  compliance (Module 18) are available on every tier including Starter,
  never gated behind a paywall.

### Hardware Strategy

- A starter kit (Android terminal + receipt printer + cash drawer) priced
  in the ~$200–300 range, materially below the $800+ typical for
  Toast-class hardware bundles, because the target market cannot absorb
  Toast-class upfront hardware cost.
- Optional hardware rental (indicative ~KES 500/month) for merchants who
  cannot afford the upfront purchase at all.
- Reference hardware, not a hard lock-in: Sunmi (T2s/V2s/M2 class Android
  terminals), Xprinter (XP-80C class thermal printers), PAX (SK900 class
  card terminals) as the initial certified/recommended hardware list in
  the Module 17 hardware partner program — merchants are never required
  to buy hardware only from us.

### Unit Economics Targets

- Blended ARPU target: $35–80/month per active location once a merchant
  is past Starter tier.
- CAC: under $50 per active location.
- Payback period: under 6 months.
- Gross margin target: 80%+ on the software layer, 30–40% on the payments
  layer (payments margin is structurally thinner than software margin —
  do not model them as one blended number).

## 30. BI Dashboard Design System

Every dashboard in this document (Module 12, and the per-vertical BI
Dashboards subsections in sections 7-9) is built to this design system,
not to ad hoc layouts per screen:

- **Three Questions Test**: before a screen ships, it must clearly answer
  three questions for the role viewing it — "How am I doing?", "What
  needs my attention right now?", "What should I do next?" A screen that
  cannot answer all three in the first viewport is not done.
- **One Number Principle**: exactly one number per screen is rendered
  larger than every other number on that screen — the single most
  important figure for that role at that moment (e.g. owner dashboard:
  today's revenue; manager dashboard: open orders needing attention;
  kitchen dashboard: tickets currently late). Every other figure is
  visually subordinate. A dashboard with three equally-sized "big
  numbers" has failed this rule.
- **Color semantics are fixed platform-wide**, never decorative: green =
  healthy/on-target, amber = needs attention soon, red = needs attention
  now, blue = informational/neutral, purple = AI-generated insight, gray
  = inactive/no-data. A color is never chosen for visual variety; if a
  screen "needs more color," that is a sign it needs a stronger data
  hierarchy, not a bigger palette.
- **Loading and offline states are first-class**, not an afterthought,
  because unreliable connectivity is the normal condition in the target
  market, not the exception: skeleton loading states, never a bare
  spinner; cache and show the last-known data with a visible "last
  updated: 47 min ago" badge rather than a blank screen while
  refreshing; a persistent, always-visible connectivity indicator with
  three states (online / syncing / offline), never a silently stale
  dashboard that looks live.

## 31. Automated Reporting And WhatsApp Command Interface

Extends Module 11 (Reporting) and Module 4 (Notifications) with the
concrete delivery cadence and the two-way command interface — WhatsApp is
treated as push-first (roughly 98% open rate in the target market versus
under 25% for email) and, uniquely among the delivery channels, as an
input channel as well as an output channel.

### Report Cadence

- **Real-time**: event-triggered alerts only (stock-out risk, anomaly
  detected, negative review) — never a scheduled digest for these, they
  must arrive the moment the triggering event fires.
- **Daily**: sent 30 minutes after the location's close-of-business,
  once the day's numbers are final.
- **Weekly**: Sunday 7 PM, ahead of the coming week's planning.
- **Monthly**: 1st of the month, covering the prior full month.

### Two-Way WhatsApp Commands

A merchant can reply to any automated message with a short command word
and get a real answer back, not just receive push notifications:

- `SALES` — today's sales summary.
- `STOCK` — current low-stock items.
- `STAFF` — who's clocked in right now.
- `VOID` — today's void report.
- `ORDER` — status of a named open order.
- `QUERY <free text>` — natural-language question routed to the AI
  natural-language-query feature (section 7, Restaurant AI Features),
  answerable in English or the merchant's local language (Module 18).
- `OK` — acknowledge/dismiss the most recent alert.
- `STOP` — opt out of automated messages on this number (required for
  opt-out compliance, always honored immediately).
- `HELP` — list available commands.

Every command is handled by a webhook handler on the WhatsApp Business
API integration (Module 16) that authenticates the sender's phone number
against a staff/owner record before executing anything — an unrecognized
number gets a generic reply, never access to business data.

### Delivery Pipeline

- PDF report generation via a headless-Chrome rendering pipeline
  (Puppeteer or equivalent) from the same report data the web dashboards
  use, so the PDF and the on-screen report can never drift apart.
- Delivery via BullMQ worker with retry (same pattern as Module 4/P9 in
  BUILD_WORKFLOW.md) — a failed WhatsApp send retries and never blocks
  anything else in the system.

## 32. UX Design Principles, Performance Budgets, And Onboarding

### Decision-Cost Principle

Every second of hesitation in a high-frequency screen (the POS sale
screen above all) is multiplied by transaction volume: 3 seconds of
hesitation on a screen used 200 times a day costs roughly 52 hours a year
of a business's labor time. This is why the rules below exist as hard
budgets, not aspirational targets.

### Interaction Rules

- One tap for the most common action, for every role — the waiter's most
  common action (add item to open order), the cashier's most common
  action (take cash payment), the manager's most common action (approve a
  pending request) must each be reachable in exactly one tap from that
  role's home screen.
- Progressive disclosure: advanced/rare actions (voiding a paid item,
  editing a recipe) are one level deeper than common actions, never
  surfaced at the same visual weight.
- Confirmation dialogs only for destructive or hard-to-reverse actions
  (void, refund, delete) — never for routine actions (add item, mark
  ready), where a confirmation dialog only adds friction without adding
  safety.
- Error messages describe the fix, not the failure mode: never
  `Error 422: Unprocessable Entity`; instead something like `That phone
  number doesn't look right — check the digits and try again.`

### Performance Budgets

Hard ceilings, tested as part of Definition of Done (section 28), not
soft targets:

- App launch to usable: under 3 seconds.
- Item search: under 200ms.
- Add item to cart: under 100ms.
- Payment screen ready: under 500ms.
- Receipt generation: under 1 second.
- Full resync after 1 hour offline: under 10 seconds.

### Onboarding

- Registration is 3 steps, no more: business details, first location,
  first staff PIN. Every additional field is a reason a busy owner
  abandons setup.
- Template-menu onboarding: choosing a business type (e.g. "Nairobi cafe,"
  "nyama choma grill") loads a pre-built starter menu with
  locally-typical item names and Nairobi-average prices the owner edits
  rather than builds from a blank screen — this is what cuts menu setup
  from roughly 2 hours to roughly 5 minutes.
- Target: a new owner reaches "ready to take the first order" within 10
  minutes of starting registration, with named checkpoints (account
  created, first location added, menu loaded, first staff PIN set, first
  table/counter configured) so the flow can be measured and each drop-off
  point identified, not just the end-to-end total.
- Staff invitation happens over WhatsApp with a templated message
  containing a one-tap join link, not an email invite — matches the
  channel staff actually check.
