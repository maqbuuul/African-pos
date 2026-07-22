# Essential Feature Spec — What to Build, What to Skip

> Every feature you don't build is a feature that can't break, can't confuse a user, and doesn't need to be maintained. Ruthless prioritization is not a compromise — it is a competitive advantage.

---

## The Feature Filter

Before any feature gets built, it must pass this test:

```
1. Does at least 20% of the target user base need this?
   If NO → skip it.

2. Does the absence of this feature cause a merchant to lose money
   or fail to run their business?
   If YES → it's essential.

3. Can this be solved by a third-party integration instead?
   If YES → consider an API hook, not a built-in feature.

4. Does this feature add a new screen, a new navigation item,
   or a new concept the user must learn?
   If YES → raise the bar significantly. Complexity has a cost.
```

---

## TIER 1 — Build First (Revenue-Critical, Universal Need)

These features must exist at launch. Without them, merchants cannot run their business.

### 1.1 Core POS Selling
| Feature | Why essential | Notes |
|---------|--------------|-------|
| Add items to cart (tap or scan) | Without this, no sales | |
| Search products by name | Essential for large catalogs | |
| Variable quantity | Every item needs this | |
| Remove item from cart | Mistakes happen | |
| Item modifiers / notes | Restaurants require this | |
| Discount (% or flat amount) | Used in every sale | Requires permission |
| Cash payment + change calc | Majority of Africa is cash | |
| M-Pesa STK push payment | Africa's primary payment | |
| Receipt (print + WhatsApp) | Legal + customer UX | |
| Hold order / open tab | Common in restaurants + bars | |
| Offline mode — full sale | Non-negotiable for Africa | |

### 1.2 Product & Inventory Management
| Feature | Why essential | Notes |
|---------|--------------|-------|
| Add/edit/delete products | Basic catalog management | |
| Categories | Navigation requires this | |
| Stock quantity tracking | Core inventory | |
| Stock alerts (ML-based) | Prevent stockout losses | |
| Barcode scan to add product | Speed + accuracy | |
| Low stock threshold per item | Different items, different needs | |
| Receive stock (adjust quantity) | Stock comes in, POS must know | |

### 1.3 Multi-Tenant & Staff
| Feature | Why essential | Notes |
|---------|--------------|-------|
| Owner → multiple businesses | Core differentiation | |
| Business → multiple branches | Required for any chain | |
| Staff roles & PINs | Security + audit | |
| Staff invite via WhatsApp | Low-friction onboarding | |
| Role-based permission | Can't let cashiers process refunds | |
| Clock in / clock out | Labor cost tracking | |

### 1.4 Reporting (Minimum Viable)
| Feature | Why essential | Notes |
|---------|--------------|-------|
| Today's revenue (live) | #1 thing every owner checks | |
| Daily WhatsApp summary | Push beats pull | |
| Sales by period (day/week/month) | Basic trend analysis | |
| Top items by revenue | Menu decisions | |
| Payment method breakdown | Reconciliation | |
| End-of-day cash reconciliation | Every business needs this | |

### 1.5 Customers & Loyalty (Basic)
| Feature | Why essential | Notes |
|---------|--------------|-------|
| Customer profile by phone | Foundation for loyalty | |
| Points per purchase | Basic loyalty | |
| Redeem points | Loyalty must be redeemable | |
| Birthday recognition | Easy, high-impact | |

---

## TIER 2 — Build in Month 3-6 (High-Value, Majority Need)

Not required for first sale, but required to retain merchants past 90 days.

### 2.1 Advanced Payments
| Feature | Notes |
|---------|-------|
| Card payment integration | Via Flutterwave/Paystack terminal |
| MTN MoMo / Airtel Money | Other markets' primary payment |
| Split payment (cash + M-Pesa) | Common real-world scenario |
| Customer running credit (tab) | Critical for loyal customer relationships |
| Layaway / installment deposit | African retail essential |
| Refunds / voids with reason | With manager approval workflow |

### 2.2 Restaurant-Specific
| Feature | Notes |
|---------|-------|
| Table management + floor plan | Required for full-service |
| Course firing (send to kitchen now / later) | Fine dining and mid-range restaurants |
| Kitchen Display System (KDS) | Replace paper tickets |
| Table QR code ordering | Post-COVID standard |
| Reservations + waitlist | Full-service must-have |
| Transfer order between tables | Happens daily in restaurants |

