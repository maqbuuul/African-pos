# The Master Build Document
## Architecture Decisions + Full Feature Blueprint + Build Order

> This is the single source of truth. Every decision is made. Every feature is listed. Start here every morning. When in doubt, this document wins.

---

## PART 1 — DECISIONS LOCKED

### 1.1 What We Are Building

An **African-first restaurant and hospitality POS system** that starts in Nairobi and expands across the continent. It is purpose-built for Africa's realities — mobile money, unreliable power, offline connectivity, WhatsApp as primary communication, informal market trading patterns, and African tax compliance — while incorporating every best feature from global leaders that they spent hundreds of millions learning.

No global leader (Toast, Square, Lightspeed, Revel, Shopify) has solved for Africa. Local African players (Loyverse, Yoco, iKhokha) lack the depth, AI, and product ambition. The gap is ours.

**Positioning**: The Restaurant Operating System for Africa.

---

### 1.2 Architecture Decision — Modular Monolith (NOT Microservices)

**Decision: Build a Modular Monolith. No microservices until you have 10+ engineers.**

Microservices require dedicated ops engineers for service discovery, distributed tracing, independent CI/CD pipelines, and cross-service debugging. A solo founder running microservices is a founder who deploys infrastructure instead of features. Every global POS leader (including Shopify, Stack Overflow, and Basecamp) ran monoliths through their early years.

The "API-first" principle from Revel and Shopify means **clean API contracts** — not separate servers. A modular monolith exposes the same clean REST/WebSocket API to the outside world.

**Internal module structure (same process, clean domain boundaries):**
```
api-server/
├── modules/
│   ├── orders/          — Order lifecycle, kitchen routing, status updates
│   ├── inventory/       — Products, stock, alerts, purchase orders
│   ├── customers/       — Profiles, loyalty, identity, credit tabs
│   ├── payments/        — Provider adapters: M-Pesa, MTN, card, cash
│   ├── staff/           — Auth, roles, clock-in/out, performance
│   ├── tables/          — Floor plan, reservations, waitlist
│   ├── kitchen/         — KDS routing, station management, timers
│   ├── reports/         — Analytics queries, PDF generation, benchmarks
│   ├── notifications/   — WhatsApp, SMS, push notification dispatch
│   ├── integrations/    — Deliverect, Xero, third-party webhooks
│   └── audit/           — Every destructive action logged here
├── shared/
│   ├── database/        — PostgreSQL client, migration runner
│   ├── cache/           — Redis client
│   ├── queue/           — BullMQ job definitions
│   ├── events/          — Internal event bus (emitter pattern)
│   └── auth/            — JWT validation middleware
└── server.ts            — Fastify bootstrap, plugin registration
```

**Three processes that ARE separate from Day 1:**
```
1. ml-service/           — Python (Prophet + LightGBM), stateless HTTP API
2. worker/               — BullMQ workers (background jobs: PDFs, WhatsApp, sync queue)
3. kds-hub/              — WebSocket hub for kitchen displays (Socket.io)
                           Can run in same Fastify process initially, extract under load
```

**Why this is still API-first:**
Every module is accessed only through its public service layer. The HTTP API is documented in OpenAPI 3.0. Third parties call the same API your own frontend does. When you eventually extract a module into a microservice, the API contract is already defined and nothing externally breaks.

---

### 1.3 Tech Stack — Locked

Every choice below is decided. Do not revisit unless a technology stops being maintained.

#### POS Terminal Application
```
Framework:       React Native (TypeScript) — one codebase for Android + iOS
Android-first:   90%+ of African hospitality devices run Android
Local Database:  WatermelonDB (SQLite-backed, built for React Native, fast sync)
Sync Engine:     Custom bidirectional sync built on WatermelonDB + REST
Offline State:   All writes go local first. Online state is a background condition.
State:           Zustand (lightweight, TypeScript-native)
UI Components:   React Native Paper (Material Design 3, accessible, well-tested)
Navigation:      React Navigation v7
Receipts:        react-native-thermal-receipt-printer-image-qr
Barcode:         react-native-vision-camera + MLKit barcode scanning
Payments:        Custom Daraja.js wrapper + socket listener for M-Pesa callbacks
Push:            Firebase Cloud Messaging (FCM)
```

#### Owner Dashboard (Separate App)
```
Framework:       React (TypeScript) — web app, not React Native
                 Owners check revenue on phone browser, not a separate app download
Routing:         React Router v7
State:           Zustand
Charts:          Recharts (lightweight, customizable, React-native)
Tables:          TanStack Table v8
PDF Export:      react-pdf
Date/time:       date-fns (no moment.js, tree-shakeable)
Styling:         Tailwind CSS v4
Build:           Vite
```

#### Backend API Server
```
Runtime:         Node.js 22 LTS (TypeScript with tsx + tsc)
Framework:       Fastify v5 (fastest Node.js framework, TypeScript-first)
Validation:      Zod (schema validation, TypeScript inference)
ORM:             Drizzle ORM (TypeScript-native, close to raw SQL, fast)
Auth:            jose (JWT) — HS256 for inter-service, RS256 for external
2FA:             TOTP via otplib
Rate Limiting:   @fastify/rate-limit on Redis
API Docs:        @fastify/swagger + Scalar UI (auto-generated from Zod schemas)
File Uploads:    @fastify/multipart
WebSockets:      Socket.io v4 (KDS real-time, tableside status)
```

#### Data Layer
```
Primary DB:      PostgreSQL 16 (transactions, relational integrity, row-level security)
Cache:           Redis 7 (sessions, rate limits, real-time counters, pub/sub for KDS)
Queue:           BullMQ on Redis (background jobs, retry logic, scheduled tasks)
Search:          Meilisearch (product search — faster to deploy than Elasticsearch)
Analytics:       DuckDB (in-process OLAP for fast analytics queries on historical data)
File Storage:    Cloudflare R2 (no egress fees, S3-compatible API)
Migrations:      Drizzle Kit (TypeScript migration files, version controlled)
```

#### ML Service (Python)
```
Runtime:         Python 3.12 + FastAPI
Forecasting:     Prophet (time-series demand forecasting with African holidays)
Classification:  LightGBM (fast gradient boosting for menu engineering, churn)
Anomaly:         Isolation Forest (sales drop, void spike detection)
Embeddings:      Sentence-Transformers (semantic product search)
API:             FastAPI + uvicorn (internal only, not exposed to internet)
Scheduling:      Called by BullMQ worker nightly, not a cron job
```

#### AI Layer
```
LLM:             Claude claude-sonnet-4-6 (Anthropic API)
Use cases:       Natural language reporting, AI briefing, WhatsApp order parsing,
                 supplier invoice OCR, menu description generation, coaching text
Voice:           AWS Transcribe (Swahili + English) → Claude → action
Prompts:         Stored in version-controlled prompt files, not hardcoded
Context:         Business schema injected per request (no fine-tuning needed)
```

#### Payments & Integrations
```
Mobile Money:    Safaricom Daraja API v3 (M-Pesa Kenya — STK Push, C2B, B2C)
                 MTN MoMo API (Ghana, Uganda, Rwanda, Cameroon)
                 Airtel Money API (Kenya, Uganda, Tanzania, Zambia)
                 Orange Money API (West Africa)
Card:            Flutterwave (primary — 34 African countries)
                 Paystack (Nigeria + Ghana primary)
                 DPO Group (East + Southern Africa)
USSD:            Africa's Talking USSD API
SMS:             Africa's Talking SMS API (fallback for WhatsApp)
WhatsApp:        Meta WhatsApp Business API (Cloud API — no 3rd party needed)
Delivery:        Deliverect API (aggregates: Bolt Food, Jumia Food, Glovo, Uber Eats)
Accounting:      Xero API, QuickBooks API
Tax:             Kenya TIMS (KRA), Uganda EFRIS, Nigeria FIRS — direct integrations
```

