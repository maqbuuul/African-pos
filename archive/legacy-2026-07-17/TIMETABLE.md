# African POS — Execution Timetable
## The African Toast | Start: June 24, 2026 | First Sale: July 21, 2026

> **Positioning:** Restaurant Operating System for Africa. Not a generic POS.
> Restaurant-only SaaS — every feature serves a restaurant owner.
>
> **Rule:** Ship working software every Friday. Features not done by Friday move to next Friday.
> **References:** `ARCHITECTURE.md` for technical decisions. `TODO.md` for today's tasks.

---

## COMPLETE RESTAURANT FEATURE CHECKLIST
*Every feature a world-class restaurant SaaS needs. Checked when shipped.*

### Core Transaction Engine
- [ ] Order creation with items, modifiers, combos
- [ ] Course management — fire appetizers, mains, desserts separately
- [ ] Split bill — by seat, by item, or evenly
- [ ] Table transfer — move order to a different table mid-service
- [ ] Table merge — combine two tables into one bill
- [ ] Void with manager approval + mandatory reason
- [ ] Discount (% and fixed) with manager approval + audit log
- [ ] Refund with manager approval
- [ ] Reprint receipt

### Payments (Africa-First)
- [ ] M-Pesa STK Push (Daraja v3) — primary payment method
- [ ] M-Pesa offline QR fallback — static merchant QR when no internet
- [ ] Cash payment with change calculation
- [ ] Flutterwave card (physical terminal)
- [ ] Airtel Money (Month 10)
- [ ] MTN MoMo (Month 10)
- [ ] Loyalty points redemption
- [ ] Credit tab payment (Oweame)
- [ ] Split payment — e.g., KES 500 M-Pesa + KES 200 cash

### Kitchen & Service
- [ ] Kitchen Display System (KDS) — order tickets with timers
- [ ] Multi-station KDS routing by category (Grill, Bar, Cold, Pastry)
- [ ] KDS bump button — mark item ready
- [ ] Expo screen (food runner) — items ready for table delivery
- [ ] Server mode — tableside ordering from handheld
- [ ] Kitchen printer support (thermal) — fallback when KDS is down
- [ ] Cook time tracking — alert when ticket > X minutes

### Table Management
- [ ] Visual floor plan editor (drag-and-drop)
- [ ] Table status — available / occupied / reserved / cleaning
- [ ] Ghost tables — temporary tables not on the base floor plan
- [ ] Reservations — book a table, party size, duration
- [ ] Reservation deposits — M-Pesa deposit to secure booking
- [ ] Waitlist — queue walk-ins when restaurant is full
- [ ] Table merge and split (combine orders, split to separate tables)
- [ ] Table transfer (move order between tables)

### Menu Management
- [ ] Products with categories, photos, descriptions
- [ ] Swahili (+ local language) product names displayed on POS
- [ ] Modifiers and modifier groups (e.g., "Spice Level", "Add-ons")
- [ ] Combo meals / set menus
- [ ] Price books — Happy Hour, Staff Meals, Catering
- [ ] 86 a product (mark unavailable) with one tap
- [ ] Recipe management — ingredients per product
- [ ] Food cost % calculator (ingredient cost vs. selling price)
- [ ] Menu engineering matrix (Stars / Plowhorses / Puzzles / Dogs)
- [ ] ML-sorted product grid (most-ordered items appear first)

### Inventory & Procurement
- [ ] Stock levels per product per branch
- [ ] Receive stock against purchase order
- [ ] Manual stock adjustment with mandatory reason
- [ ] Wastage log
- [ ] Low-stock alerts (WhatsApp to manager)
- [ ] Purchase orders — create from ML stockout predictions
- [ ] Send PO to supplier via WhatsApp
- [ ] Supplier Mkopo (credit) tracking — what we owe each supplier
- [ ] Discrepancy report — what was ordered vs. received
- [ ] Auto-deduct from stock on every order item sold