### 2.3 Retail-Specific
| Feature | Notes |
|---------|-------|
| Product variants (size / color / style) | Apparel, shoes — essential |
| Purchase orders to suppliers | Formal reordering workflow |
| Serial number tracking | Electronics, high-value goods |
| Barcode label printing | Create own labels |
| Supplier management | Track who supplies what |

### 2.4 Reporting — Intelligence Layer
| Feature | Notes |
|---------|-------|
| Menu engineering (BCG matrix) | Auto-calculated, actionable |
| Staff performance report | Sales per hour, avg ticket |
| Hourly heatmap | Scheduling decisions |
| Weekly PDF report (WhatsApp delivery) | Full intelligence report |
| Custom date range reports | Owner flexibility |
| Natural language report queries | "How did we do last month?" |

### 2.5 AI & ML
| Feature | Notes |
|---------|-------|
| ML demand forecasting per item | Days-of-stock with accuracy % |
| Revenue forecasting (next 7 days) | Staffing and prep decisions |
| Anomaly detection (sales drop, void spike) | Proactive problem flagging |
| Menu engineering auto-calculation | BCG with action recommendations |

### 2.6 Multi-Business Owner View
| Feature | Notes |
|---------|-------|
| Cross-business revenue overview | The feature nobody else has |
| Consolidated daily WhatsApp | One message, all businesses |
| Cross-business AI insight | "Your salon is down 3% while your restaurant is up 12%" |

---

## TIER 3 — Build in Month 6-12 (Competitive Differentiators)

These features differentiate the product in competitive bakeoffs. Not required for survival, but required to win.

### 3.1 Advanced AI
| Feature | Notes |
|---------|-------|
| AI daily morning briefing (6am WhatsApp) | Proactive intelligence, not reactive |
| Staffing recommendations | "Schedule extra staff Saturday" |
| Price optimization suggestions | "Your ugali margin is 28% — peers at 42%" |
| AI natural language assistant | Full conversational POS intelligence |
| Waste prediction | Pre-service prep optimization |
| Win-back customer AI campaigns | Auto-generate targeted offers |

### 3.2 WhatsApp Commerce
| Feature | Notes |
|---------|-------|
| WhatsApp ordering (customer to business) | Menu → order → pay via WhatsApp |
| WhatsApp loyalty notifications | "You have 340 points — redeem on your next visit" |
| WhatsApp receipts (default) | Replace printed receipts |
| WhatsApp two-way reporting commands | SALES, STOCK, STAFF commands |
| WhatsApp supplier ordering | Send PO to supplier via WhatsApp |

### 3.3 Delivery & Online
| Feature | Notes |
|---------|-------|
| In-house delivery management | Drivers, dispatch, GPS |
| QR code full ordering + payment | Scan, order, pay, no server needed |
| Online ordering page | Branded URL, commission-free |
| 3rd party delivery aggregator sync | Bolt Food, Jumia Food, Glovo |

### 3.4 Franchise & Chain Management
| Feature | Notes |
|---------|-------|
| Central menu push to all branches | One change → everywhere |
| Branch-level price overrides | Head office sets floor, branches adjust |
| Franchise royalty calculation | % of sales to franchisor, auto-calculated |
| HQ reporting (all branches) | Regional and consolidated views |
| Compliance score per branch | Are branches following standards? |

### 3.5 Financial Services
| Feature | Notes |
|---------|-------|
| Business wallet (daily sales deposited) | M-Pesa → wallet → bank |
| Cash flow forecast | 30-day forward cash flow |
| Merchant advance (loan from sales data) | Partner with MFI/bank |
| Tax report export (KRA/FIRS format) | Export-ready for accountant |
| Supplier credit tracking | What you owe, payment schedule |

---

## TIER 4 — Integrations (Not Built-In)

These are never built from scratch. They are integrations with best-in-class platforms.

| Need | Integration partner | Not a custom build |
|------|--------------------|--------------------|
| Full accounting | Xero / QuickBooks API | Not built-in books |
| Advanced scheduling | Homebase / Deputy API | Not a full HR system |
| Email marketing | Mailchimp / Brevo API | Not an email server |
| SMS marketing | Africa's Talking API | Already integrated |
| E-commerce | Shopify API / WooCommerce | Not a full shop builder |
| Reservations (advanced) | OpenTable API / custom | Not for v1 |
| Payroll | Wave / local payroll APIs | Not built-in payroll |
| Hotel PMS | Mews / Opera API | Not for v1 |
| Delivery aggregators | Deliverect / Otter API | Middleware, not direct |
| Accounting-level analytics | Restaurant365 API | |

---

## EXPLICIT SKIP LIST — Features We Will NOT Build