#### Infrastructure (Start Cheap, Scale Smart)
```
Start:           Railway.app (managed PostgreSQL + Redis + Node deployments)
                 Zero ops overhead. $20-100/month until 500+ merchants.
Scale to:        AWS (ECS Fargate + RDS PostgreSQL + ElastiCache Redis)
                 When Railway costs exceed $500/month or compliance requires it
CDN:             Cloudflare (free tier covers everything for years)
DNS:             Cloudflare DNS
SSL:             Cloudflare SSL (automatic, free)
Monitoring:      Sentry (errors), PostHog (product analytics), Grafana Cloud (metrics)
Logging:         Pino (Fastify native) → Grafana Loki
Secrets:         Railway Secrets (dev) → AWS Secrets Manager (production)
CI/CD:           GitHub Actions (test → build → deploy to Railway)
```

#### Developer Tooling
```
Monorepo:        Turborepo (apps/pos, apps/dashboard, apps/api, packages/shared)
Package Manager: pnpm
TypeScript:      Strict mode. No any. No @ts-ignore without explanation.
Linting:         ESLint + eslint-config-turbo
Formatting:      Prettier
Testing:         Vitest (unit + integration) + Playwright (E2E dashboard)
                 React Native Testing Library (component tests)
Git Hooks:       Husky + lint-staged (format + lint before commit)
Environment:     dotenv-safe (fail loudly if env vars missing)
```

---

## PART 2 — THE COMPLETE FEATURE BLUEPRINT

All features organized by: **stolen from whom** + **what we add on top** + **when we build it**.

---

### TIER 1 — LAUNCH FEATURES (Month 1-3)
*Without these, merchants cannot operate. Ship nothing else first.*

---

#### F-001 — Core POS Selling
**Stolen from**: Toast, Square (universal — every leader has this)
**Build**: Add items to cart by tap or barcode scan. Search products by name. Adjust quantity. Remove items. Apply modifiers (extra cheese, no onion, spicy). Add order notes per item. Hold an open order (park and return). Transfer between staff members.

**We add on top**:
- Quick-add grid with most-sold items (learned automatically, no manual config)
- Bulk items by weight/count (maize flour per kg, sugar per 250g)
- Photo-based lookup — tap photo of item if no barcode and no name match
- Multi-language item names (Swahili alongside English on same button)

---

#### F-002 — Cash Payment + Change Calculator
**Stolen from**: Every POS
**Build**: Enter cash received, POS calculates change due. Support denomination breakdown for reconciliation.

**We add on top**:
- Change calculator in KES by denomination (1000, 500, 200, 100, 50, 20, 10, 5, 1)
- "Short change" alert — if cashier gives wrong change 3x in a row, flag for manager

---

#### F-003 — M-Pesa Native Payment (STK Push + QR + Paybill)
**Stolen from**: Nobody has this natively. This is ours.
**Build**:
- STK Push: enter customer phone → prompt appears on their phone → they confirm → POS marks paid automatically via webhook
- Paybill QR: static QR on screen/printed receipt for self-scan payment
- Till Number QR: for merchants using Buy Goods (Till)
- Auto-detect if payment came in via webhook in background (no manual confirmation)
- M-Pesa reference code stored on payment record
- Mobile money fee auto-deducted from net revenue calculation (2.5% M-Pesa fee shown separately)

**We add on top**:
- Offline M-Pesa QR (static QR works without internet — confirms on reconnect)
- Auto-reconcile M-Pesa statement vs. POS payments at end of shift
- M-Pesa fee tracking as a cost line in daily P&L

---

#### F-004 — WhatsApp Receipt (Default)
**Stolen from**: Nobody does this. Our invention for Africa.
**Build**: After every payment, send WhatsApp message to customer's phone with:
- Order items, quantities, unit prices
- Subtotal, tax, total
- Payment method and reference (M-Pesa code, cash amount)
- Business name, location, date/time
- Loyalty points earned + current balance
- Loyalty progress bar ("3 more visits for a free item")

**We add on top**:
- Customer can reply to receipt with "RETURN" to initiate return request
- Customer can reply "RECEIPT" anytime to get last receipt resent
- Receipt in Swahili if customer's preferred language is Swahili

---

#### F-005 — True Offline Mode (72-Hour Capable)
**Stolen from**: TouchBistro (local-first) + Erply (unlimited offline)
**Build**: Every transaction writes to local WatermelonDB first. Cloud sync happens in background. If offline: full POS operation continues. Cash, M-Pesa offline QR, and card store-and-forward all work. Sync queue processes on reconnect with conflict resolution.

**We add on top**:
- Load shedding mode: power-cut detection → dim screen → disable non-essential features → show "X minutes of battery remaining"
- Mobile hotspot failover: auto-switch to 4G SIM data when main router loses power
- Offline indicator badge: visible always — green (online), orange (offline, syncing), red (offline, queue backing up)
- "Offline since X hours ago" shown to manager in owner dashboard

---

#### F-006 — Product & Inventory Management
**Stolen from**: Square, Lightspeed Retail
**Build**: Create/edit/delete products. Categories. Subcategories. Stock quantity per location. Low stock threshold. Receive stock. Barcode assignment. Product images.

**We add on top**:
- No-barcode mode: photo + name + price only (for informal market traders)
- Bulk/loose item mode: sell by weight or count (maize per kg, fabric per meter)
- Photo-only search: find product by tapping its image (no need to remember name)

---

#### F-007 — Staff Management + Role-Based Access
**Stolen from**: Toast (staff roles), Square (PIN login)
**Build**: Staff roles: Owner, Manager, Cashier, Server, Kitchen Staff. PIN-based login on POS terminal (4-digit PIN, no password typing during service). Role permissions: cashiers cannot process refunds, servers cannot see reports, only managers can void orders. Clock in/out per shift.

**We add on top**:
- Staff invite via WhatsApp (send join link — no email account required)
- Staff PIN shows their name on receipt: "Served by Grace"
- Clock-in photo (optional, for accountability)
- PIN-change by manager remotely (without needing the device)

---

#### F-008 — Multi-Tenant Architecture (Multiple Businesses + Branches)
**Stolen from**: Revel, Erply
**Build**: One owner account → multiple businesses (restaurant + retail shop + salon). Each business → multiple locations/branches. Staff belong to a location. Data is completely isolated by business_id with PostgreSQL row-level security.

**We add on top**:
- Cross-business view for owner: all businesses' revenue in one screen
- Consolidated daily WhatsApp: "Total revenue across your 3 businesses today: KSh 87,400"
- One subscription, multiple businesses (not per-location pricing that penalizes growth)

---

#### F-009 — Live Owner Dashboard (Today's Revenue)
**Stolen from**: Toast Now (real-time mobile dashboard)
**Build**: Web app showing: live transaction feed, today's revenue, average transaction value, top items today, payment method breakdown, staff clock-in status, open orders count.

**We add on top**:
- "Payday effect" alert: "Today is the 25th — historically your 3rd busiest day. Consider extra staff."
- Revenue milestone notifications: "You just hit KSh 50,000 today!" sent via WhatsApp
- Multi-branch switcher: owner sees all branches in one dashboard, can drill into any

---

#### F-010 — Audit Log (Full Investigation Trail)
**Stolen from**: Enterprise POS systems (Oracle MICROS, NCR)
**Build**: Every destructive or significant action is logged with: who, what changed (old → new JSON snapshot), why (reason required for refunds/voids), when, where (device ID, IP address), order/entity it relates to.

Logged events:
- `void_order` — full order cancelled
- `refund_payment` — payment reversed
- `discount_applied` — price reduced
- `comp_item` — item comped (given free)
- `price_change` — product price modified
- `delete_product` — product removed
- `stock_adjust` — inventory manually changed
- `cash_drawer_open` — till opened without sale
- `login_failed` — failed PIN attempt
- `manager_override` — manager approved restricted action
- `settings_change` — any system setting modified
- `staff_created` / `staff_deleted` — team changes
- `refund_void` — refund itself voided