### Staff & Labor
- [ ] Staff onboarding — invite via WhatsApp
- [ ] Role-based access (owner / manager / cashier / server / kitchen / host)
- [ ] 4-digit PIN login (fast, no typing at the counter)
- [ ] Clock-in / clock-out (with optional selfie)
- [ ] Manager override — clock out a staff member who forgot
- [ ] Staff scheduling — weekly shifts assigned in Manager Portal
- [ ] Labor cost tracking — actual hours vs. scheduled hours
- [ ] Staff performance — sales per cashier, avg ticket, voids
- [ ] Staff loan / salary advance tracking
- [ ] PIN change by manager or owner
- [ ] Staff deactivation (keeps all historical records)

### Customer Intelligence
- [ ] Customer profile — phone as universal ID (M-Pesa auto-captures)
- [ ] Full order history per customer
- [ ] Loyalty points — earn on every purchase
- [ ] Loyalty tiers — Bronze / Silver / Gold / Platinum
- [ ] Tier auto-upgrade when threshold is crossed (WhatsApp notification)
- [ ] Credit tabs (Oweame) — charge now, pay later
- [ ] Credit limit management — set per customer
- [ ] Credit statement — customer sees what they owe
- [ ] Win-back campaigns — automated WhatsApp to at-risk customers
- [ ] Birthday recognition (WhatsApp message + discount offer)
- [ ] Customer feedback — WhatsApp survey after visit
- [ ] Gift cards — issue, redeem, balance check
- [ ] Customer tags — vip, allergy_nuts, credit_customer, etc.

### Reporting & Analytics
- [ ] Shift summary — revenue, transactions, avg ticket, voids
- [ ] Cash reconciliation — count the till by denomination
- [ ] M-Pesa reconciliation — POS vs. M-Pesa statement
- [ ] Daily float management — opening float, closing count
- [ ] Sales by category, product, hour, day
- [ ] Staff performance report
- [ ] Inventory cost report (food cost %)
- [ ] P&L summary — revenue minus ingredient cost
- [ ] PDF export for any report
- [ ] Owner Dashboard (live revenue, all branches, milestones)
- [ ] Revenue vs. target progress bar

### AI & Intelligence
- [ ] Morning briefing — Claude → WhatsApp at 4AM daily
- [ ] Natural language query — "How much did we make last Tuesday from ugali?"
- [ ] Demand forecasting — what to stock today (Prophet)
- [ ] Product recommendation at checkout — "Customers also order..."
- [ ] Churn prediction — customers at risk of not returning
- [ ] Customer LTV — predicted 90-day spend (credit decisions)
- [ ] Anomaly detection — void spikes, discount abuse, cash discrepancies
- [ ] Menu engineering matrix — which items to promote, price, or retire
- [ ] Competitive benchmarks (revenue per table, avg ticket vs. similar venues)
- [ ] WhatsApp AI ordering — "nataka ugali mbili" → creates POS order
- [ ] WhatsApp fast-path — simple orders parsed locally, complex ones to Claude

### Ordering Channels
- [ ] POS terminal (cashier at counter)
- [ ] Server mode (tableside on handheld)
- [ ] Kiosk mode (self-ordering on Android tablet at entrance)
- [ ] QR table ordering (customer scans table QR → orders on phone browser)
- [ ] WhatsApp ordering (AI-parsed orders from customer messages)
- [ ] Delivery integration — Bolt Food, Glovo, Uber Eats, Jumia (via Deliverect)
- [ ] Online ordering page (`restaurant-name.africanpos.co`)

### Compliance & Tax
- [ ] KRA eTIMS — submit every receipt, attach QR code
- [ ] Uganda EFRIS (Month 10)
- [ ] Nigeria FIRS (Month 12)
- [ ] Proforma invoice (for catering deposits)

### Catering & Events
- [ ] Catering order — future date, large party, deposit
- [ ] Catering production sheet — what to prep and when
- [ ] Event floor plan — configure room layout for event

### Offline & Resilience
- [ ] 100% offline for 72 hours (WatermelonDB)
- [ ] M-Pesa offline QR fallback
- [ ] Cash payment always offline
- [ ] Load shedding mode — dim screen, disable non-essentials at < 20% battery
- [ ] Offline order queue — syncs on reconnect with conflict resolution
- [ ] Offline alert banner — "Working offline since 14:32"

### Multi-Location
- [ ] Owner sees all branches on one dashboard
- [ ] Per-branch revenue card + comparison table
- [ ] Offline branch alert — "Karen branch offline since 14:32"
- [ ] Shared menu across branches (with branch-level price overrides)
- [ ] Inter-branch stock transfer