This is as important as the build list.

| Feature | Why we skip it | Alternative |
|---------|---------------|-------------|
| Full accounting / bookkeeping | Xero does this better | API integration |
| Payroll engine | Complexity, legal, per-country rules | API integration |
| HR management system | Out of scope | API integration |
| E-commerce store builder | Shopify is 10 years ahead | API integration |
| Delivery driver app (complex) | Start with basic, expand | Third-party or v2 |
| Hotel PMS (full) | Enterprise complexity | API hook for those who need it |
| Loyalty gamification (complex) | Start simple, expand | Phased |
| Social media management | Out of scope | Never |
| Website builder | Out of scope | Never |
| Advanced CRM | Salesforce does this | API integration |
| Chat support in POS | WhatsApp is the channel | |
| Dark kitchen full suite | Start with basic multi-brand | v2 |
| Custom app branding/white-label | Complex, low priority for v1 | v2 |
| Franchise portal (franchisee self-service) | Complexity for edge case | v2 |

**The test for the skip list:** if removing a feature would cause 80%+ of merchants to churn, it's essential. If only 10% need it, it's an API hook or a v2 feature.

---

## API Design Contracts

### Core API Endpoints (RESTful, OpenAPI 3.0 documented)

```yaml
# Sales / Orders
POST   /api/locations/{id}/orders              # Create new order
GET    /api/locations/{id}/orders              # List orders (paginated)
GET    /api/orders/{id}                        # Get order details
PATCH  /api/orders/{id}/status                 # Update status (kitchen flow)
POST   /api/orders/{id}/payments               # Add payment to order
POST   /api/orders/{id}/items                  # Add item to open order
DELETE /api/orders/{id}/items/{itemId}         # Remove item from order
POST   /api/orders/{id}/void                   # Void order (manager permission)
POST   /api/orders/{id}/refund                 # Refund payment

# Products / Inventory
GET    /api/businesses/{id}/products           # Product catalog
POST   /api/businesses/{id}/products           # Create product
PATCH  /api/products/{id}                      # Update product
DELETE /api/products/{id}                      # Delete product
POST   /api/locations/{id}/stock/adjust        # Adjust stock quantity
GET    /api/locations/{id}/stock/alerts        # Get ML stock alerts
GET    /api/locations/{id}/stock/forecast      # Get demand forecast

# Analytics
GET    /api/locations/{id}/analytics/today     # Live today summary
GET    /api/locations/{id}/analytics/sales     # Sales with filters
GET    /api/businesses/{id}/analytics/weekly   # Weekly report data
GET    /api/users/{id}/analytics/overview      # Cross-business owner summary

# Reports
GET    /api/businesses/{id}/reports            # List saved reports
POST   /api/businesses/{id}/reports/query      # Natural language query
GET    /api/reports/{id}/pdf                   # Download PDF

# Customers
GET    /api/businesses/{id}/customers          # Customer list
POST   /api/businesses/{id}/customers          # Create customer
GET    /api/customers/{id}/orders              # Customer order history
POST   /api/customers/{id}/loyalty/adjust      # Add/remove points

# Staff
GET    /api/businesses/{id}/staff              # Staff list
POST   /api/businesses/{id}/staff/invite       # Invite staff member
GET    /api/locations/{id}/staff/clockins      # Active clock-ins
POST   /api/staff/{id}/clockin                 # Clock in
POST   /api/staff/{id}/clockout                # Clock out

# Multi-tenant
GET    /api/businesses                         # My businesses
POST   /api/businesses                         # Create new business
GET    /api/businesses/{id}/locations          # Branches of business
POST   /api/businesses/{id}/locations          # Add new branch

# Webhooks (outbound)
# POST to merchant-configured URL on:
#   order.created, order.paid, order.voided
#   stock.alert.critical, stock.alert.warning
#   payment.received (M-Pesa ref included)
#   report.daily.ready
```

### API Design Rules
```
1. Every response includes:
   { data: ..., meta: { timestamp, request_id }, errors?: [...] }

2. Pagination: cursor-based (not page-based)
   ?cursor=xxxx&limit=50

3. Filtering: query params
   ?from=2026-01-01&to=2026-01-31&method=mpesa

4. All monetary values: in smallest unit (cents/kobo/fills)
   or as decimal with explicit currency field
   { amount: 42300, currency: "KES" }

5. All timestamps: ISO 8601 UTC
   "2026-06-24T12:34:56Z"

6. Errors: RFC 7807 Problem Details
   { type: "...", title: "...", detail: "...", status: 422 }

7. Rate limiting: 60 req/min standard, 600 req/min for sync operations
   Headers: X-RateLimit-Remaining, X-RateLimit-Reset

8. Authentication: Bearer JWT
   Scopes: pos:read, pos:write, reports:read, admin:write
```