**We add on top**:
- Owner app audit viewer: filterable by staff, action type, date range, amount
- "Investigate order" — one-click view of every event in an order's lifecycle
- Anomaly alerts: "5 voids in the last hour by Cashier David — unusual pattern"
- Export audit report to PDF for accountant or legal investigation

---

#### F-011 — KRA TIMS Tax Compliance (Kenya)
**Stolen from**: Nobody. Gap in all global players.
**Build**: Kenya Revenue Authority TIMS-compliant receipts. VAT calculation at correct rates. ETR receipt format. Z-report generation for daily submission. ESD integration for fiscal device sign-off.

**We add on top**:
- Uganda EFRIS integration (Phase 2)
- Nigeria FIRS integration (Phase 2)
- Tax exemption categories (medical items, NGO purchases, zero-rated goods)
- Tax report export in KRA format for annual filing

---

### TIER 2 — RETENTION FEATURES (Month 3-6)
*Required to keep merchants past 90 days. Missing these causes churn.*

---

#### F-012 — Restaurant Table Management
**Stolen from**: Toast Tables, TouchBistro, Lightspeed
**Build**: Visual floor plan (drag-and-drop table layout setup by manager). Table status: available / occupied / reserved / cleaning. See table occupancy time, current order total, assigned server. Transfer orders between tables.

**We add on top**:
- Table color codes by alert: green (available), blue (ordered, waiting), yellow (order ready, not yet served), red (overdue — table time exceeded predicted turn time)
- "Ghost table" feature: add outdoor, rooftop, or pop-up tables temporarily without redesigning floor plan
- Table capacity warnings: "Table 4 seated 8, capacity is 6 — manager approval required"

---

#### F-013 — Kitchen Display System (KDS)
**Stolen from**: Toast KDS, Oracle MICROS KDS
**Build**: Real-time digital kitchen display replacing paper tickets. WebSocket-powered (Socket.io) — orders appear instantly when placed. Color coding by ticket age: green → yellow → red as time passes. Multi-station routing: bar gets drinks, kitchen gets food, pastry gets desserts. Bump when complete. Expo screen shows what's ready for food runners.

**We add on top**:
- AI-adjusted cook times: system learns actual cook times per item and adjusts firing sequences ("the burger takes 9 minutes, not 6 — fire it 3 minutes earlier")
- Cross-station coordination alerts: "Steak 2 minutes from done — fire fries now"
- Order consolidation: 3 tickets each with "Chips" → KDS shows "12 chips needed now" not three separate "4 chips"
- Rush order visual: VIP, allergy, or rushed tickets highlighted differently from standard
- Production batching: "You have 8 burger orders — batch them together"
- Average ticket time: gamify kitchen speed — show daily average vs. yesterday

---

#### F-014 — Customer Profiles + Loyalty
**Stolen from**: Toast Loyalty, SpotOn (phone-number loyalty), HungerRush (caller ID memory)
**Build**: Customer record by phone number as universal ID. Every M-Pesa payment auto-captures phone. Points earned per KSh spent. Points redemption at checkout. Visit count, total spent, last visit tracked.

**We add on top**:
- M-Pesa phone auto-capture: customer pays with M-Pesa → their phone number is their loyalty ID — no staff prompt needed
- WhatsApp loyalty: customer texts your number once → captured → all future visits auto-linked
- Birthday recognition: auto-send WhatsApp birthday message + special offer
- Customer notes: staff notes visible at checkout ("allergic to nuts", "prefers Table 7", "always orders extra sauce")
- Churn prediction: if customer hasn't visited in 2× their usual frequency → trigger win-back
- Win-back campaign: auto-send WhatsApp "We miss you! Here's 20% off your next visit" — track conversion

---

#### F-015 — Customer Running Credit Tab (Oweame)
**Stolen from**: Nobody has this natively. Africa-original.
**Build**: Trusted regular customers buy on credit. Open a credit account per customer. Add any purchase to their tab. Track outstanding balance. Alert when credit limit reached. Payment collection tracking. WhatsApp statement on demand.

**We add on top**:
- Credit limit per customer (set by manager)
- "Pay tab" flow: customer comes to settle — one screen shows full balance, takes partial or full payment
- WhatsApp monthly statement: auto-send on 1st of month with itemized balance
- Credit risk flag: customers with balance older than 30 days flagged in dashboard
- Supplier credit mirror: same module tracks what YOU owe suppliers (Mkopo feature)

---

#### F-016 — QR Code Table Ordering
**Stolen from**: Toast Order & Pay, Lightspeed Order Anywhere
**Build**: QR code generated per table (static URL). Customer scans → branded ordering page (no app download). Sees full menu with photos, descriptions, allergens. Adds to cart. Places order (goes to KDS instantly). Pays via M-Pesa STK push or card. WhatsApp receipt sent.

**We add on top**:
- Order timeline: customer sees real-time kitchen status on their phone ("Being prepared", "On its way")
- QR-based dish rating: customer rates each dish as it arrives → feedback visible to kitchen in real time
- Group QR: one table, multiple phones, each person orders own items, all linked to one table, each pays their share separately
- Course-aware ordering: customer can fire next course from their phone ("Ready for dessert")
- WhatsApp-based ordering alternative: for customers who prefer WhatsApp over browser

---

#### F-017 — Split Bill
**Stolen from**: Toast (split check by seat via text link)
**Build**: Split by seat, split equally N ways, split by custom amounts, or split by specific items. Each person receives WhatsApp payment link.

**We add on top**:
- WhatsApp split link (not SMS — higher open rate in Africa)
- M-Pesa STK push per person from their share amount
- "One person pays" override — one person opts to pay for everyone, one M-Pesa request for total

---

#### F-018 — Advanced Multi-Payment
**Stolen from**: Toast, Square, Lightspeed
**Build**: Split payment across methods in one transaction (KSh 500 cash + KSh 1,200 M-Pesa). Partial payment (customer pays deposit, balance later). Refund partial or full with manager approval.