### Integrations
- [ ] WhatsApp Business API (Meta Cloud)
- [ ] Firebase FCM push notifications
- [ ] Africa's Talking SMS fallback
- [ ] Deliverect (delivery platforms aggregator)
- [ ] Xero / QuickBooks accounting sync
- [ ] Cloudflare R2 file storage
- [ ] AWS Transcribe (Swahili voice input)

### Product Analytics (Internal)
- [ ] PostHog — web apps (manager portal, owner dashboard)
- [ ] Firebase Analytics — POS React Native app
- [ ] PostHog Node SDK — server-side events (payments, sync, briefings)
- [ ] Funnel: signup → first order → first M-Pesa → Day 30 active
- [ ] Feature adoption tracking per restaurant

---

## MONTH 1 — FIRST SALE (June 24 – July 21)

**Goal:** A real restaurant can take a dine-in order, process M-Pesa, and receive a WhatsApp receipt. One beta restaurant in Nairobi using it daily.

---

### WEEK 1 (June 24–28) — Foundation
**Deliverable:** `docker compose up` → all services healthy. API responds. Analytics wired up from Day 1.

| Day | Tasks |
|-----|-------|
| Tue Jun 24 | ✅ Monorepo, Docker Compose, app scaffolds, shared package |
| Wed Jun 25 | Full database schema → Drizzle migrations → local Postgres |
| Thu Jun 26 | Auth module: PIN login + JWT. `POST /auth/pin` returns token |
| Fri Jun 27 | Products + Categories API. Audit log built (never bypass). PostHog account created |

**Exit criteria:** `curl localhost:3000/health` → ok. PIN login returns JWT. DB migrations clean.