---

## Data Contracts — What Every System Exposes

### Event Bus (Internal)
Every significant action emits an event. ML, reporting, alerts all listen.

```typescript
type PosEvent =
  | { type: 'order.created';    data: Order }
  | { type: 'order.paid';       data: Order & { payment: Payment } }
  | { type: 'order.voided';     data: Order & { reason: string; staff_id: string } }
  | { type: 'stock.adjusted';   data: { product_id: string; delta: number; new_qty: number } }
  | { type: 'stock.alert';      data: StockAlert }
  | { type: 'staff.clockin';    data: { staff_id: string; location_id: string } }
  | { type: 'staff.clockout';   data: { staff_id: string; duration_minutes: number } }
  | { type: 'customer.created'; data: Customer }
  | { type: 'payment.mpesa';    data: { order_id: string; ref: string; amount: number } }
```

Any module can subscribe to any event. The ML model listens to `order.paid` to retrain. The alert engine listens to `order.voided` to watch for spikes. The reporting engine listens to everything.

---

## Connection Architecture — Everything Links

```
┌──────────────────────────────────────────────────────────┐
│                     POS SYSTEM                           │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │  POS App   │  │  Dashboard │  │  Report Engine     │  │
│  │ (React     │  │  (React    │  │  (Node.js worker)  │  │
│  │  Native)   │  │  Web)      │  │                    │  │
│  └──────┬─────┘  └─────┬──────┘  └──────────┬─────────┘  │
│         │              │                    │             │
│         └──────────────┼────────────────────┘             │
│                        │                                  │
│                ┌───────▼────────┐                         │
│                │   API Server   │                         │
│                │  (Fastify)     │                         │
│                └───────┬────────┘                         │
│                        │                                  │
│    ┌───────────┬────────┼────────┬────────────┐           │
│    ▼           ▼        ▼        ▼            ▼           │
│  ┌─────┐  ┌──────┐  ┌─────┐  ┌──────┐  ┌────────┐       │
│  │ PG  │  │Redis │  │Duck │  │BullMQ│  │Feature │       │
│  │     │  │      │  │ DB  │  │Queue │  │ Store  │       │
│  └─────┘  └──────┘  └─────┘  └──────┘  └────────┘       │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │
          ┌────────────┼────────────────────┐
          ▼            ▼                    ▼
   ┌────────────┐  ┌──────────┐  ┌──────────────────┐
   │   M-Pesa   │  │WhatsApp  │  │  Claude API      │
   │  (Daraja)  │  │Business  │  │  (LLM engine)    │
   └────────────┘  └──────────┘  └──────────────────┘
          │            │                    │
   ┌────────────┐  ┌──────────┐  ┌──────────────────┐
   │ Paystack / │  │ Africa's │  │  LightGBM        │
   │Flutterwave │  │ Talking  │  │  (ML models)     │
   └────────────┘  └──────────┘  └──────────────────┘
```

Every external dependency is behind an abstraction layer (interface). Swapping M-Pesa for a different provider means changing one adapter, not the entire codebase.

```typescript
// Payment provider abstraction
interface PaymentProvider {
  initiate(amount: number, phone: string, reference: string): Promise<PaymentSession>;
  verify(reference: string): Promise<PaymentStatus>;
  refund(reference: string, amount: number): Promise<RefundResult>;
}

// M-Pesa implements PaymentProvider
class MPesaProvider implements PaymentProvider { ... }

// MTN MoMo implements PaymentProvider
class MTNMoMoProvider implements PaymentProvider { ... }

// POS doesn't know which provider is behind — just calls the interface
const payment = await paymentService.initiate({ amount, phone, provider: 'mpesa' });
```

---

## The "Done" Definition for Each Feature

A feature is complete when:

1. **It works on a KSh 12,000 Android phone on 2G** — not just a MacBook on fibre
2. **It works offline** — or clearly degrades gracefully with a visible offline badge
3. **A user with no training can complete the task in under 60 seconds** — tested on a real merchant, not an engineer
4. **The feature has a WhatsApp notification path** — if something important happens, the owner knows
5. **The feature generates a log entry** — all significant actions are auditable
6. **The API is documented** — in OpenAPI format, with examples
7. **Error states are designed** — not just the happy path

If any of these 7 are missing, the feature is not done.