**We add on top**:
- Void vs. refund distinction: void (order never completed, no payment), refund (payment reversed after completion) — different audit trails
- Reason required for all refunds: dropdown + optional note
- Refund to original method or to loyalty points (customer's choice)

---

#### F-019 — Menu Engineering AI (BCG Matrix)
**Stolen from**: Toast (Menu Engineering Report) — charges consultants $10,000 for this
**Build**: Every menu item plotted on 2×2 matrix: profitability (high/low) × popularity (high/low). Auto-calculated from POS data. Four quadrants: Stars (promote), Plowhorses (reprice), Puzzles (needs marketing), Dogs (consider removing).

**We add on top**:
- True gross margin axis (uses actual ingredient cost, not just selling price)
- Auto-generated action recommendations per item: "Ugali is a Plowhorse — high sales, 18% margin. Reduce portion by 10g or raise price by KSh 20 to reach 28% margin."
- Price simulation: drag item price on slider → see what quadrant it moves to
- Seasonal overlay: item is a Star in December, Dog in August — don't remove it, just adjust seasonally
- Send analysis to manager via WhatsApp weekly

---

#### F-020 — AI Natural Language Reports
**Stolen from**: Toast IQ, Lightspeed AI (closest approximation)
**Build**: Any staff member or owner types a question in plain English (or Swahili) and gets an answer within 3 seconds.

Examples:
- "Niuambie mauzo yangu ya jana" → "Mauzo ya jana yalikuwa KSh 87,400 — ongezeko la 12% ukilinganisha na wiki iliyopita"
- "Which items haven't sold in 30 days?"
- "What was my busiest hour last Friday?"
- "How much did Grace sell this week?"
- "Compare this week to last week by category"

Implementation: LLM (Claude claude-sonnet-4-6) receives question + business schema context + 90-day data summary → generates SQL → executes on read-only connection → LLM formats answer in natural language + optional chart.

**We add on top**:
- Voice input: owner speaks question (English or Swahili) → transcribed → answered
- Action suggestions appended: "Your fish hasn't sold in 8 days. Want me to add it to today's specials?"
- Answer delivered via WhatsApp if question asked from WhatsApp

---

#### F-021 — Handheld Tableside Ordering (Server Mode)
**Stolen from**: Toast Go 2 (purpose-built handheld for tableside ordering)
**Build**: Same React Native POS app, "Server Mode" profile — simplified UI optimized for one-handed use on small screen. Server selects table, adds items, sends to kitchen, takes payment at table. No separate app needed.

Runs on: Sunmi M2, Sunmi V2s, any Android 6"+ device.

**We add on top**:
- Server sees their own table map (only their assigned tables)
- Offline-capable: server moves to dead zone in venue — orders still queued locally and sync when back in range
- Tableside M-Pesa: send STK push to customer's phone from server's handheld
- "Pay at table in 60 seconds" — server presents bill, customer pays from phone, server confirms on handheld — no card machine walk needed

---

#### F-022 — Product Variants (Size × Color × Style)
**Stolen from**: Lightspeed Retail, Shopify (matrix inventory)
**Build**: Parent product "Nike T-Shirt" → children: Small/Black, Small/White, Medium/Black. Each variant: own stock count, own price, own barcode. Bulk price update across all variants. Single screen to manage all variants.

---

#### F-023 — Layaway / Installment Deposit Module
**Stolen from**: NCR Counterpoint
**Build**: Layaway record per customer: item held, deposit paid, balance due, payment schedule. Installment payments recorded. Item released only on full payment. WhatsApp reminders before each payment due date.

**We add on top**:
- Rent-to-own variant: portion of each payment applies to ownership (household goods, electronics)
- WhatsApp payment link for each installment due
- Layaway report: total stock held in layaway, total deposits collected, expected completion dates

---

#### F-024 — Purchase Orders to Suppliers
**Stolen from**: Lightspeed Retail, NCR
**Build**: Create PO from low-stock alerts (auto-generate) or manually. Supplier receives PO via WhatsApp or email. Supplier confirms → expected date appears in system. Goods received → inventory updated. Discrepancy report if received quantity ≠ ordered.

**We add on top**:
- Supplier catalog import: partner with local distributors — Indomie, Tusker, Safaricom accessories — merchant searches, product data pre-filled
- Reorder queue: system generates a "suggested reorder list" based on ML demand forecast — manager approves with one tap
- Supplier credit tracking: record what you owe each supplier (Mkopo feature), payment schedule, WhatsApp reminders

---

#### F-025 — Reservations + Waitlist
**Stolen from**: Toast Tables (SMS waitlist), TouchBistro (two-way SMS waitlist)
**Build**: Reservation booking per table. Party size, date/time, special requests, notes. Waitlist for walk-ins when full.

**We add on top**:
- WhatsApp confirmation (not SMS — same open rates, free for customer)
- Two-way WhatsApp waitlist: "Reply HERE when you arrive and we'll seat you immediately"
- Google Calendar sync for owner (reservation appears in personal calendar)
- No-show tracking: customer marked as no-show → loyalty points docked (optional, owner configured)
- Automated reminder: "Your reservation at Mama's Kitchen is in 2 hours! Reply CANCEL if you can't make it."

---

### TIER 3 — DIFFERENTIATION FEATURES (Month 6-12)
*These win competitive bakeoffs. Without them you survive; with them you dominate.*

---

#### F-026 — AI Morning Briefing (6 AM WhatsApp)
**Stolen from**: Lavu's Marty AI (6-agent system — most advanced POS AI available)
**Build**: Nightly job runs at 4 AM. Claude claude-sonnet-4-6 analyzes yesterday's data across all modules. By 6 AM, owner receives WhatsApp with:
1. Revenue summary vs. same day last week (with % change)
2. Best-selling item and worst-performing item
3. Staff highlight: best performer + coaching note for underperformer
4. Kitchen: average ticket time vs. target
5. Inventory: items at risk of running out today based on yesterday's velocity
6. AI insight: one specific, actionable recommendation ("Grilled fish hasn't sold in 3 days — consider a lunch special today")

**We add on top**:
- Multi-business version: one briefing covers all owner's businesses
- "Event awareness": if the AI detects a pattern around a specific upcoming date (payday, school holiday, local event) it mentions it
- Owner can reply "MORE DETAIL on inventory" and get expanded breakdown
- Briefing in Swahili if owner's preference is set to Swahili

---

#### F-027 — Competitive Benchmarking (The Lightspeed Killer Feature)
**Stolen from**: Lightspeed Benchmarks & Trends (updated daily using anonymized network data)
**Build**: As merchant network grows, aggregate anonymized data by: restaurant type, location, city, price tier. Show each merchant:
- My average check: KSh 850 | Similar restaurants in my area: KSh 1,100
- My table turn time: 52 min | Area average: 44 min
- My food cost %: 38% | Area average: 31%
- My busiest hour: 1 PM | Area average: 12:30 PM

Requires minimum 10 merchants in same city/category to show benchmarks (privacy threshold).

**We add on top**:
- Framed positively: "Your top-performing peers are doing X" — not "you're below average"
- Top quartile target: "If you reduce table turn time by 8 minutes, you'd be in the top 25% of restaurants in your area"
- Benchmarks for African business types that don't appear in global data: nyama choma spots, mandazi stalls, piri piri takeaways
- Weekly benchmark trend: "Your average check is closing the gap — up 8% vs. area average last week"

---

#### F-028 — Delivery Aggregator Integration
**Stolen from**: Toast Delivery Services (DoorDash, Uber Eats via middleware)
**Build**: Connect to Deliverect API as middleware. Single integration covers: Bolt Food Kenya, Jumia Food, Glovo, Uber Eats (where available). Orders from all platforms appear in one unified queue. Auto-route to KDS. No manual re-entry.

**We add on top**:
- Delivery platform performance report: which platform brings highest-margin orders, which has highest cancellation rate
- Menu sync: push menu changes to all platforms simultaneously from one interface
- Throttling: limit incoming delivery orders per 15-minute window during rush (so kitchen doesn't get overwhelmed)
- Commission cost tracking: each delivery platform fee shown as a cost line in reports

---

#### F-029 — Loyalty Automation + Personalization
**Stolen from**: Toast Loyalty, SpotOn, Square (hyper-personalized rewards)
**Build**: AI determines which reward type drives each specific customer back:
- Customer A always responds to free item rewards → always send free item offers
- Customer B responds to percentage discounts → always send discount offers
- Customer C responds to VIP recognition → priority seating, name recognition, early access

**We add on top**:
- Gamified loyalty on QR ordering page: after payment, show scratch-card animation revealing points earned
- Tiered loyalty: Bronze → Silver → Gold → Platinum (like airline miles — creates aspiration)
- Points expiry warnings: "Your 340 points expire in 30 days! Visit this week to keep them."
- Group loyalty: family/household points pooling (one person earns, whole family redeems)

---

#### F-030 — WhatsApp Commerce (Orders + Payments via WhatsApp)
**Stolen from**: Nobody has this. This is Africa-original and enormous.
**Build**: Customer sends message to business WhatsApp number. NLP (Claude) parses intent. System responds with:
1. Menu browsing: "Show me your menu" → auto-reply with categories → customer selects
2. Order placement: "I want 2 ugali fish and 1 pilau" → system confirms order summary
3. Payment: customer receives M-Pesa STK push → confirms on phone → order sent to kitchen
4. Status updates: "Your order is being prepared... ready in 15 minutes"
5. Receipt: full WhatsApp receipt with M-Pesa reference

**We add on top**:
- Swahili and English natural language understanding ("nataka ugali mbili")
- WhatsApp loyalty commands: "MY POINTS" → "You have 340 points (KSh 340 value). Use on your next visit."
- WhatsApp reporting for owners: text "SALES TODAY" to your own system → get today's summary
- WhatsApp supplier ordering: send PO to supplier via WhatsApp, track acknowledgment

---

#### F-031 — AI P&L Analysis (SpotOn Profit Assist)
**Stolen from**: SpotOn Profit Assist (first POS to embed true P&L AI, not just sales AI)
**Build**: Connect to accounting data (Xero/QuickBooks API or manual expense entry). Run nightly: compare this period vs. last period vs. same period last year. Flag cost anomalies. Deliver specific savings recommendations.

**We add on top**:
- Supplier invoice OCR: owner photographs supplier invoice → AI extracts items + prices → compares to last invoice → alerts if price increased ("Tomatoes up 15% from Kamau Suppliers this week")
- Real-time shift P&L: manager opens dashboard mid-service, sees: revenue so far, labor cost (clocked-in hours × rate), estimated food cost, estimated gross profit, comparison to same shift last week
- "Where did my money go?" plain-language monthly breakdown

---

#### F-032 — Multi-Brand / Ghost Kitchen Management
**Stolen from**: Ghost kitchen software (specialized vertical)
**Build**: One kitchen, multiple virtual brands. Each brand: own menu, own KDS lane color, own delivery app presence, own reporting. All orders consolidated into one kitchen queue. Kitchen sees which brand each item belongs to (color-coded).

**We add on top**:
- Brand performance comparison: which brand is most profitable, which has best delivery ratings
- Cross-brand upsell: "Customers who order Mama's Jollof also ordered Lagos Burgers" → suggest bundle deals
- Shared ingredient alerts: if an ingredient is shared between brands, one stockout alert covers all

---

#### F-033 — Self-Ordering Kiosk Mode
**Stolen from**: McDonald's kiosk effect (15-30% average check increase), Toast Kiosk
**Build**: Same React Native app, "Kiosk Mode" profile. Large touch-optimized layout. AI upsell prompts: "89% of customers who ordered this added fries" and "Add a drink for KSh 80?" A/B test different upsell messages automatically. Loyalty login at kiosk (phone number entry).

**We add on top**:
- Gamified loyalty at kiosk: after payment, animated scratch-card reveals points earned
- Photo-first menu: large food photos, minimal text — works across literacy levels
- Accessibility mode: larger text, high contrast, simplified navigation
- Cash payment mode at kiosk (enter denomination received, show change due to cashier)

---

#### F-034 — Time-Based Automatic Menu Switching
**Stolen from**: TouchBistro (day-part switching)
**Build**: Define day-parts with start times and active menu. POS switches automatically. Alert manager 5 minutes before switch. Examples: Breakfast (6-11 AM), Lunch (11 AM-4 PM), Dinner (4 PM-close), Late Night (10 PM-close).

**We add on top**:
- Ramadan menu mode: during Ramadan, auto-switch to Iftar menu at sunset (using location-based sunset time)
- Special event menu: override with event menu for a specific date/time range
- Menu "86" list: manager marks an item as unavailable mid-service → removed from all channels (POS, QR ordering, WhatsApp) simultaneously

---

#### F-035 — Franchise + Chain Management
**Stolen from**: Erply (franchise architecture), NCR (chain management)
**Build**: Brand owner hierarchy: HQ controls menus, pricing floors, and reports. Branch operators see only their branch. Royalty engine: % of sales calculated and reported to franchisor automatically.

**We add on top**:
- Central menu push: one change at HQ → propagates to all branches instantly
- Branch-level price overrides: HQ sets minimum, branch can price above (not below)
- Compliance score per branch: are branches following brand standards? (opens on time, using approved suppliers, hitting required margins)
- HQ morning briefing: consolidated briefing across all franchise locations

---

#### F-036 — AI Voice Ordering (Phone + WhatsApp Voice Notes)
**Stolen from**: Square AI Voice Ordering, HungerRush OrderAI (5M+ orders processed)
**Build Phase 1**: WhatsApp voice note ordering — customer sends voice note → Whisper/AWS Transcribe transcribes → Claude parses order → confirms → M-Pesa payment initiated.

**Build Phase 2**: Phone call ordering — incoming call answered by AI, natural language order taken, pushed to KDS.

**We add on top**:
- Swahili voice understanding (not just English — local language is the differentiator)
- Caller ID memory: if customer has ordered before, AI asks "Same as last time?" — one-word confirmation completes order
- Sheng understanding: "Niongezee ketchup kama last time" — informal Swahili slang understood

---

#### F-037 — No-Code Automation Rules Engine
**Stolen from**: Shopify Flow (no-code automation)
**Build**: Merchants build automation rules: IF [trigger] THEN [action].

Built-in templates:
- "When stock drops below 5 units, send me WhatsApp"
- "When a customer spends over KSh 10,000 total, tag them as VIP"
- "Every Monday at 8 AM, send me last week's sales summary"
- "When any item hasn't sold in 30 days, alert me"
- "When a void is processed, notify manager immediately"
- "When food cost % exceeds 35%, send daily alert until resolved"

---

#### F-038 — Integrated Financial Services
**Stolen from**: Square Banking, Toast Capital, Lightspeed Capital
**Build**:
1. Business wallet: daily sales sweep to wallet balance
2. Tax savings sub-account: auto-set aside 16% of revenue (VAT equivalent) daily
3. Merchant advance: partner with Kenyan MFI/bank to use POS data as underwriting

**We add on top**:
- Mobile money sweep: M-Pesa till receipts → auto-transferred to business wallet daily
- Cash flow forecast: 30-day forward cash flow based on historical patterns + upcoming reservations
- Chama/SACCO integration: auto-route configured % of daily profit to SACCO savings account

---

#### F-039 — Repairs / Job Cards Module
**Stolen from**: NCR Counterpoint (work order tracking)
**Build**: Customer drops off item for repair. Job card created: item description, fault reported, diagnosis, parts needed, estimated price, technician assigned, estimated ready date. Customer notified via WhatsApp at each stage. Payment collected at collection.

**Serves**: Phone repair shops, electronics repair, tailors, mechanics, shoe cobblers — extremely common in African urban markets and completely unserved by global POS.

---

#### F-040 — Event Ticketing Module
**Stolen from**: KORONA POS (ticketing + retail in one)
**Build**: Create events with capacity limits. Sell tickets (general admission, reserved seats, VIP). QR code ticket generation. Door scanner mode on handheld. Ticket revenue tracked separately from food/beverage revenue.

**Serves**: Concert promoters, church fundraisers, sports events, comedy nights, food festivals — all common African events where tickets and food are sold together.

---

#### F-041 — Multi-Currency + Forex-Aware Pricing
**Stolen from**: Nobody. Africa-original gap.
**Build**: Price items in local currency. Accept payment in USD/EUR (common in tourism, international hotels). Real-time exchange rate from Central Bank of Kenya API. Tax-compliant receipts in both currencies.

**We add on top**:
- Forex alert: notify owner when exchange rate moves >2% since last price update
- Cross-border trading mode: KSh/UGX/TZS pricing for merchants near borders
- AFCFTA readiness: designed to accept future unified African payment standards

---

#### F-042 — Local Language Full Support
**Stolen from**: Nobody. Gap in every global POS.
**Build**: Full UI in Swahili (priority 1), then Yoruba, Hausa, Amharic, Zulu (phased).
- Staff can use entire POS in Swahili
- Receipts printed in customer's preferred language
- AI assistant understands and responds in Swahili and Sheng
- Error messages, alerts, and WhatsApp notifications in local language

---

#### F-043 — USSD POS Mode (Feature Phone Support)
**Stolen from**: Nobody. Africa-original.
**Build**: For rural markets and areas where merchants don't have smartphones. Basic POS functions via USSD (*123#): make a sale, check today's total, add stock received. Customer can authorize payment by dialing USSD.

**Serves**: Mobile vendors, market stall traders, very remote locations.

---

#### F-044 — Rental Management Module
**Stolen from**: NCR Counterpoint (rentals tracking)
**Build**: Items rented out → due date, customer details, security deposit, damage assessment, overdue alerts via WhatsApp.

**Serves**: Equipment rental shops, event equipment rental (chairs, tents, sound systems), vehicle rental, sports equipment rental — all significant African market segments.

---

#### F-045 — Price Books (Multiple Price Tiers)
**Stolen from**: Lightspeed Retail (price books)
**Build**: Multiple price lists active simultaneously:
- Retail price (default)
- Wholesale price (for bulk B2B customers)
- Employee price (staff discount)
- Loyalty member price
- Happy hour price (time-based, auto-activates)

Customer's price tier shown on receipt. Staff selects customer tier at checkout or it auto-applies from customer profile.

---

#### F-046 — Online Ordering Page (Commission-Free)
**Stolen from**: Toast Online Ordering (branded, commission-free)
**Build**: Branded ordering page at custom subdomain (mama-kitchen.yourpos.com). Owner's logo, colors, photos. Pickup + delivery options. Online payment via M-Pesa or card. Orders go directly to KDS — no tablet, no re-entry, no commission to delivery apps.

**We add on top**:
- WhatsApp order link: share order link via WhatsApp status, Instagram bio, or SMS
- Pre-ordering: customer orders for a specific future time slot
- Google Food Ordering integration: "Order" button directly on Google Search results

---

#### F-047 — Sentiment Analysis + Review Intelligence
**Stolen from**: SpotOn (partially), no POS has this fully
**Build**: Monitor Google Reviews, delivery app ratings. Alert manager when negative review posted. Identify trending complaints ("slow service" appearing 3× this week). Weekly sentiment report.

**We add on top**:
- QR dish feedback (from F-016): real-time dish ratings from table customers → correlate with Google Reviews
- Sentiment-to-action suggestion: "3 customers mentioned 'cold food' this week — check delivery bag insulation"

---

### WHAT WE EXPLICITLY DO NOT BUILD

These features will never appear in this product. Time spent on them is time taken from winning features.

| Feature | Why we skip it | What we tell merchants |
|---------|---------------|----------------------|
| Full accounting / bookkeeping | Xero and QuickBooks are 20 years ahead | We sync to them via API |
| Payroll engine | Per-country legal complexity, local experts needed | We integrate with Wave, Sage, local payroll |
| Full HR management system | Out of scope | Integrate with Workpay (Kenyan HR SaaS) |
| E-commerce store builder | Shopify is $100B for a reason | We integrate via Shopify API |
| Hotel PMS (full) | Enterprise complexity, specialist product | We expose room-charge API for hotel integrations |
| Social media management | Not our domain | Never |
| Website builder | Not our domain | Never |
| Advanced CRM | Salesforce and HubSpot exist | Integrate via API if needed |
| Full loyalty gamification platform | Complexity for edge case | Start simple (points), add tiers, stop |
| Custom app white-labeling | Complex, low demand for v1 | v2 or enterprise tier |
| Full dark kitchen suite | Start with basic multi-brand (F-032), expand | Phased |
| Crypto/Bitcoin payments | Low African adoption, regulatory unclear | Maybe in 5 years |
| Advanced franchise portal (franchisee self-service) | Build HQ control first | Phased into franchise module |

---

## PART 3 — BUILD ORDER (MONTHLY MILESTONES)

### Month 1-2: Foundation + First Sale
**Goal**: A real merchant can use this to process real sales and receive real money.

| Feature | Priority |
|---------|---------|
| Database schema setup + migrations | Blocker |
| Auth system (JWT, staff PIN, owner account) | Blocker |
| Product catalog (create, edit, categorize) | Blocker |
| Basic cart + order creation | Blocker |
| Cash payment + change calculator | Blocker |
| M-Pesa STK Push integration (F-003) | Blocker |
| WhatsApp receipt on payment (F-004) | Week 2 |
| Offline mode — basic (F-005) | Week 3 |
| Audit log foundation (F-010) | Week 2 (non-negotiable — build early) |
| Stock quantity tracking + alerts | Week 4 |
| Owner dashboard — today's revenue (F-009) | Week 4 |

**End state**: First merchant signs up, processes first sale, receives M-Pesa payment, customer gets WhatsApp receipt. Owner sees it on dashboard. Every action is logged.

---

### Month 2-3: Staff + Multi-Tenant
**Goal**: Multiple staff, multiple branches, roles enforced.

| Feature | Priority |
|---------|---------|
| Staff roles + PIN login (F-007) | Week 5 |
| Multi-tenant architecture (F-008) | Week 5 |
| Staff invite via WhatsApp | Week 6 |
| Role-based permission enforcement | Week 6 |
| Clock in / clock out | Week 7 |
| KRA TIMS compliance receipt format (F-011) | Week 7 |
| Product variants (F-022) | Week 8 |
| Barcode scan to add item | Week 8 |

---

### Month 3-4: Restaurant Mode
**Goal**: Full-service restaurant can replace their existing system.

| Feature | Priority |
|---------|---------|
| Table management + floor plan (F-012) | Week 9 |
| KDS — basic routing (F-013) | Week 10 |
| QR code table ordering (F-016) | Week 11 |
| Split bill (F-017) | Week 11 |
| Reservations + WhatsApp waitlist (F-025) | Week 12 |
| Menu engineering AI (F-019) | Week 12 |
| Time-based menu switching (F-034) | Week 12 |

---

### Month 4-5: Customer Intelligence
**Goal**: Merchants can identify their best customers, reward them, and win back lost ones.

| Feature | Priority |
|---------|---------|
| Customer profiles + loyalty (F-014) | Week 13 |
| Running credit tab / Oweame (F-015) | Week 14 |
| Layaway / installment (F-023) | Week 14 |
| Purchase orders to suppliers (F-024) | Week 15 |
| AI natural language reports (F-020) | Week 16 |
| Win-back automation | Week 16 |

---

### Month 5-6: Intelligence + Distribution
**Goal**: Every merchant gets an AI assistant and delivery orders flow in automatically.

| Feature | Priority |
|---------|---------|
| AI Morning Briefing 6 AM WhatsApp (F-026) | Week 17 |
| Delivery aggregator via Deliverect (F-028) | Week 18 |
| Multi-brand / ghost kitchen (F-032) | Week 19 |
| Handheld tableside mode (F-021) | Week 19 |
| Advanced payment split + partial (F-018) | Week 20 |
| Kiosk self-ordering mode (F-033) | Week 20 |

---

### Month 6-9: Differentiation Layer
**Goal**: Features that win competitive bakeoffs no other African POS can match.

| Feature | Priority |
|---------|---------|
| Competitive benchmarking (F-027) — requires 10+ merchants | Month 6 |
| WhatsApp commerce — full ordering flow (F-030) | Month 7 |
| AI P&L analysis — Profit Assist (F-031) | Month 7 |
| No-code automation rules engine (F-037) | Month 8 |
| Sentiment analysis + review intelligence (F-047) | Month 8 |
| Online ordering page (F-046) | Month 8 |
| AI voice ordering — WhatsApp voice notes (F-036) | Month 9 |
| Loyalty personalization AI (F-029) | Month 9 |

---

### Month 9-12: Market Expansion
**Goal**: Features that expand the addressable market beyond restaurants.

| Feature | Priority |
|---------|---------|
| Franchise + chain management (F-035) | Month 10 |
| Repairs / job cards module (F-039) | Month 10 |
| Event ticketing module (F-040) | Month 11 |
| Rental management (F-044) | Month 11 |
| Multi-currency + forex (F-041) | Month 11 |
| Integrated financial services (F-038) | Month 12 |
| Swahili full UI translation (F-042) | Month 12 |
| USSD mode (F-043) | Month 12 |

---

## PART 4 — OWNER APP SPEC

The owner app is a **separate React web application** — not the same app as the POS terminal. Owners use phone browsers and laptops, not touch screens taking orders.

### What the Owner App Shows
```
Home (Live):
├── Total revenue today (all branches combined)
├── Revenue this hour vs. same hour yesterday
├── Current open orders count
├── Top 3 items sold today
├── Active staff count (clocked in right now)
└── Revenue milestone progress (e.g., "KSh 42,000 / KSh 50,000 daily target")

Branches:
├── Per-branch revenue card (today, this week, this month)
├── Click into branch → branch-level dashboard
└── Branch comparison: which branch is performing best

Reports:
├── Sales by period (day / week / month / custom)
├── Top items by revenue and by quantity
├── Payment method breakdown (cash / M-Pesa / card split)
├── Staff performance (sales per hour, transactions, average ticket)
├── Hourly heatmap (busiest and quietest hours)
├── Menu engineering matrix (F-019)
├── Customer report (new vs. returning, top customers, churn risk)
├── Food cost report (if ingredient costs entered)
└── Natural language query: "Ask anything" input box

Staff Management:
├── Add / remove staff
├── Change roles and permissions
├── View clock-in / clock-out history
├── Staff performance rankings
└── Audit log filtered by staff member

Menu & Pricing:
├── Create / edit / delete products
├── Category management
├── Price book management (F-045)
├── Menu engineering recommendations
└── Bulk price update

Audit Log (F-010):
├── Full audit trail searchable by date, staff, action type
├── "Investigate order" — full lifecycle of any order
├── Anomaly alerts (void spikes, unusual patterns)
└── Export to PDF for accountant / legal

Customers:
├── Customer list with search
├── Customer profile: full order history, loyalty balance, credit tab balance
├── Credit tab management: approve credit, set limits, record payments
└── Loyalty campaign management

Integrations:
├── M-Pesa: connect Daraja credentials, view reconciliation
├── WhatsApp: connect WhatsApp Business number
├── Deliverect: connect delivery platforms
├── Xero / QuickBooks: connect accounting
└── Tax: connect KRA TIMS / EFRIS credentials

Settings:
├── Business profile (name, logo, address, currency, timezone)
├── Receipt settings (header, footer, WhatsApp vs. print default)
├── Tax settings (VAT rate, tax number, ETR settings)
├── Notification preferences (which alerts via WhatsApp)
├── Automation rules (F-037)
└── API access (generate API keys for third-party integrations)
```

### What the Owner App Does NOT Have
- No order-taking interface
- No cash drawer controls
- No KDS view (separate staff role)
- No PIN management UI (separate from staff-facing features)

---

## PART 5 — INTEGRATIONS MAP

```
PAYMENTS (provider adapters — all behind PaymentProvider interface)
├── M-Pesa Kenya          Safaricom Daraja API v3 — STK Push, C2B, B2C, offline QR
├── MTN MoMo              MTN API — Ghana, Uganda, Rwanda, Cameroon, Ivory Coast
├── Airtel Money          Airtel API — Kenya, Uganda, Tanzania, Zambia, Malawi
├── Orange Money          Orange API — West Africa (Senegal, Mali, Guinea)
├── Flutterwave           Card + mobile money — 34 African countries (primary card)
├── Paystack              Card — Nigeria + Ghana primary (owned by Stripe)
└── DPO Group             Card — East + Southern Africa

COMMUNICATIONS
├── WhatsApp Business     Meta Cloud API — receipts, ordering, loyalty, alerts
├── Africa's Talking SMS  Fallback when WhatsApp fails; USSD for feature phones
└── Firebase FCM          Push notifications to POS app

DELIVERY
└── Deliverect            Aggregator middleware — Bolt Food, Jumia Food, Glovo, Uber Eats

ACCOUNTING (export connectors)
├── Xero                  Daily sales summary + invoice sync
└── QuickBooks            Same — merchant chooses which

TAX COMPLIANCE (direct integrations)
├── KRA TIMS Kenya        ETR-compliant receipts, Z-report submission
├── EFRIS Uganda          Phase 2
└── FIRS Nigeria          Phase 2

AI / ML
├── Anthropic Claude      claude-sonnet-4-6 — NL reports, briefings, WhatsApp AI, P&L analysis
├── AWS Transcribe        Voice-to-text (Swahili + English) for voice ordering
└── Internal ML Service   Python/FastAPI — demand forecasting, churn prediction, menu engineering

HARDWARE (no proprietary lock-in)
├── Sunmi T2s             15.6" all-in-one terminal (recommended main terminal)
├── Sunmi V2s             Handheld with built-in thermal printer + scanner
├── Sunmi M2              Handheld ordering device (tableside)
├── Xprinter XP-80C       Bluetooth thermal receipt printer (most common in Kenya)
├── PAX SK900             Self-ordering kiosk (16" or 21.5", Android)
└── Samsung Galaxy Tab    Kitchen display (Tab A7/A8 + wall mount)

FUTURE INTEGRATIONS (Phase 2)
├── OpenTable / Resy      Advanced reservations
├── Workpay               Kenyan payroll integration
├── Starlink              Enterprise connectivity monitoring
└── AFCFTA corridor       Unified African payment standards (when available)
```

---

## PART 6 — API CONTRACT (LOCKED)

### Authentication
```
Staff POS login:     POST /auth/pin          { device_id, pin, location_id }
Owner login:         POST /auth/login         { email, password }
Refresh token:       POST /auth/refresh       { refresh_token }
WhatsApp login OTP:  POST /auth/otp/send      { phone }
                     POST /auth/otp/verify     { phone, otp }
```

### Core API Endpoints
```
# Orders
POST   /locations/{id}/orders              Create order
GET    /locations/{id}/orders              List orders (cursor paginated)
GET    /orders/{id}                        Order details
PATCH  /orders/{id}/status                 Update status
POST   /orders/{id}/payments               Add payment
POST   /orders/{id}/items                  Add item to open order
DELETE /orders/{id}/items/{itemId}         Remove item
POST   /orders/{id}/void                   Void order (manager permission + reason)
POST   /orders/{id}/refund                 Refund (manager permission + reason)
GET    /orders/{id}/audit                  Full audit trail for this order

# Products
GET    /businesses/{id}/products           Full catalog
POST   /businesses/{id}/products           Create product
PATCH  /products/{id}                      Update product
DELETE /products/{id}                      Delete product (soft delete)
POST   /locations/{id}/stock/adjust        Manual stock adjustment
GET    /locations/{id}/stock/alerts        ML-generated stock alerts
GET    /locations/{id}/stock/forecast      Demand forecast per SKU

# Customers
GET    /businesses/{id}/customers          Customer list
POST   /businesses/{id}/customers          Create / upsert by phone
GET    /customers/{id}                     Customer profile
GET    /customers/{id}/orders              Order history
POST   /customers/{id}/loyalty/adjust      Add/remove points
POST   /customers/{id}/credit/transaction  Add to credit tab or record payment

# Analytics
GET    /locations/{id}/analytics/today     Live today summary
GET    /locations/{id}/analytics/sales     Sales with filters (from/to, method, category)
GET    /businesses/{id}/analytics/weekly   Weekly report data
GET    /users/{id}/analytics/overview      Cross-business owner summary
GET    /businesses/{id}/analytics/benchmark  Competitive benchmarks (if network threshold met)

# Reports
GET    /businesses/{id}/reports            Saved reports list
POST   /businesses/{id}/reports/query      Natural language query → answer
GET    /reports/{id}/pdf                   Download PDF report

# Staff
GET    /businesses/{id}/staff              Staff list
POST   /businesses/{id}/staff/invite       WhatsApp invite
PATCH  /staff/{id}/role                    Change role (owner only)
POST   /staff/{id}/clockin                 Clock in
POST   /staff/{id}/clockout                Clock out
GET    /locations/{id}/staff/clockins      Active clock-ins

# Audit
GET    /businesses/{id}/audit              Audit log (filterable, paginated)
GET    /orders/{id}/audit                  Order-specific audit trail

# Tables (Restaurant)
GET    /locations/{id}/tables              Floor plan + status
POST   /locations/{id}/tables              Create table
PATCH  /tables/{id}/status                 Update status
POST   /tables/{id}/transfer               Transfer order to another table

# Reservations
GET    /locations/{id}/reservations        List by date
POST   /locations/{id}/reservations        Create reservation
PATCH  /reservations/{id}                  Update (confirm, seat, cancel, no-show)

# KDS (WebSocket — not REST)
WS     /kds/{locationId}/{stationId}       Kitchen display connection
Event: order.new          → new ticket arrives
Event: item.status        → item bumped or status changed
Event: rush.flag          → order flagged as rush
Emit:  item.bump          → staff bumps item as complete
Emit:  order.ready        → all items ready, notify server

# Webhooks (inbound)
POST   /webhooks/mpesa/{orderId}           M-Pesa Daraja callback
POST   /webhooks/deliverect/order          Delivery platform order
POST   /webhooks/flutterwave               Card payment callback

# Developer API (for integrations)
POST   /api/v1/orders                      Create order via API key
GET    /api/v1/products                    Read product catalog
GET    /api/v1/analytics/summary           Read sales summary
POST   /api/v1/webhooks                    Register outbound webhook URL
```

### API Design Rules (Non-Negotiable)
```
1. Every response:  { data: ..., meta: { timestamp, request_id }, errors?: [...] }
2. Pagination:      cursor-based (?cursor=xxxx&limit=50)
3. Money:           always integer cents { amount: 87500, currency: "KES" }
4. Timestamps:      ISO 8601 UTC "2026-06-24T12:34:56Z"
5. Errors:          RFC 7807 { type, title, detail, status }
6. Rate limits:     60 req/min standard, 600 req/min sync operations
7. Auth:            Bearer JWT — scopes: pos:read, pos:write, reports:read, admin:write
8. Idempotency:     All payment initiations require Idempotency-Key header
```

---

## PART 7 — THE DONE DEFINITION

A feature is NOT complete unless all 7 conditions are met:

```
1. Works on a KSh 12,000 Android phone on 2G
   Not just on a MacBook on fibre. Test on the cheapest device you can find.

2. Works offline — or degrades gracefully with a visible offline badge
   "It needs internet" is not an acceptable answer for any Tier 1 feature.

3. A merchant with no training completes the task in under 60 seconds
   Tested on an actual merchant, not an engineer. If they struggle, redesign.

4. The feature has a WhatsApp notification path
   If something important happens, the owner receives a WhatsApp message.
   The POS is push-by-default. Dashboard is for when they want more detail.

5. Every significant action generates an audit log entry
   Who. What changed. Why. When. Where. No exceptions.

6. The API endpoint is documented in OpenAPI format with examples
   If it's not documented, it doesn't exist as far as third-party integrators care.

7. Error states are designed — not just the happy path
   What happens if M-Pesa times out? What if the KDS goes offline?
   What if the printer runs out of paper? Design the failure, not just the success.
```

---

## PART 8 — UNIQUE ADVANTAGES (NOBODY HAS ALL OF THESE)

This is our moat. Each item below is a feature no single competitor offers:

| Advantage | Global Leaders | African Local Players | Us |
|-----------|---------------|----------------------|-----|
| M-Pesa native (STK Push + offline QR) | ✗ | Partial | ✓ Full |
| WhatsApp receipts, orders, loyalty, reports | ✗ | ✗ | ✓ |
| 72-hour offline mode | Partial | ✗ | ✓ Full |
| Load shedding / power cut mode | ✗ | ✗ | ✓ |
| Running customer credit tab (Oweame) | ✗ | ✗ | ✓ |
| Swahili UI + AI in Swahili/Sheng | ✗ | ✗ | ✓ |
| Competitive benchmarking (Africa market data) | US/EU only | ✗ | ✓ African data |
| AI morning briefing via WhatsApp at 6 AM | App only | ✗ | ✓ WhatsApp |
| Multi-currency + forex (KSh/UGX/TZS/USD) | ✗ | ✗ | ✓ |
| USSD POS for feature phones | ✗ | ✗ | ✓ |
| KRA TIMS + EFRIS + FIRS tax compliance | ✗ | Fragmented | ✓ Unified |
| AI demand forecasting with African holidays | Generic | ✗ | ✓ Localized |
| Supplier credit tracking (Mkopo) | ✗ | ✗ | ✓ |
| Repairs / job cards module | Separate software | ✗ | ✓ Built-in |
| Chama/SACCO savings integration | ✗ | ✗ | ✓ |
| Cross-business consolidated owner view | Partial | ✗ | ✓ Full |
| Group QR ordering + individual payment | ✗ | ✗ | ✓ |
| Photo-based product lookup (no barcode needed) | ✗ | ✗ | ✓ |
| WhatsApp voice note ordering (Swahili) | ✗ | ✗ | ✓ |
| Layaway with WhatsApp payment reminders | NCR only | ✗ | ✓ WhatsApp-native |

---

## PART 9 — PRICING MODEL

### Subscription Tiers

| Tier | Monthly Price | Who It's For | What's Included |
|------|--------------|-------------|----------------|
| **Starter** | KSh 2,500/month | Single location, food kiosk, market stall | Core POS, M-Pesa, 1 staff account, offline mode, WhatsApp receipts, basic reports |
| **Growth** | KSh 6,500/month | Restaurant or retail shop with team | Everything in Starter + KDS, table management, customer loyalty, inventory, QR ordering, 10 staff |
| **Pro** | KSh 14,000/month | Multi-branch or high-volume single venue | Everything in Growth + AI briefings, competitive benchmarks, delivery integration, menu engineering AI, unlimited staff |
| **Enterprise** | Custom | Franchise chains, hotel groups | Everything in Pro + franchise management, white-label options, dedicated support, SLA |

### Transaction Fees (Optional Revenue — Phase 2)
- M-Pesa gateway: 0% (pass through Daraja's fee to merchant transparently)
- Card processing: revenue share with Flutterwave/Paystack
- Merchant advance: interest/fee share with MFI partner

### Why This Pricing Wins
- KSh 2,500 = $19/month. Toast charges $69/month PLUS transaction fees PLUS hardware.
- No per-transaction POS fee (unlike Square's 2.49% + $0.15 per swipe)
- One subscription covers multiple businesses (not per-location like every competitor)
- Free hardware support guide (Sunmi devices, not proprietary hardware)

---

## PART 10 — THE NORTH STAR METRIC

**Primary**: Revenue processed through the platform per month (GMV). This captures growth in both merchant count and merchant transaction volume.

**Secondary metrics** that indicate health:
- Merchant 90-day retention rate (target: >80%)
- Daily active merchant rate (target: >70% of paid subscribers use it daily)
- WhatsApp receipt delivery rate (target: >90% of transactions generate a delivered receipt)
- Offline transaction % successfully synced (target: >99.5%)

**When a merchant churns, ask exactly one question**: "What made you stop?" — record the answer. After 20 answers, the pattern is the product roadmap.

---

*Document version: 1.0 — June 2026*
*Owner: Founder*
*Status: LOCKED — implementation begins*