**Analytics setup (this week):**
- Create PostHog Cloud account (free — 1M events/month)
- Add `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` to `.env`
- Install `posthog-js` in manager and dashboard apps (don't integrate yet — just install)
- Create Firebase project (needed for FCM in POS — also gives us Analytics free)

---

### WEEK 2 (June 30 – July 4) — Orders
**Deliverable:** Create order, add items, pay by cash. Complete restaurant order flow, server-side only.

| Day | Tasks |
|-----|-------|
| Mon Jun 30 | Orders API: create order, add items, update status |
| Tue Jul 1 | Customers API: create by phone, lookup by phone, auto-create on M-Pesa |
| Wed Jul 2 | Cash payment: `POST /orders/{id}/payments/cash` → marks paid, closes order |
| Thu Jul 3 | POS App skeleton: PIN login screen, product grid |
| Fri Jul 4 | POS App: cart screen + order submit + receipt screen |

**Exit criteria:** Login → pick items → checkout cash → order marked paid → receipt shown.

---

### WEEK 3 (July 7–11) — M-Pesa
**Deliverable:** Real M-Pesa STK Push end-to-end in Daraja sandbox.

| Day | Tasks |
|-----|-------|
| Mon Jul 7 | Daraja sandbox credentials. Test OAuth2 token endpoint |
| Tue Jul 8 | `POST /orders/{id}/payments/mpesa` → STK Push to customer phone |
| Wed Jul 9 | `POST /webhooks/mpesa` → payment confirmed → order marked paid |
| Thu Jul 10 | Idempotency keys. Timeout (60s) → retry prompt. Duplicate webhook guard |
| Fri Jul 11 | POS App: M-Pesa payment sheet. Real STK push on device |

**Exit criteria:** Order → STK push on real phone → PIN entered → POS shows "Paid" within 30 seconds.

---

### WEEK 4 (July 14–18) — WhatsApp + Offline
**Deliverable:** WhatsApp receipt sent. POS works with no internet.

| Day | Tasks |
|-----|-------|
| Mon Jul 14 | Meta WhatsApp Cloud API: phone ID, token, webhook verify endpoint |
| Tue Jul 15 | WhatsApp worker job: enqueued on `payment.confirmed` event via BullMQ |
| Wed Jul 16 | Receipt message template: items, total, M-Pesa ref, restaurant name |
| Thu Jul 17 | WatermelonDB in POS app: models mirror server schema |
| Fri Jul 18 | Offline order creation → local SQLite → sync queue on reconnect |

**Also this week:**
- Add PostHog `posthog-js` to manager and dashboard `main.tsx`
- Add Firebase Analytics to POS app (already have Firebase for FCM)
- Track first events: `order_started`, `payment_method_selected`, `mpesa_stk_initiated`

**Exit criteria:** Pay → within 30s → WhatsApp receipt arrives. Airplane mode ON → create order → pay cash → works. Reconnect → order syncs.

---

### July 21 — FIRST REAL SALE
**Goal:** One real restaurant owner using it for their dinner service.
- Book a beta restaurant in Nairobi
- Walk in with a laptop + Android device
- Take 3 real orders, process real M-Pesa payments, send real WhatsApp receipts
- **This is the milestone that matters.** Everything before this is preparation.

---

## MONTH 2 (July 21 – August 18) — Full Restaurant Operations

**Goal:** A manager can run a complete shift end-to-end. Inventory managed. Staff tracked. KRA receipts submitted.

---

### WEEK 5 (July 21–25) — Inventory + Recipe Costing
**Deliverable:** Stock levels tracked. Manager can receive stock. Food cost % visible.

- Inventory API: `GET /stock`, `POST /stock/adjust`, `POST /stock/receive`
- Recipe management: link ingredients to products with quantities + unit costs
- Food cost % per product: ingredient cost ÷ selling price (shown in Manager Portal)
- Auto-deduct from stock on every order item sold (via event bus, not direct coupling)
- Low-stock alert: BullMQ job → WhatsApp to manager when stock < threshold
- Wastage log: record with mandatory reason
- Supplier management: create supplier, set credit limit, track balance owed (Mkopo)

---

### WEEK 6 (July 28 – August 1) — Staff + Labor
**Deliverable:** Full staff management. Clock-in/out. Labor cost visible.

- Staff CRUD: create, invite via WhatsApp, deactivate (soft delete)
- Clock-in / clock-out: timestamps stored, optional selfie
- Manager override: fix forgotten clock-outs
- Weekly shift scheduling: assign staff to shifts in Manager Portal
- Labor cost tracking: hours worked × hourly rate (for weekly P&L)
- Staff loan/advance: record, repay via salary deduction
- PIN management: change PIN (manager or owner only)
- Staff performance view: sales per cashier, avg ticket, void rate

---

### WEEK 7 (August 4–8) — Manager Portal (Full UI)
**Deliverable:** Manager can run their entire shift from one web screen.

Manager Portal pages (React + Tailwind):
- **Overview:** shift summary, open orders, clocked-in staff, today's revenue
- **Staff:** clock-in list, roles, PIN reset, deactivate, invite
- **Inventory:** stock levels, receive stock, wastage log, low-stock list
- **Purchase Orders:** create from ML suggestions, send via WhatsApp, mark received
- **Shift Operations:** cash reconciliation (count till), M-Pesa reconciliation
- **Audit Log:** full timeline filtered by date, staff, action type — investigate any order
- **Reports:** sales by category, staff performance, items sold this shift

---

### WEEK 8 (August 11–15) — KRA eTIMS + Split Bill
**Deliverable:** Every Kenya receipt has KRA QR code. Split bill works.

- KRA eTIMS API integration: submit receipt on every paid order
- eTIMS receipt number + QR code printed/sent on receipt
- Failed eTIMS → retry queue (BullMQ), flag in dashboard if unresolved
- Split bill: divide order by seat number, by item selection, or evenly N ways
- Split payment: multiple methods on one order (e.g., KES 400 M-Pesa + KES 100 cash)

---

## MONTH 3 (August 18 – September 15) — Full Table Service

**Goal:** A full-service restaurant runs dine-in service: tables, kitchen, tableside ordering.

---

### WEEK 9 (August 18–22) — Tables + Floor Plan
**Deliverable:** Visual floor plan. Table statuses live. Reservations working.

- Floor plan editor in Manager Portal (drag-and-drop table positioning)
- Table CRUD: name, capacity, position, shape (rect/round), ghost tables
- Table status in POS: available (green) / occupied (red) / reserved (yellow) / cleaning (grey)
- Assign order to table: order carries table_id
- Table transfer: move open order to different table
- Table merge: combine two table bills into one
- Reservations: create with customer phone, party size, time, duration
- Reservation deposit: initiate M-Pesa STK push for deposit amount
- WhatsApp reminder: sent automatically 1 hour before reservation
- Waitlist: add walk-ins to queue, notify via WhatsApp when table ready

---

### WEEK 10 (August 25–29) — KDS Routing + Course Management
**Deliverable:** Orders automatically routed to kitchen stations. Courses fired on demand.

- KDS station configuration: name, categories that route here, display timeout
- Order routing: `order_item.kds_station_id` set on order creation by category
- Course management: items grouped by course (Appetizer / Main / Dessert)
- Fire course: server taps "Fire Mains" → only those items sent to KDS
- Socket.io real-time: new ticket appears on KDS instantly (Redis pub/sub adapter)
- Ticket timer: KDS shows elapsed time per ticket, turns red at warning threshold
- Bump station: kitchen marks item ready → triggers expo screen update

---

### WEEK 11 (September 1–5) — KDS Display + Printer Fallback
**Deliverable:** Kitchen display works on Android tablet. Printer fallback when KDS is down.

- KDS view in POS app: tablet mounted in kitchen, shows only that station's tickets
- Expo screen: all items from all stations that are ready, waiting for delivery
- KDS offline mode: if Socket.io disconnects, fall back to pull-to-refresh
- Kitchen printer: print ticket on order creation as fallback (thermal receipt printer)
- Print categories: each station can print only its relevant items
- Cook time analytics: avg ticket time per station, per item, per time of day

---

### WEEK 12 (September 8–12) — Server Mode + Tableside
**Deliverable:** Server takes order at the table on a handheld Android device.

- Server mode in POS app: shows table map → tap table → take order
- Tableside order: add items, modifiers, seat numbers per item
- Send to kitchen: fires to KDS from the table
- View running tab: server sees current bill for their tables
- Request payment: initiate M-Pesa STK push to customer's phone at table
- Multiple servers: each server sees only their assigned tables

---

## MONTH 4 (September 15 – October 13) — Intelligence Layer 1

**Goal:** Owner gets AI briefings every morning. Dashboard shows live business health. First ML model live.

---

### WEEK 13 (September 15–19) — Owner Dashboard
**Deliverable:** Owner opens their phone browser and sees live business health.

Owner Dashboard pages (React + Recharts + Tailwind):
- **Home (live, refreshes 60s):** total revenue today, this hour vs. yesterday hour, open orders, payment method split %, active staff, revenue vs. daily target progress bar
- **Branches:** per-branch revenue card, comparison table, offline branch alert
- **Menu:** product list, food cost %, enable/disable 86'd items
- **Settings:** business profile, WhatsApp number, M-Pesa shortcode, receipt settings, tax (KRA PIN)

---

### WEEK 14 (September 22–26) — ML Service Live
**Deliverable:** Prophet demand model trained on first 2 months of data. Forecasts show in Manager Portal.

- Train Prophet model on historical order data per product per business
- `POST /forecast/{business_id}` → 7-day demand forecast + items at stockout risk
- Stockout risk list shown in Manager Portal purchase order screen
- ML dispatch BullMQ job: retrain models weekly on Sunday 3AM
- Demand chart: show predicted vs. actual demand in Owner Dashboard

---

### WEEK 15 (September 29 – October 3) — Morning Briefing
**Deliverable:** Owner reads a smart WhatsApp briefing every morning before opening.

- BullMQ cron: `morning-briefing` job fires at 4AM per business
- Query: yesterday's data from read replica (orders, payments, staff, stock)
- Query: ML forecast — items at risk today
- Claude prompt: structured data + business context → narrative briefing in English or Swahili
- African context: "Tomorrow is Idd ul Fitr — historically your busiest day, stock ugali 3× normal"
- WhatsApp delivery: formatted message to owner's personal number
- Briefing archive: stored in DB, viewable in Owner Dashboard Intelligence page
- Reply support: owner replies "MORE DETAIL" → Claude expands → second WhatsApp

---

### WEEK 16 (October 6–10) — NL Query + Product Recommendation
**Deliverable:** Owner asks questions in plain Swahili/English. Checkout recommends add-ons.

- "Ask anything" in Owner Dashboard: text box → Claude API → structured answer + supporting data
- Context injection: last 30 days of business data sent with each query
- "Mauzo ya ugali wiki iliyopita?" → "Ugali iliuzwa mara 342, jumla KES 171,000"
- Product recommender (Month 4): build item co-occurrence matrix from order history
- `POST /ml/recommend` → given current cart items → returns top 3 add-ons
- POS checkout screen: shows "Customers also order: [Chai, Mandazi, Juice]" tap to add

---

## MONTH 5 (October 13 – November 10) — Customer Loyalty + Retention

**Goal:** Customers have loyalty profiles. At-risk customers are identified and won back automatically.

---

### WEEK 17 (October 13–17) — Loyalty Program
- Earn points: configurable rate per KES spent (e.g., 1 point per KES 10)
- Redeem points: points → discount at checkout (configurable conversion rate)
- Tier auto-upgrade: Bronze → Silver at KES 5,000 total spend; Silver → Gold at KES 25,000
- Tier upgrade WhatsApp: "Hongera! You've reached Gold status. Enjoy 10% on your next visit."
- Loyalty balance check: customer can WhatsApp "POINTS" → auto-reply with balance
- Loyalty history: full earn/redeem ledger per customer in Owner Dashboard

---

### WEEK 18 (October 20–24) — Credit Tabs (Oweame)
- Credit tab: charge an order to a customer's running tab (no cash required)
- Credit limit: set per customer (owner can adjust)
- Tab payment: customer pays off balance via M-Pesa or cash
- Credit statement: send to customer via WhatsApp ("You owe KES 2,400")
- Credit alert: WhatsApp to manager when a customer approaches their limit
- Credit report: all outstanding tabs in Owner Dashboard

---

### WEEK 19 (October 27–31) — Churn Prediction + Win-Back
- Train LightGBM churn classifier on RFM features (recency, frequency, monetary)
- Churn threshold: customers with `churn_probability > 0.75` flagged
- Automated win-back: BullMQ weekly job → WhatsApp message to at-risk customers
- Win-back message: "Tumekukosa! Karibu tena, pata 10% discount" (Claude-generated per customer)
- Customer feedback: after visit, WhatsApp "Rate your experience: 1-5"
- Feedback loop: low ratings (1-2) → immediate WhatsApp alert to manager

---

### WEEK 20 (November 3–7) — Gift Cards + CLV
- Gift cards: issue with a unique code, redeemable at any branch
- Gift card balance check via WhatsApp
- CLV prediction: train BG/NBD model on purchase history
- CLV output: predicted 90-day spend per customer
- CLV uses: inform credit limit decisions, identify VIP customers worth rewarding
- Birthday offer: auto WhatsApp + discount on customer's birthday

---

## MONTH 6 (November 10 – December 8) — Scale + Deep Restaurant

**Goal:** 50+ restaurants active. Multi-location owners happy. Delivery orders in the system. Cost structure tracked.

---

### WEEK 21–22 (November 10–21) — Multi-Location + Delivery

- Consolidated owner dashboard: all branches, total revenue, branch comparison
- Inter-branch stock transfer: move inventory between locations
- Delivery integration: Deliverect → Bolt Food, Glovo, Uber Eats, Jumia
- Delivery orders appear in POS as a separate channel (`channel: 'delivery'`)
- Platform fee tracking: deduct delivery platform commissions from revenue reporting
- Delivery aggregator reconciliation: orders received vs. paid out by platform

---

### WEEK 23–24 (November 23 – December 4) — Labor + Financial Ops

- Staff scheduling UI in Manager Portal: weekly calendar, shift assignment
- Labor cost: hours × rate per staff → weekly labor cost report
- Labor % of revenue: show as a KPI alongside food cost %
- Daily float management: opening float entry, closing cash count, variance report
- Cash drawer log: every open tracked in audit log
- Evaluate Railway costs: if > KES 50,000/month → start AWS migration plan

---

## MONTH 7 (December 8 – January 5, 2027) — WhatsApp as a Platform

**Goal:** Customers order via WhatsApp. QR codes at tables. Kiosk mode live. WhatsApp fast-path live.

---

### WEEK 25–26 (December 8–19) — WhatsApp Commerce + QR Ordering

- WhatsApp ordering: customer sends message → Claude parses intent → confirms order → initiates M-Pesa
- WhatsApp fast-path NLP: simple orders ("2 ugali 1 chai") → local rule-based parser → skip Claude
- Fast-path routing: `confidence > 0.9` → local parse, else → Claude API (60-70% cost saving at scale)
- QR table ordering: each table has a unique QR → customer scans → mobile ordering page
- Online ordering page: `restaurant-name.africanpos.co` → full menu → M-Pesa checkout

---

### WEEK 27–28 (December 22 – January 2) — Kiosk + Self-Service

- Kiosk mode in POS app: full-screen menu on tablet at restaurant entrance
- Customer taps items → adds to cart → proceeds to payment
- Kiosk payment: M-Pesa QR code shown → customer scans → confirms
- No staff needed: order goes directly to KDS
- Kiosk analytics: which items are most clicked, abandoned carts, conversion rate

---

## MONTH 8–9 (January–February 2027) — Financial Intelligence

**Goal:** Owner understands cash flow, food cost, and tax exposure. Accounting synced automatically.

- DuckDB OLAP: read replica → in-process analytics queries (no Redshift needed)
- Cash flow forecast: 30-day revenue projection based on historical patterns
- Food cost dashboard: actual food cost % vs. target, per item, per week
- Tax savings: estimated VAT liability, recommended monthly set-aside
- M-Pesa till sweep: automatic daily sweep to bank account (via Daraja B2C)
- Merchant advance: surface eligibility based on revenue history
- Catering module: future-date order, deposit, production sheet, balance due
- Xero / QuickBooks: sync daily revenue summary, VAT totals, supplier invoices
- Menu engineering deep: LightGBM full Stars/Plowhorses/Puzzles/Dogs with price elasticity

---

## MONTH 10–12 (March–May 2027) — Africa Expansion

**Goal:** 500+ restaurants. East Africa footprint. AWS migration complete.

---

### Infrastructure Migration
- AWS migration: RDS PostgreSQL Multi-AZ, ElastiCache Redis, ECS Fargate
- Region: af-south-1 (Cape Town) — lowest latency for East Africa
- Trigger: Railway cost exceeds KES 50,000/month OR 500 merchants

### Payment Expansion
- MTN MoMo: Ghana, Uganda, Rwanda, Cameroon
- Airtel Money: Kenya, Uganda, Tanzania, Zambia
- Flutterwave card: physical card terminal integration
- Paystack: Nigeria market entry
- DPO Group: Southern Africa expansion

### Compliance Expansion
- Uganda EFRIS: electronic receipt integration
- Nigeria FIRS: e-invoicing compliance
- Rwanda RRA: digital tax receipts

### Language & Localization
- Swahili UI: full translation of Manager Portal + Owner Dashboard
- Yoruba support in AI briefings (Nigeria)
- French support in AI briefings (Senegal, Ivory Coast)

### PostHog Self-Hosted Production
- Deploy PostHog on AWS when merchant count makes cloud tier expensive
- Full session recording for UX research on low-end Android devices
- A/B test upsell message variants (kiosk feature, credit tab pitch)

---

## KEY METRICS TO HIT (by milestone)

| Metric | Month 1 | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|---------|---------|
| Restaurants live | 1 (beta) | 10 | 50 | 500 |
| Daily active restaurants | 1 | 8 | 40 | 400 |
| M-Pesa transactions/day | 20 | 200 | 2,000 | 20,000 |
| WhatsApp messages/day | 5 | 50 | 500 | 5,000 |
| Avg payment latency (M-Pesa) | < 30s | < 20s | < 20s | < 15s |
| Uptime | 99% | 99.5% | 99.9% | 99.95% |
| Offline resilience | 72h | 72h | 72h | 72h |

---

## NON-NEGOTIABLE RULES (every feature, no exceptions)

1. Works on KES 12,000 Android phone on 2G
2. Works fully offline OR degrades gracefully with visible badge
3. Untrained restaurant owner completes the task in < 60 seconds
4. Critical events trigger a WhatsApp notification (payment, low stock, void spike)
5. Every destructive action has an audit log entry with reason
6. API endpoint documented in OpenAPI 3.0 with examples before shipping
7. Failure states designed before feature ships (M-Pesa timeout, KDS offline, printer empty, no receipt)
