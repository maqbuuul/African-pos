# African POS — Restaurant Operating System
## The Complete Technical Blueprint

> **Mission:** Become the African Toast. A purpose-built restaurant management platform for Africa
> — starting in Nairobi, expanding continent-wide. Restaurant-only SaaS, not a generic POS.
> Every decision serves one goal: a restaurant owner in Nairobi running a better business.
>
> Synthesized from all 20 research documents. Every decision below is grounded in the locked
> choices from `18-build-order-and-technical-decisions.md`. Read that document first, then use
> this one as the implementation reference.

---

## 1. The Architecture In One Picture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CLIENT LAYER                                         │
│                                                                                          │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │  APP 1           │ │  APP 2           │ │  APP 3           │ │  WhatsApp Cloud  │   │
│  │  POS Terminal    │ │  Manager Portal  │ │  Owner App       │ │  (Meta API)      │   │
│  │  React Native    │ │  React Web       │ │  React Web       │ │                  │   │
│  │  (Android 1st)   │ │  (tablet/laptop) │ │  (phone browser) │ │  Receipts        │   │
│  │  WatermelonDB    │ │  Back-of-house   │ │  Intelligence    │ │  Orders          │   │
│  │  Offline-first   │ │  Operations      │ │  & strategy      │ │  Briefings       │   │
│  │                  │ │                  │ │                  │ │  Loyalty         │   │
│  │  Modes:          │ │  Manages:        │ │  Shows:          │ │  Reports         │   │
│  │  • Cashier       │ │  • Staff & roles │ │  • Live revenue  │ │                  │   │
│  │  • Server        │ │  • Inventory     │ │  • AI briefings  │ └────────┬─────────┘   │
│  │  • KDS (kitchen) │ │  • Floor plan    │ │  • Multi-branch  │          │ Webhook      │
│  │  • Kiosk         │ │  • Audit log     │ │  • AI reports    │          │              │
│  │  • KDS Expo      │ │  • Shift reports │ │  • P&L / costs   │          │              │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘          │              │
│           │ HTTPS/REST          │ HTTPS/REST          │ HTTPS/REST         │              │
└───────────┼─────────────────────┼─────────────────────┼────────────────────┼──────────────┘
            │                    │                 │                 │
            ▼                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE EDGE                                        │
│  CDN + WAF + DDoS + SSL termination + DNS + Rate Limiting (edge)                 │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MODULAR MONOLITH API SERVER                               │
│                     Node.js 22 LTS + Fastify v5 + TypeScript                    │
│                                                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │
│  │  orders/  │ │inventory/ │ │customers/ │ │payments/  │ │  notifications/   │  │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤ ├───────────────────┤  │
│  │  tables/  │ │  kitchen/ │ │  staff/   │ │ reports/  │ │  integrations/    │  │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤ ├───────────────────┤  │
│  │  audit/   │ │   auth/   │ │  tax/     │ │ webhooks/ │ │  automations/     │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────────────┘  │
│                                                                                  │
│  shared/ ─ database/ cache/ queue/ events/ auth/                                 │
│            Drizzle ORM    Redis  BullMQ  EventEmitter  jose JWT                  │
└───────────┬───────────────────────┬────────────────────────┬─────────────────────┘
            │                       │                        │
            ▼                       ▼                        ▼
┌──────────────────┐  ┌─────────────────────┐  ┌────────────────────────┐
│   DATA LAYER     │  │    WORKER PROCESS    │  │    ML SERVICE          │
│                  │  │   (BullMQ workers)   │  │  Python 3.12 + FastAPI │
│  PostgreSQL 16   │  │                      │  │                        │
│  (primary RW)    │  │  • WhatsApp sender   │  │  • Prophet forecasting │
│                  │  │  • PDF generator     │  │  • LightGBM classifier │
│  PostgreSQL 16   │  │  • Nightly briefing  │  │  • Isolation Forest    │
│  (read replica)  │  │  • Sync queue drain  │  │  • Sentence-Transforms │
│                  │  │  • eTIMS submission  │  │  • FastAPI (internal)  │
│  Redis 7         │  │  • ML job dispatch   │  │                        │
│  (cache/queue/   │  │  • Report scheduler  │  │  Called by BullMQ,     │
│   pub-sub/RLS)   │  │  • Recon jobs        │  │  not a cron job        │
│                  │  │  • Win-back campaigns│  │                        │
│  DuckDB          │  └─────────────────────┘  └────────────────────────┘
│  (analytics)     │
│                  │
│  Meilisearch     │
│  (product search)│
│                  │
│  Cloudflare R2   │
│  (file storage)  │
└──────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTEGRATIONS                                    │
│                                                                                  │
│  PAYMENTS            COMMUNICATIONS       TAX            AI/ML                   │
│  Safaricom Daraja    Meta WhatsApp API    KRA eTIMS      Anthropic Claude        │
│  MTN MoMo API        Africa's Talking     Uganda EFRIS   AWS Transcribe          │
│  Airtel Money        SMS (fallback)       Nigeria FIRS   (Swahili + English)     │
│  Flutterwave         Firebase FCM                                                 │
│  Paystack            (push notifs)        DELIVERY        ACCOUNTING              │
│  DPO Group                               Deliverect      Xero API                │
│  Africa's Talking                        (Bolt/Glovo/    QuickBooks API          │
│  USSD                                    Uber/Jumia)                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack — Full Reference

All choices are locked. Do not revisit unless a dependency stops being maintained.

### 2.1 POS Terminal (React Native)

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | React Native (TypeScript) | Single codebase Android + iOS |
| Android focus | Android-first | 90%+ of African hospitality devices |
| Local DB | WatermelonDB (SQLite) | Built for RN, fast sync, proven at scale |
| Sync engine | Custom bidirectional on WatermelonDB | REST-based, offline-aware |
| State | Zustand | Lightweight, TypeScript-native, no boilerplate |
| UI | React Native Paper (Material Design 3) | Accessible, tested, theming built-in |
| Navigation | React Navigation v7 | Standard, battle-tested |
| Receipt printing | react-native-thermal-receipt-printer-image-qr | Bluetooth thermal support |
| Barcode scan | react-native-vision-camera + MLKit | Fast, native camera access |
| M-Pesa | Custom Daraja.js wrapper + webhook listener | Native integration, not bolt-on |
| Push notifs | Firebase Cloud Messaging (FCM) | Android-native |
| Offline maps | Bundled locale data | No network lookup for currency/timezone |

### 2.2 Manager Portal (React Web — back-of-house operations)

**Who uses it:** Managers and supervisors. At the venue, on a tablet or laptop.  
**URL:** `manager.africanpos.co`  
**Design feel:** Dense, functional, data-rich. Think admin tool, not consumer app.

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | React 19 (TypeScript) | Web-first — tablet or laptop browser |
| Routing | React Router v7 | Role-based route guards |
| State | Zustand | Same mental model as POS |
| Tables | TanStack Table v8 | Heavy data grids for audit log, inventory |
| Forms | React Hook Form + Zod | Type-safe, validated forms for stock entry |
| PDF export | react-pdf | Audit reports, shift summaries |
| Dates | date-fns | Shift time calculations |
| Styling | Tailwind CSS v4 | Consistent design system with owner app |
| Build | Vite | Fast HMR |

**What the Manager Portal contains:**

```
Staff Management
├── View all staff at this branch (clocked-in status, role)
├── Clock-in / clock-out override (if staff forgot to clock out)
├── Change staff PIN (manager or owner only)
├── Deactivate staff account
└── Invite new staff via WhatsApp

Inventory
├── Current stock levels per product
├── Receive stock (goods receipt against PO or ad hoc)
├── Manual stock adjustment (reason required — writes audit log)
├── Wastage log
└── Low stock alerts list

Purchase Orders
├── Create PO from low-stock suggestions (ML-generated list)
├── Send PO to supplier via WhatsApp
├── Mark as received → auto-updates stock
└── Discrepancy report

Floor Plan (Restaurant)
├── Visual floor plan editor (drag-and-drop tables)
├── Add/remove ghost tables
└── Configure table capacities

Shift Operations
├── Shift summary: revenue, transactions, voids, average ticket
├── Cash reconciliation: count the till, enter by denomination
├── M-Pesa reconciliation: POS M-Pesa payments vs. M-Pesa statement
└── Open order review: any orders still open from previous shift

Audit Log
├── Full audit trail filtered by date range, staff, action type
├── "Investigate order": full lifecycle of any order
└── Export to PDF

Basic Reports
├── Today's sales by category
├── Staff performance today (sales, avg ticket, voids)
└── Items sold this shift
```

---

### 2.3 Owner App (React Web — intelligence and strategy)

**Who uses it:** Business owner. Checking from phone browser, anywhere.  
**URL:** `app.africanpos.co`  
**Design feel:** Clean, card-based, mobile-first. Think executive dashboard. WhatsApp is the primary channel — this app gives "more detail" when they want it.

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | React 19 (TypeScript) | Mobile browser first (owners check on phone) |
| Routing | React Router v7 | Nested route layout for multi-business |
| State | Zustand | Shared mental model across apps |
| Charts | Recharts | Revenue trends, hourly heatmaps, benchmark charts |
| Tables | TanStack Table v8 | Top items, customer lists |
| PDF export | react-pdf | Monthly reports, P&L exports |
| Dates | date-fns | Comparison periods |
| Styling | Tailwind CSS v4 | Mobile-responsive, consistent tokens |
| Build | Vite | Fast HMR |

**What the Owner App contains:**

```
Home (Live — refreshes every 60 seconds)
├── Total revenue today (all branches combined)
├── Revenue this hour vs. same hour yesterday
├── Current open orders count
├── Payment method split (M-Pesa / Cash / Card %)
├── Active staff count (clocked-in right now)
├── Revenue milestone progress bar (vs. daily target)
└── "Payday effect" banner if applicable

Branches
├── Per-branch revenue card (today / this week / this month)
├── Branch comparison table
├── Offline branch alert: "Karen branch offline since 14:32"
└── Drill into any branch → branch-level dashboard

Intelligence (AI Features)
├── Morning briefing archive: past briefings, searchable
├── "Ask anything": natural language query box (Swahili + English)
├── Menu engineering matrix: Stars / Plowhorses / Puzzles / Dogs
├── Competitive benchmarks (activates after network threshold)
└── AI P&L analysis: "Where did my money go this month?"

Customers
├── Customer list: search by phone, name, tag
├── Customer profile: full order history, loyalty, credit balance
├── Credit tab management: approve credit limits, view balances
├── Win-back campaign: trigger manual WhatsApp to at-risk customers
└── Loyalty tier distribution chart

Multi-Business View (if owner has > 1 business)
├── Consolidated revenue across all businesses today
├── Cross-business comparison
└── Per-business drill-down

Financial (Phase 2)
├── Cash flow forecast (30 days)
├── Tax savings sub-account balance
├── M-Pesa till sweep history
└── Merchant advance eligibility

Settings & Integrations
├── Business profile (name, logo, WhatsApp number, KRA PIN)
├── Receipt settings (header, footer, language preference)
├── Tax settings (VAT rate, eTIMS connection)
├── Connected integrations: M-Pesa, WhatsApp, Xero, Deliverect
├── Automation rules (no-code IF/THEN builder)
├── Pricing and price books
├── Subscription and billing
└── Developer API keys
```

### 2.4 Backend API Server

| Concern | Choice | Why |
|---------|--------|-----|
| Runtime | Node.js 22 LTS | LTS stability, TypeScript native |
| Framework | Fastify v5 | Fastest Node.js framework, TypeScript-first schema |
| Validation | Zod | TypeScript inference, auto-generates OpenAPI schema |
| ORM | Drizzle ORM | TypeScript-native, close to raw SQL, fast queries |
| Auth | jose (JWT) | HS256 inter-service, RS256 external tokens |
| 2FA | otplib (TOTP) | TOTP for owner accounts |
| Rate limiting | @fastify/rate-limit on Redis | Distributed rate limit across instances |
| API docs | @fastify/swagger + Scalar UI | Auto-generated from Zod schemas |
| File uploads | @fastify/multipart | Supplier invoice OCR uploads |
| WebSockets | Socket.io v4 | KDS real-time, tableside status |
| HTTP client | undici | Native Node.js, fastest for outbound calls |

### 2.5 Data Layer

| Concern | Choice | Why |
|---------|--------|-----|
| Primary DB | PostgreSQL 16 | ACID, row-level security, JSONB, proven |
| Cache | Redis 7 | Sessions, rate limits, counters, pub/sub for KDS |
| Queue | BullMQ on Redis | Background jobs, retry logic, scheduled tasks |
| Search | Meilisearch | 10× faster to deploy than Elasticsearch, typo-tolerant |
| Analytics | DuckDB | In-process OLAP, no separate analytics server needed |
| File storage | Cloudflare R2 | Zero egress fees, S3-compatible API |
| Migrations | Drizzle Kit | TypeScript migration files, version-controlled |
| Backups | pg_dump → R2 daily | Simple, proven, cheap |

### 2.6 ML Service (Python, separate process)

| Concern | Choice | Why |
|---------|--------|-----|
| Runtime | Python 3.12 + FastAPI | Standard ML stack, internal API only |
| Forecasting | Prophet | Time-series demand with African holiday support |
| Classification | LightGBM | Menu engineering + churn prediction |
| Anomaly | Isolation Forest | Void spike detection, sales anomalies, staff fraud |
| Embeddings | Sentence-Transformers | Semantic product search, WhatsApp NLP |
| Recommendation | Item co-occurrence matrix | "Customers who ordered X also ordered Y" |
| CLV | BG/NBD (lifetimes library) | Customer lifetime value + credit limit decisions |
| NLP routing | Rule-based + Sentence-Transformers | WhatsApp fast-path: simple orders skip Claude |
| Server | uvicorn | ASGI, async-native |
| Scheduling | Called by BullMQ nightly | Not a standalone cron — controlled by main process |

**Full model inventory:**

| Model | Type | Input | Output | Used by |
|-------|------|-------|--------|---------|
| Demand forecaster | Prophet time-series | 90d order history per item | 7-day demand + stockout risk | Morning briefing, purchase orders |
| Menu engineer | LightGBM classifier | Margin × volume per item | Stars/Plowhorses/Puzzles/Dogs | Owner dashboard, menu optimization |
| Churn predictor | LightGBM classifier | RFM features (recency, frequency, monetary) | Churn probability 0–1 | Win-back campaign trigger |
| Anomaly detector | Isolation Forest | Staff voids, discounts, cash | Anomaly score + reason | Owner alert, audit log flag |
| Product recommender | Co-occurrence matrix | Items in current cart | Top 3 add-on suggestions | POS checkout screen |
| CLV predictor | BG/NBD (Pareto/NBD) | Purchase history per customer | Predicted 90-day spend | Credit limit, loyalty tier decisions |
| WhatsApp router | Rule-based + embeddings | Raw WhatsApp message | `{intent, items, confidence}` | Route to fast path or Claude |

### 2.7 AI Layer

| Concern | Choice | Why |
|---------|--------|-----|
| LLM | Claude claude-sonnet-4-6 (Anthropic) | NL reports, briefing, WhatsApp parsing, invoice OCR |
| Voice | AWS Transcribe (Swahili + English) | Best Swahili ASR available |
| Prompts | Version-controlled prompt files | Not hardcoded — iterate without deploy |
| Context injection | Business schema per request | No fine-tuning needed, context is enough |
| Delivery | WhatsApp (primary), in-app (secondary) | Owners check WhatsApp more than any app |

### 2.8 Developer Tooling

| Concern | Choice | Why |
|---------|--------|-----|
| Monorepo | Turborepo | Task caching, parallel builds, standard for pnpm monorepos |
| Package manager | pnpm | Fast installs, disk-efficient, workspace support |
| TypeScript | Strict mode everywhere | No `any`, no `@ts-ignore` without explanation |
| Linting | ESLint + eslint-config-turbo | Consistent across all apps |
| Formatting | Prettier | Zero config disputes |
| Testing | Vitest (unit + integration) | Fast, Vite-native, compatible with Jest APIs |
| E2E | Playwright (dashboard) | Cross-browser, screenshot testing |
| RN Testing | React Native Testing Library | Component-level tests |
| Git hooks | Husky + lint-staged | Format + lint before commit, not in CI |
| Env | dotenv-safe | Fails loudly if required env vars are missing |

---

## 3. Monorepo Structure

```
african-pos/                           ← Turborepo root
├── package.json                       ← pnpm workspace config
├── turbo.json                         ← build pipeline
├── .env.example                       ← all required env vars documented
│
├── apps/
│   ├── api/                           ← Fastify backend (THE monolith)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── orders/            ← Order lifecycle, kitchen routing
│   │   │   │   ├── inventory/         ← Products, stock, purchase orders
│   │   │   │   ├── customers/         ← Profiles, loyalty, credit tabs
│   │   │   │   ├── payments/          ← M-Pesa, card, cash adapters
│   │   │   │   ├── staff/             ← Auth, roles, clock-in/out
│   │   │   │   ├── tables/            ← Floor plan, reservations, waitlist
│   │   │   │   ├── kitchen/           ← KDS routing, stations, timers
│   │   │   │   ├── reports/           ← Analytics, NL queries, PDF jobs
│   │   │   │   ├── notifications/     ← WhatsApp, SMS, FCM dispatch
│   │   │   │   ├── integrations/      ← Deliverect, Xero, external webhooks
│   │   │   │   ├── tax/               ← KRA eTIMS, EFRIS, FIRS
│   │   │   │   ├── audit/             ← Every destructive action logged here
│   │   │   │   └── automations/       ← No-code rules engine
│   │   │   ├── shared/
│   │   │   │   ├── database/          ← Drizzle client + migrations
│   │   │   │   ├── cache/             ← Redis client
│   │   │   │   ├── queue/             ← BullMQ job definitions
│   │   │   │   ├── events/            ← Internal event emitter bus
│   │   │   │   └── auth/              ← JWT middleware, PIN validation
│   │   │   └── server.ts              ← Fastify bootstrap, plugin registration
│   │   └── drizzle/
│   │       └── migrations/            ← SQL migration files (version-controlled)
│   │
│   ├── worker/                        ← BullMQ worker process (separate deploy)
│   │   └── src/
│   │       ├── jobs/
│   │       │   ├── whatsapp-sender.ts
│   │       │   ├── pdf-generator.ts
│   │       │   ├── morning-briefing.ts
│   │       │   ├── sync-queue.ts
│   │       │   ├── etims-submit.ts
│   │       │   ├── mpesa-reconcile.ts
│   │       │   └── win-back-campaign.ts
│   │       └── index.ts
│   │
│   ├── pos/                           ← APP 1: React Native POS terminal
│   │   └── src/                       ← Front-of-house — cashier, server, kitchen
│   │       ├── screens/
│   │       │   ├── Selling/           ← Cashier mode: cart, payment
│   │       │   ├── TableMap/          ← Table status view (host/cashier)
│   │       │   ├── ServerMode/        ← Tableside handheld (server)
│   │       │   ├── KDSView/           ← Kitchen display (kitchen staff)
│   │       │   ├── KDSExpo/           ← Expo screen (food runner)
│   │       │   ├── KioskMode/         ← Self-ordering (no staff)
│   │       │   ├── PINLogin/          ← Staff PIN entry screen
│   │       │   └── Settings/          ← Device settings (manager PIN required)
│   │       ├── db/                    ← WatermelonDB models + sync engine
│   │       ├── store/                 ← Zustand: cart, session, offline queue
│   │       └── components/
│   │           ├── Cart/
│   │           ├── ProductGrid/       ← Quick-add grid (ML-sorted)
│   │           ├── PaymentSheet/      ← M-Pesa, cash, card flows
│   │           └── ReceiptPreview/
│   │
│   ├── manager/                       ← APP 2: React Web — Manager Portal
│   │   └── src/                       ← Back-of-house ops: at venue on tablet/laptop
│   │       ├── pages/
│   │       │   ├── Overview/          ← Shift summary, open orders, current staff
│   │       │   ├── Staff/             ← Clock-ins, roles, PIN management, invites
│   │       │   ├── Inventory/         ← Stock levels, adjustments, wastage log
│   │       │   ├── PurchaseOrders/    ← Create PO, receive stock, discrepancies
│   │       │   ├── FloorPlan/         ← Table layout editor
│   │       │   ├── AuditLog/          ← Transaction investigation, void log
│   │       │   ├── Reconciliation/    ← Till count, M-Pesa statement match
│   │       │   └── ShiftReports/      ← Daily/shift sales, staff performance
│   │       └── components/
│   │
│   ├── dashboard/                     ← APP 3: React Web — Owner App
│   │   └── src/                       ← Intelligence: from phone browser, anywhere
│   │       ├── pages/
│   │       │   ├── Home/              ← Live revenue, all branches, milestones
│   │       │   ├── Intelligence/      ← AI briefings, NL query, benchmarks
│   │       │   ├── Reports/           ← Sales trends, menu engineering, forecasts
│   │       │   ├── Customers/         ← Profiles, loyalty, credit tabs, campaigns
│   │       │   ├── MultiLocation/     ← All branches at a glance
│   │       │   ├── Financial/         ← P&L, cash flow, tax savings (Phase 2)
│   │       │   ├── Menu/              ← Products, variants, price books
│   │       │   └── Settings/          ← Business, integrations, API keys, billing
│   │       └── components/
│   │
│   └── ml/                            ← Python ML service (separate deploy)
│       ├── main.py                    ← FastAPI app
│       ├── forecasting.py             ← Prophet demand models
│       ├── menu_engineering.py        ← LightGBM item classification
│       ├── anomaly.py                 ← Isolation Forest
│       └── embeddings.py             ← Sentence-Transformers
│
└── packages/
    ├── shared/                        ← Types, utils shared across apps
    │   ├── types/                     ← Zod schemas + TypeScript types
    │   ├── constants/                 ← Currencies, timezones, event codes
    │   └── utils/                     ← Money formatting, phone normalization
    └── ui/                            ← Shared React component library
        └── components/
```

---

## 4. The Three Apps — Persona Reference

The system has three distinct user-facing apps, each for a different person with a different job.

### Persona Map

| | APP 1: POS Terminal | APP 2: Manager Portal | APP 3: Owner App |
|--|---------------------|----------------------|-----------------|
| **Who** | Cashier, Server, Kitchen staff, Host | Manager, Supervisor | Business owner |
| **Where** | On the POS device at the counter, tableside, kitchen | At a tablet or laptop in the venue | From anywhere — phone browser |
| **When** | During service, every transaction | During their shift + end-of-day | Morning briefing, periodic checks |
| **Primary job** | Take orders, process payments, manage tables, see kitchen queue | Run the shift — inventory, staff, reconciliation, investigate issues | Understand the business — is it growing, where is money going |
| **Tech** | React Native (Android) | React Web | React Web |
| **Offline** | 100% required — no internet = no problem | Partial — needs sync but not real-time | Not needed — intelligence is read-only |
| **URL / deploy** | APK sideload or Play Store | `manager.africanpos.co` | `app.africanpos.co` |
| **Primary auth** | 4-digit PIN (fast, no typing) | Email/OTP or PIN | Email/password + TOTP 2FA |

---

### What Each App Does NOT Have

**POS Terminal does NOT have:**
- Reports or analytics (not the cashier's job)
- Settings changes (requires manager PIN — redirects to manager portal)
- Staff management
- Purchase orders

**Manager Portal does NOT have:**
- Order-taking interface (that's the POS)
- AI morning briefings (owner only)
- Competitive benchmarking (owner only)
- Billing / subscription management
- Multi-business consolidated view

**Owner App does NOT have:**
- Real-time order queue (manager's domain)
- Cash drawer controls
- Inventory receive / stock adjustment forms
- KDS view
- Floor plan editor

---

### The Rule: Which App Gets What Feature

When a new feature is being built, ask:

> "Is this about **doing** (operating the business right now) or **knowing** (understanding the business)?"

- **Doing + front-of-house** → POS Terminal
- **Doing + back-of-house** → Manager Portal
- **Knowing** → Owner App

When WhatsApp sends an alert, the owner gets it in WhatsApp first. The Owner App is where they go for *more detail*. The Manager Portal is where the manager goes to *take action*.

---

## 5. Process Topology

Four processes in production, all independently deployable:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PROCESS 1: api-server                                                   │
│ Port: 3000                                                              │
│ Handles: REST API, WebSockets (KDS/KDS hub via Socket.io), webhooks    │
│ Scales: Horizontal (stateless — sessions in Redis, files in R2)        │
│ Start: node dist/server.js                                              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ PROCESS 2: worker                                                       │
│ Port: none (worker, no HTTP)                                            │
│ Handles: BullMQ queues — WhatsApp, PDFs, briefings, sync, eTIMS       │
│ Scales: Add workers per queue if a specific queue backs up             │
│ Start: node dist/worker/index.js                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ PROCESS 3: ml-service                                                   │
│ Port: 8000 (internal only — NOT exposed to internet)                   │
│ Handles: FastAPI endpoints called by BullMQ worker nightly             │
│ Scales: Single instance until data volume demands otherwise            │
│ Start: uvicorn main:app --host 0.0.0.0 --port 8000                     │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ PROCESS 4: kds-hub (initially runs inside api-server)                  │
│ Socket.io namespace: /kds                                               │
│ Handles: Kitchen display WebSocket connections, order routing           │
│ Extracted: when api-server WebSocket load requires dedicated process   │
└────────────────────────────────────────────────────────────────────────┘
```

**Inter-process communication:**
- `api-server` → `worker`: BullMQ job enqueue to Redis
- `worker` → `ml-service`: HTTP POST to internal FastAPI (e.g., `POST /forecast/{business_id}`)
- `api-server` → KDS clients: Socket.io via Redis pub/sub adapter (so multiple api-server instances share KDS state)

---

## 6. Database Architecture

### 5.1 Multi-Tenant Entity Hierarchy

```
USER
  └── ORGANIZATION (optional — holding company wrapper)
        └── BUSINESS  (e.g., "Mama's Kitchen")
              ├── LOCATION / BRANCH  (e.g., "Westlands Branch")
              │     ├── TERMINAL (device)
              │     ├── STAFF (assigned here)
              │     └── INVENTORY (physical stock)
              └── SHARED SETTINGS (menu, products — inherited by branches)
```

Every table with business-scoped data carries `business_id`. PostgreSQL Row-Level Security enforces this — it is not just an application-level check.

### 5.2 Core Schema (Locked)

```sql
-- ─── IDENTITY & TENANCY ───────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT,
  full_name     TEXT NOT NULL,
  locale        TEXT DEFAULT 'en',     -- 'sw' | 'yo' | 'ha' | 'am' | 'fr'
  timezone      TEXT DEFAULT 'Africa/Nairobi',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  plan        TEXT DEFAULT 'starter'   -- 'starter'|'growth'|'pro'|'enterprise'
);

CREATE TABLE businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  owner_id        UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,      -- 'restaurant'|'retail'|'hybrid'|'salon'
  country         TEXT DEFAULT 'KE',
  currency        TEXT DEFAULT 'KES',
  timezone        TEXT DEFAULT 'Africa/Nairobi',
  logo_url        TEXT,
  whatsapp_number TEXT,               -- business WhatsApp number (Meta API)
  mpesa_shortcode TEXT,               -- Safaricom paybill/till
  kra_pin         TEXT,               -- for eTIMS compliance
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  name         TEXT NOT NULL,
  address      TEXT,
  latitude     DECIMAL,
  longitude    DECIMAL,
  mpesa_till   TEXT,                  -- location-specific till (can differ from business)
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STAFF & AUTH ─────────────────────────────────────────────────────
CREATE TABLE staff (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  location_id  UUID REFERENCES locations(id),   -- NULL = access all branches
  name         TEXT NOT NULL,
  role         TEXT NOT NULL,          -- 'owner'|'manager'|'cashier'|'server'|'kitchen'
  pin_hash     TEXT,                   -- bcrypt of 4-digit PIN
  is_active    BOOLEAN DEFAULT TRUE,
  photo_url    TEXT,                   -- optional clock-in selfie
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES staff(id),
  device_id    TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUCTS & CATALOG ───────────────────────────────────────────────
CREATE TABLE categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  parent_id    UUID REFERENCES categories(id),
  name         TEXT NOT NULL,
  name_sw      TEXT,                   -- Swahili name
  sort_order   INTEGER DEFAULT 0
);

CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id),
  category_id           UUID REFERENCES categories(id),
  name                  TEXT NOT NULL,
  name_sw               TEXT,          -- Swahili display name on POS
  description           TEXT,
  sku                   TEXT,
  barcode               TEXT,
  image_url             TEXT,
  unit                  TEXT DEFAULT 'each',  -- 'each'|'kg'|'litre'|'metre'
  base_price            INTEGER NOT NULL,     -- always integer cents (KES * 100)
  cost_price            INTEGER,              -- ingredient cost (for menu engineering)
  is_variant_parent     BOOLEAN DEFAULT FALSE,
  parent_product_id     UUID REFERENCES products(id),
  variant_attributes    JSONB,               -- {"size": "L", "color": "Red"}
  is_active             BOOLEAN DEFAULT TRUE,
  deleted_at            TIMESTAMPTZ,         -- soft delete only
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id),
  location_id       UUID NOT NULL REFERENCES locations(id),
  quantity          DECIMAL NOT NULL DEFAULT 0,
  low_stock_alert   DECIMAL NOT NULL DEFAULT 5,
  UNIQUE(product_id, location_id)
);

CREATE TABLE price_books (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  name         TEXT NOT NULL,         -- 'Retail'|'Wholesale'|'Employee'|'Happy Hour'
  priority     INTEGER DEFAULT 0,
  start_time   TIME,                  -- for happy hour (NULL = always active)
  end_time     TIME,
  days_active  INTEGER[],             -- [1,2,3,4,5] = Mon-Fri
  is_default   BOOLEAN DEFAULT FALSE
);

CREATE TABLE price_book_items (
  price_book_id  UUID REFERENCES price_books(id),
  product_id     UUID REFERENCES products(id),
  price          INTEGER NOT NULL,    -- override price in this book
  PRIMARY KEY (price_book_id, product_id)
);

-- ─── ORDERS ───────────────────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  order_number    TEXT NOT NULL,      -- human-readable: "0042"
  channel         TEXT NOT NULL,      -- 'pos'|'qr'|'whatsapp'|'online'|'delivery'|'kiosk'
  status          TEXT NOT NULL DEFAULT 'open',
  -- 'open'|'in_progress'|'ready'|'served'|'paid'|'voided'
  staff_id        UUID REFERENCES staff(id),
  customer_id     UUID,               -- REFERENCES customers(id) — nullable for walk-in
  table_id        UUID,               -- REFERENCES tables(id) — restaurant only
  subtotal        INTEGER NOT NULL DEFAULT 0,    -- KES * 100
  tax_amount      INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  delivery_platform TEXT,             -- 'bolt'|'glovo'|'ubereats' if channel=delivery
  is_synced       BOOLEAN DEFAULT FALSE,          -- offline sync status
  local_id        TEXT,               -- device-generated ID for conflict detection
  etims_receipt   TEXT,               -- KRA eTIMS receipt number
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ
);

CREATE TABLE order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id),
  product_id     UUID REFERENCES products(id),
  product_name   TEXT NOT NULL,       -- snapshot at time of sale (product can change later)
  product_cost   INTEGER,             -- ingredient cost snapshot for P&L
  quantity       DECIMAL NOT NULL,
  unit_price     INTEGER NOT NULL,
  modifiers      JSONB DEFAULT '[]',  -- [{"name":"Extra Cheese","price":5000}]
  notes          TEXT,
  kds_station_id UUID,
  kitchen_status TEXT DEFAULT 'pending',  -- 'pending'|'cooking'|'ready'|'served'
  fired_at       TIMESTAMPTZ,
  ready_at       TIMESTAMPTZ
);

-- ─── PAYMENTS ─────────────────────────────────────────────────────────
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  method           TEXT NOT NULL,     -- 'mpesa'|'cash'|'card'|'loyalty'|'credit'
  amount           INTEGER NOT NULL,  -- KES * 100
  currency         TEXT DEFAULT 'KES',
  reference        TEXT,              -- M-Pesa receipt, card auth code
  phone            TEXT,              -- M-Pesa payer phone
  idempotency_key  TEXT UNIQUE NOT NULL,
  status           TEXT DEFAULT 'pending',  -- 'pending'|'completed'|'failed'|'refunded'
  provider_data    JSONB,             -- raw provider response stored verbatim
  is_offline       BOOLEAN DEFAULT FALSE,   -- captured offline, pending sync
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ
);

-- ─── CUSTOMERS ────────────────────────────────────────────────────────
CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  phone            TEXT NOT NULL,     -- universal ID — M-Pesa auto-captures this
  name             TEXT,
  email            TEXT,
  loyalty_points   INTEGER DEFAULT 0,
  loyalty_tier     TEXT DEFAULT 'bronze',   -- 'bronze'|'silver'|'gold'|'platinum'
  credit_balance   INTEGER DEFAULT 0,       -- KES * 100 outstanding credit
  credit_limit     INTEGER DEFAULT 0,
  total_spent      INTEGER DEFAULT 0,
  visit_count      INTEGER DEFAULT 0,
  last_visit       TIMESTAMPTZ,
  notes            TEXT,              -- staff notes visible at checkout
  tags             TEXT[],            -- ['vip','credit_customer','allergy_nuts']
  preferred_lang   TEXT DEFAULT 'en',
  birthday         DATE,
  UNIQUE(business_id, phone)
);

-- ─── LOYALTY ──────────────────────────────────────────────────────────
CREATE TABLE loyalty_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  order_id      UUID REFERENCES orders(id),
  event_type    TEXT NOT NULL,        -- 'earn'|'redeem'|'expire'|'bonus'|'adjust'
  points        INTEGER NOT NULL,     -- positive=earn, negative=redeem
  balance_after INTEGER NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RESTAURANT TABLES ────────────────────────────────────────────────
CREATE TABLE restaurant_tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id),
  name            TEXT NOT NULL,      -- 'Table 1', 'Terrace 5'
  capacity        INTEGER DEFAULT 4,
  position_x      DECIMAL,            -- pixel position on floor plan SVG
  position_y      DECIMAL,
  shape           TEXT DEFAULT 'rect',-- 'rect'|'round'
  status          TEXT DEFAULT 'available',
  -- 'available'|'occupied'|'reserved'|'cleaning'
  current_order_id UUID REFERENCES orders(id),
  is_ghost        BOOLEAN DEFAULT FALSE,  -- temporary table, not in base floor plan
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id),
  customer_id  UUID REFERENCES customers(id),
  table_id     UUID REFERENCES restaurant_tables(id),
  party_size   INTEGER NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  duration_min INTEGER DEFAULT 90,
  status       TEXT DEFAULT 'confirmed',
  -- 'confirmed'|'seated'|'cancelled'|'no_show'
  notes        TEXT,
  whatsapp_reminder_sent BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── KITCHEN ──────────────────────────────────────────────────────────
CREATE TABLE kds_stations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL REFERENCES locations(id),
  name                   TEXT NOT NULL,      -- 'Grill', 'Bar', 'Cold', 'Pastry'
  category_ids           UUID[],             -- which menu categories route here
  display_timeout_sec    INTEGER DEFAULT 600,
  position               INTEGER DEFAULT 0   -- display order
);

-- ─── INVENTORY ────────────────────────────────────────────────────────
CREATE TABLE suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  name         TEXT NOT NULL,
  phone        TEXT,
  whatsapp     TEXT,
  email        TEXT,
  credit_limit INTEGER DEFAULT 0,     -- Mkopo: credit supplier has given us
  balance_owed INTEGER DEFAULT 0      -- what we currently owe them
);

CREATE TABLE purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id),
  status          TEXT DEFAULT 'draft',
  -- 'draft'|'sent'|'acknowledged'|'partial'|'received'|'cancelled'
  items           JSONB NOT NULL,     -- [{product_id, qty_ordered, unit_price}]
  total_amount    INTEGER,
  expected_date   DATE,
  received_at     TIMESTAMPTZ,
  discrepancy     JSONB,              -- qty_ordered vs qty_received per item
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id),
  product_id   UUID NOT NULL REFERENCES products(id),
  staff_id     UUID NOT NULL REFERENCES staff(id),
  delta        DECIMAL NOT NULL,      -- positive=receive, negative=shrinkage
  reason       TEXT NOT NULL,         -- mandatory: 'wastage'|'damage'|'count'|'theft'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────
-- Non-negotiable. Build week 1. Never bypass.
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  staff_id     UUID REFERENCES staff(id),
  action       TEXT NOT NULL,
  -- 'void_order'|'refund_payment'|'discount_applied'|'price_change'|
  -- 'stock_adjust'|'cash_drawer_open'|'login_failed'|'settings_change' etc.
  entity_type  TEXT,                  -- 'order'|'payment'|'product'|'staff'
  entity_id    UUID,
  old_value    JSONB,                 -- state before the action
  new_value    JSONB,                 -- state after the action
  reason       TEXT,                  -- mandatory for destructive actions
  device_id    TEXT,
  ip_address   INET,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CREDIT TABS (OWEAME) ─────────────────────────────────────────────
CREATE TABLE credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  order_id      UUID REFERENCES orders(id),
  type          TEXT NOT NULL,         -- 'charge'|'payment'
  amount        INTEGER NOT NULL,      -- KES * 100
  balance_after INTEGER NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LAYAWAY ──────────────────────────────────────────────────────────
CREATE TABLE layaway_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  product_id      UUID REFERENCES products(id),
  description     TEXT NOT NULL,
  total_price     INTEGER NOT NULL,
  deposit_paid    INTEGER DEFAULT 0,
  balance_due     INTEGER,
  payment_schedule JSONB,             -- [{due_date, amount}]
  status          TEXT DEFAULT 'active', -- 'active'|'completed'|'abandoned'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TAX COMPLIANCE ───────────────────────────────────────────────────
CREATE TABLE etims_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id),
  order_id       UUID REFERENCES orders(id),
  receipt_number TEXT,                -- KRA-assigned receipt number
  qr_code        TEXT,                -- KRA QR embedded in receipt
  status         TEXT DEFAULT 'pending',  -- 'pending'|'accepted'|'rejected'
  submitted_at   TIMESTAMPTZ,
  response_data  JSONB                -- raw KRA API response
);

-- ─── AUTOMATION RULES ─────────────────────────────────────────────────
CREATE TABLE automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id),
  name          TEXT NOT NULL,
  trigger_type  TEXT NOT NULL,        -- 'stock_low'|'customer_vip'|'schedule'|'void_spike'
  trigger_data  JSONB,                -- threshold values, cron expression
  action_type   TEXT NOT NULL,        -- 'whatsapp_alert'|'tag_customer'|'generate_report'
  action_data   JSONB,
  is_active     BOOLEAN DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ
);
```

### 5.3 Critical Indexes

```sql
-- Order lookup (hottest query in the system)
CREATE INDEX idx_orders_location_status ON orders(location_id, status, created_at DESC);
CREATE INDEX idx_orders_business_date   ON orders(business_id, created_at DESC);

-- M-Pesa idempotency (prevents double charges)
CREATE UNIQUE INDEX idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX idx_payments_order ON payments(order_id);

-- Customer phone lookup (every M-Pesa payment triggers this)
CREATE UNIQUE INDEX idx_customers_phone ON customers(business_id, phone);

-- Audit log filtering (owner investigation tool)
CREATE INDEX idx_audit_business_date  ON audit_log(business_id, created_at DESC);
CREATE INDEX idx_audit_staff          ON audit_log(staff_id, created_at DESC);
CREATE INDEX idx_audit_entity         ON audit_log(entity_type, entity_id);

-- Stock queries
CREATE UNIQUE INDEX idx_stock_product_location ON product_stock(product_id, location_id);

-- Analytics hot path (DuckDB reads from read replica, not primary)
CREATE INDEX idx_orders_analytics ON orders(business_id, paid_at, total, channel)
  WHERE status = 'paid';
```

### 5.4 Row-Level Security

```sql
-- Enable RLS on every tenanted table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- ... and every other table with business_id

-- Policy: app user can only see their own business data
-- The JWT payload includes business_id, set as session var on connection
CREATE POLICY tenant_isolation ON orders
  USING (business_id = current_setting('app.current_business_id')::UUID);
```

---

## 7. Key Data Flows

### 6.1 M-Pesa STK Push Payment Flow

```
POS App                  API Server                 Safaricom Daraja
   │                         │                            │
   │── POST /orders/{id}/payments/mpesa ──────────────────►│
   │   { phone, idempotency_key }                          │
   │                         │                            │
   │                         │── POST LipaNaMpesa ────────►│
   │                         │   { shortcode, amount,      │
   │                         │     phone, callbackURL }    │
   │                         │                            │
   │◄─ 202 Accepted ─────────│◄── CheckoutRequestID ──────│
   │   { checkout_id }       │                            │
   │                         │                            │
   │ [customer sees STK push on phone]                    │
   │ [customer enters M-Pesa PIN]                         │
   │                         │                            │
   │                         │◄── POST /webhooks/mpesa ───│
   │                         │    { ResultCode: 0,         │
   │                         │      MpesaReceiptNumber }  │
   │                         │                            │
   │                         │── mark order PAID          │
   │                         │── enqueue WhatsApp receipt │
   │                         │── emit Socket.io event     │
   │                         │                            │
   │◄── Socket.io 'payment.confirmed' ───────────────────│
   │    { orderId, reference }│                            │
   │                         │                            │
   ▼ [POS shows paid screen] ▼                            ▼
```

**Timeout handling:** If no webhook in 60 seconds, POS shows retry prompt. Worker polls `CheckoutRequestID` status endpoint every 30s for 5 minutes, then marks failed with reason.

**Idempotency:** `idempotency_key` = `{device_id}_{order_id}_{timestamp}`. Duplicate key on the payments table prevents double-charge if webhook fires twice.

---

### 6.2 Offline Sync Flow (WatermelonDB ↔ API)

```
POS App (offline)                    API Server (when online)
   │                                        │
   │ [All writes go to local SQLite first]  │
   │ orders table: is_synced = false        │
   │ payments table: is_offline = true      │
   │                                        │
   │ [Network restored]                     │
   │                                        │
   │── POST /sync/push ─────────────────────►│
   │   { orders: [...], payments: [...],    │
   │     stock_adjustments: [...] }         │
   │                                        │
   │                         [conflict check per entity]
   │                         [server timestamp wins for menu]
   │                         [local sale wins for inventory]
   │                         [idempotency key deduplicates payments]
   │                                        │
   │◄── 200 OK ─────────────────────────────│
   │   { merged_orders: [...],              │
   │     conflicts: [...] }                 │
   │                                        │
   │── POST /sync/pull ─────────────────────►│
   │   { last_synced_at: "..." }            │
   │                                        │
   │◄── { menu_updates, price_changes,      │
   │      loyalty_updates, new_staff } ────│
   │                                        │
   ▼ [mark all synced records is_synced=true]
```

**Sync priority order:**
1. M-Pesa confirmations and payments (financial data first)
2. Void and refund records (audit data)
3. New orders
4. Inventory adjustments
5. Customer loyalty updates
6. Menu changes (cloud always wins)

---

### 6.3 WhatsApp AI Order Flow

```
Customer (WhatsApp)              Meta Cloud API           API Server (notifications module)
   │                                   │                           │
   │── "nataka ugali mbili na samaki" ─►│                           │
   │                                   │── POST /webhooks/wa ──────►│
   │                                   │                           │
   │                                   │         [Claude parses intent]
   │                                   │         [match to product catalog]
   │                                   │         [build order summary]
   │                                   │                           │
   │◄── "Umechagua:\n2x Ugali na Samaki" ◄─── send message ────────│
   │    "Jumla: KES 480\nKulipa? 1=Ndiyo"│                           │
   │                                   │                           │
   │── "1" ─────────────────────────────►│                           │
   │                                   │── POST /webhooks/wa ──────►│
   │                                   │                           │
   │                                   │         [create order in DB]
   │                                   │         [initiate STK Push]
   │                                   │         [route to KDS]
   │                                   │                           │
   │◄── "M-Pesa inatumwa..." ───────────◄─── send message ─────────│
   │                                   │                           │
   │ [STK Push on same phone]          │                           │
   │ [Customer enters PIN]             │                           │
   │                                   │◄─── Daraja webhook ────────│
   │◄── "✅ Malipo yamekamilika!\n      ◄─── send receipt ──────────│
   │    Ref: QAB7YX12"                 │                           │
```

---

### 6.4 AI Morning Briefing Flow (4AM → 6AM)

```
4:00 AM: BullMQ cron fires 'morning-briefing' job
            │
            ▼
Worker process picks up job
            │
            ├── Query PostgreSQL read replica (yesterday's data per business)
            │   • orders, payments, staff_clock_ins, stock_adjustments
            │
            ├── Query ML service: GET /forecast/{business_id}
            │   • items at risk of stockout today
            │
            ├── Build context prompt (compressed data + schema)
            │
            ├── POST to Anthropic Claude API
            │   • Natural language briefing generation
            │   • In English or Swahili per owner preference
            │   • African context: "Tomorrow is Eid — historically your busiest day"
            │
            ├── Format as WhatsApp message
            │
            └── POST to Meta WhatsApp API → owner phone
                  │
6:00 AM:          ▼
            Owner reads briefing while making tea ☕
            Can reply "MORE DETAIL on inventory" → Claude expands → WhatsApp reply
```

---

## 8. Infrastructure Architecture

### 7.1 Phase 1: Railway.app (Month 1–12, 0–500 merchants)

```
Railway Project
│
├── Services:
│   ├── api-server       (Node.js — auto-scaled, $20-60/month)
│   ├── worker           (Node.js — single instance, $10/month)
│   ├── ml-service       (Python — single instance, $15/month)
│   ├── postgresql       (Managed, 10GB, daily backups, $20/month)
│   └── redis            (Managed, 512MB, $10/month)
│
├── File storage: Cloudflare R2    ($0 egress, $0.015/GB/month)
├── Search: Meilisearch Cloud      ($30/month for starter)
│
└── Total: ~$105-135/month

Trigger to migrate: Railway costs exceed $400/month OR compliance requires it
```

**Railway advantages for early stage:**
- Zero ops overhead — no Kubernetes, no VPCs, no IAM roles to configure
- Managed PostgreSQL with automatic backups
- GitHub push → auto-deploy in under 2 minutes
- Sleep-mode protection: Railway does NOT sleep services (unlike Render free tier)

### 7.2 Phase 2: AWS (Month 12+, 500+ merchants)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS (af-south-1 Cape Town)               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    VPC (10.0.0.0/16)                    │    │
│  │                                                          │    │
│  │  Public Subnets (AZ-a, AZ-b)                            │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Application Load Balancer                       │    │    │
│  │  │  (HTTPS termination, health checks)              │    │    │
│  │  └─────────────────┬───────────────────────────────┘    │    │
│  │                    │                                     │    │
│  │  Private Subnets   │                                     │    │
│  │  ┌─────────────────▼───────────────────────────────┐    │    │
│  │  │  ECS Fargate (auto-scaling)                      │    │    │
│  │  │  • api-server tasks (2 min, scale to 10)         │    │    │
│  │  │  • worker tasks (1 min, scale by queue depth)    │    │    │
│  │  │  • ml-service tasks (1 min, scale by CPU)        │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  ┌───────────────────┐  ┌─────────────────────────┐     │    │
│  │  │  RDS PostgreSQL   │  │  ElastiCache Redis       │     │    │
│  │  │  (Multi-AZ, r7g)  │  │  (cluster mode, r7g)    │     │    │
│  │  │  + read replica   │  │                          │     │    │
│  │  └───────────────────┘  └─────────────────────────┘     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  AWS Secrets Manager (API keys, Daraja credentials)              │
│  CloudWatch Logs (application logs)                              │
│  S3 + DuckDB Parquet (ML feature store)                          │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  Cloudflare (CDN, WAF)      Cloudflare R2 (files)
```

**Region selection: `af-south-1` (Cape Town)**
- Lowest latency for Kenya/East Africa from AWS
- Compliant with African data residency requirements
- Available: RDS, ElastiCache, ECS Fargate, Secrets Manager

### 7.3 Network and CDN Architecture

```
Internet
   │
   ▼
Cloudflare (free plan covers everything for years)
   ├── DNS: all records managed here
   ├── SSL: automatic TLS 1.3, HSTS
   ├── WAF: OWASP ruleset (blocks SQLi, XSS, common attacks)
   ├── DDoS: L3/L4/L7 protection (automatic)
   ├── CDN: static assets (dashboard JS/CSS, menu images)
   ├── R2: file storage (supplier invoice images, product photos)
   └── Cache rules:
       ├── /api/* → no cache (dynamic)
       ├── /menu/* → 5 min cache (menu changes infrequently)
       └── /static/* → 1 year cache + immutable headers

Domains:
   ├── api.africanpos.co      → API server
   ├── app.africanpos.co      → Owner dashboard
   ├── order.africanpos.co    → QR table ordering pages
   └── {slug}.africanpos.co   → Online ordering pages (mama-kitchen.africanpos.co)
```

---

## 9. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml — structure overview

trigger: push to main branch

jobs:
  test:
    - pnpm install (cached)
    - pnpm typecheck (all apps)
    - pnpm test (Vitest — unit + integration)
    - pnpm test:e2e (Playwright — dashboard only)

  build:
    needs: test
    - turbo build (all apps, cached artifacts)
    - docker build api-server image
    - docker build worker image
    - docker build ml-service image
    - push images to registry (GitHub Container Registry or ECR)

  deploy:
    needs: build
    environment: production
    - Railway: railway up (Phase 1)
    - AWS: ECS rolling deployment (Phase 2)
    - run: drizzle-kit migrate (database migrations before code deploy)
    - notify: Slack/WhatsApp on success or failure
```

**Environments:**

| Environment | Branch | Database | Purpose |
|-------------|--------|----------|---------|
| development | local | localhost | daily dev |
| staging | `develop` | Railway staging | QA + partner testing |
| production | `main` | Railway/AWS prod | real merchants |

**Migration safety rule:** Drizzle migrations must be backward-compatible for one deploy cycle. Deploy new code that handles both old and new schema, then remove old schema in the next deploy.

---

## 10. Security Architecture

### 9.1 Authentication Flow

```
Owner login (web dashboard):
  POST /auth/login { email, password }
  → bcrypt verify password_hash
  → issue { access_token (15min RS256), refresh_token (30d HS256) }
  → access_token includes: { sub: user_id, business_ids: [...], scope: 'admin:write' }

Staff POS login (PIN):
  POST /auth/pin { device_id, pin, location_id }
  → validate device is registered to this location
  → bcrypt verify pin_hash
  → issue { access_token (8h HS256) }
  → token includes: { sub: staff_id, location_id, business_id, role, scope: 'pos:write' }

WhatsApp OTP login:
  POST /auth/otp/send { phone }
  → generate 6-digit TOTP
  → send via WhatsApp
  POST /auth/otp/verify { phone, otp }
  → verify, issue tokens
```

### 9.2 Authorization: Scope Hierarchy

| Scope | Can do |
|-------|--------|
| `pos:read` | Read orders, menu, tables |
| `pos:write` | Create orders, process payments |
| `reports:read` | View analytics, run queries |
| `manager:write` | Approve voids, refunds, discounts |
| `admin:write` | Change settings, staff, pricing |
| `owner` | Everything + billing + integrations |

Every API route declares its required scope. The Fastify middleware validates the JWT and checks the scope before the handler runs.

### 9.3 Multi-Tenant Data Isolation

Three layers of isolation (defense in depth):

1. **Application layer:** Every service method accepts `businessId` and filters by it
2. **ORM layer:** Drizzle queries always include `.where(eq(orders.businessId, businessId))`
3. **Database layer:** PostgreSQL RLS policies prevent any query from seeing cross-tenant data

A bug in layer 1 cannot expose tenant data — layer 3 catches it.

### 9.4 Payment Security

- **M-Pesa credentials:** Stored in Railway Secrets (dev) → AWS Secrets Manager (prod). Never in `.env` files.
- **Webhook signature verification:** All Safaricom Daraja webhooks verified with HMAC-SHA256 before processing
- **Idempotency:** Every payment initiation requires `Idempotency-Key` header. Duplicate keys return the original response — no double charges
- **Amount validation:** Server always re-calculates the order total from the database. Client-sent amount is ignored. The amount sent to Daraja comes from the DB, not the request body.
- **Card data:** Never stored. Flutterwave/Paystack handle PCI DSS — we store only the authorization code and last 4 digits
- **Offline card store-and-forward:** Card data encrypted with AES-256 using a device-specific key. Decrypted on reconnect, submitted immediately, key rotated

### 9.5 API Security

```
Rate limits:
  POST /auth/*          → 10 req/min per IP (brute force protection)
  POST /payments/*      → 30 req/min per business (fraud protection)
  GET  /analytics/*     → 120 req/min per user
  POST /reports/query   → 10 req/min per user (LLM is expensive)
  Default              → 60 req/min per API key

Headers (all responses):
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'
  Referrer-Policy: strict-origin-when-cross-origin

CORS:
  Allowlist: [app.africanpos.co, order.africanpos.co, localhost:3000]
  Never wildcard *
```

---

## 11. Observability Stack

```
Errors:       Sentry (Node.js SDK in api-server + worker)
              → all unhandled exceptions with full stack trace
              → Sentry context: business_id, staff_id, request_id

Product       PostHog Cloud (dev/staging) → self-hosted (production)
Analytics:    SDK: posthog-js in manager + dashboard apps
              SDK: posthog-node in API (server-side events)
              SDK: posthog-react-native in POS app
              → funnel: signup → first product → first order → first M-Pesa → Day 30 retention
              → feature adoption: KDS, floor plan, WhatsApp orders, kiosk, layaway
              → feature flags: gradual rollout of new features per cohort

              Key events tracked:
              order_started        — cashier begins taking an order
              item_added_to_cart   — product_id, category, price_kes
              payment_method_selected — mpesa/cash/card
              mpesa_stk_initiated  — amount_kes (latency starts)
              mpesa_stk_confirmed  — seconds_to_confirm (critical latency KPI)
              mpesa_stk_failed     — reason code
              offline_mode_entered — battery_level, pending_orders_count
              sync_completed       — records_synced, duration_ms
              void_requested       — order_value, reason
              feature_used         — feature_name (kds/floor_plan/layaway/catering)
              product_searched     — term, results_count

Mobile:       Firebase Analytics (React Native POS app)
              → session length, screen time, crash rates
              → already using Firebase FCM, zero extra setup cost

Metrics:      Grafana Cloud + Prometheus
              → API p50/p95/p99 response times
              → BullMQ queue depths (alert > 100 pending)
              → PostgreSQL connections + query times
              → Redis memory usage
              → M-Pesa webhook delivery rate + latency
              → Daily active restaurants (DAR) — primary business metric

Logs:         Pino JSON → Grafana Loki
              → every request: { method, url, status, responseTime, request_id }
              → every BullMQ job: { name, id, duration, success/fail }

Alerts (WhatsApp to founder):
  → API error rate > 5% for 2 minutes
  → morning-briefing BullMQ job failed
  → PostgreSQL connection pool exhausted
  → M-Pesa webhook failure rate > 10%
  → Any mass void event (> 5 voids in 10 min from one device)
  → Repeated login failures (brute force signal)
```

---

## 12. Offline Architecture Detail

### The Core Rule

> All writes go to WatermelonDB (SQLite) first.  
> Cloud sync is a background event, never a blocker.  
> A merchant with no internet should be 100% functional for 72 hours.

### Device-Side Storage

```
WatermelonDB tables (mirroring server schema):
  orders, order_items, products, customers, payments
  loyalty_events, stock_adjustments, restaurant_tables

Every record has:
  local_id      — UUID generated on device (never server-assigned locally)
  is_synced     — boolean, false until confirmed by server
  updated_at    — timestamp, used for conflict resolution
```

### Conflict Resolution Rules

| Entity | Rule | Rationale |
|--------|------|-----------|
| Sale (order) | Local write wins | Cannot un-sell something already given to customer |
| Menu/prices | Server wins | Manager updated remotely — device must reflect it |
| Stock count | Merge: subtract local sales from server count | Both sides made valid changes |
| Customer loyalty | Server wins | Loyalty is cross-device — server is the source of truth |
| Payment | Idempotency key prevents duplication | Same key = same payment |
| Audit log | All local events queued and flushed | No audit event is ever dropped |

### Offline Payments

```
Cash:       100% offline capable. No server needed.

M-Pesa:     Offline QR mode:
            1. Static merchant QR always pre-loaded on device
            2. Customer scans → pays to M-Pesa till manually
            3. POS records payment as { status: 'pending_confirmation' }
            4. On reconnect: worker pulls M-Pesa statement via Daraja
            5. Auto-match: amount + ±5 minute timestamp window → confirm
            6. Unmatched → flagged in dashboard for manual reconciliation

Card:       Store-and-forward:
            1. Card data encrypted with device key
            2. Stored locally as { status: 'pending_sync' }
            3. On reconnect: submitted to Flutterwave/Paystack
            4. If declined after sync: payment marked failed, order flagged
```

### Load Shedding Mode

```javascript
// Triggered when: battery < 20% AND power status = 'unplugged'
function activateLoadSheddingMode() {
  dimScreenTo(40%);
  disable(['reports', 'product_images', 'floor_plan_editor', 'background_sync']);
  showBanner(`Load shedding mode — battery: ${battery}%. Core functions only.`);
  startBatteryCountdown();
  enableMobileHotspotPrompt();  // "Connect to your phone's hotspot"
}
```

---

## 13. Integrations Reference

### Payment Providers

| Provider | Countries | Method | API | Priority |
|----------|-----------|--------|-----|----------|
| Safaricom Daraja v3 | Kenya | M-Pesa STK Push, C2B, B2C | REST | Core |
| MTN MoMo | Ghana, Uganda, Rwanda, Cameroon | Mobile money | REST | Month 6 |
| Airtel Money | Kenya, Uganda, Tanzania, Zambia | Mobile money | REST | Month 6 |
| Orange Money | Senegal, Mali, Ivory Coast | Mobile money | REST | Month 9 |
| Flutterwave | 34 African countries | Card + bank | REST | Month 2 |
| Paystack | Nigeria, Ghana | Card | REST | Month 6 |
| DPO Group | East + Southern Africa | Card | REST | Month 6 |
| Africa's Talking | 18 countries | USSD | REST | Month 12 |

### Communication Services

| Service | Use Case | Fallback |
|---------|----------|---------|
| Meta WhatsApp Business API (Cloud) | Receipts, orders, loyalty, alerts, briefings | AT SMS |
| Africa's Talking SMS | Fallback when WhatsApp fails | None |
| Firebase FCM | Push notifications to POS app | Background sync |

### External APIs

| API | Purpose | Module |
|-----|---------|--------|
| Anthropic Claude claude-sonnet-4-6 | NL reports, briefings, WhatsApp parsing, invoice OCR | reports/, notifications/ |
| AWS Transcribe | Swahili + English voice transcription | notifications/ |
| KRA eTIMS | Receipt compliance submission | tax/ |
| Deliverect | Bolt Food, Glovo, Uber Eats, Jumia aggregation | integrations/ |
| Xero API | Accounting sync | integrations/ |
| QuickBooks API | Accounting sync (alternative) | integrations/ |
| Google Maps / Geocoding | Location-based sunset time (Ramadan mode) | tables/ |
| CBK Exchange Rate API | Real-time KES/USD/EUR rates | payments/ |

---

## 14. API Design Rules (Non-Negotiable)

These rules apply to every endpoint. No exceptions.

```
1. Response shape:
   { data: ..., meta: { timestamp, request_id }, errors?: [...] }

2. Pagination:
   cursor-based only: ?cursor=xxxx&limit=50
   Never offset/page — it breaks on high-write tables

3. Money:
   Always integer cents: { amount: 87500, currency: "KES" }
   KES 875.00 = { amount: 87500 }
   NEVER use floats for money

4. Timestamps:
   ISO 8601 UTC always: "2026-06-24T12:34:56Z"
   Client converts to local time — server never sends local time

5. Errors:
   RFC 7807 Problem Details:
   { type: "https://pos.co/errors/insufficient-stock",
     title: "Insufficient Stock",
     detail: "Product 'Ugali' has 0 units at Karen branch",
     status: 422, instance: "/orders/abc-123" }

6. Rate limits:
   Standard: 60 req/min per API key
   Sync/webhook: 600 req/min

7. Auth:
   Bearer JWT — scopes: pos:read pos:write reports:read admin:write

8. Idempotency:
   ALL payment initiations require Idempotency-Key header
   Same key = same response, no double-charge

9. Versioning:
   /api/v1/ — breaking changes get new version
   Old versions deprecated with 12-month notice

10. Webhooks (outbound):
    Signed with HMAC-SHA256
    Retry: exponential backoff, max 5 attempts
    Delivery within 30 seconds of event
```

---

## 15. Done Definition (Non-Negotiable)

A feature is not complete until all 7 pass:

| # | Check | Failure = Block |
|---|-------|----------------|
| 1 | Works on KES 12,000 Android phone on 2G | Yes |
| 2 | Works fully offline OR degrades with visible badge | Yes |
| 3 | Untrained merchant completes task in < 60 seconds | Yes |
| 4 | Critical events trigger a WhatsApp notification | Yes |
| 5 | Every destructive action generates an audit log entry | Yes |
| 6 | API endpoint documented in OpenAPI 3.0 with examples | Yes |
| 7 | Failure states are designed (M-Pesa timeout, KDS offline, printer empty) | Yes |

---

## 16. Month-by-Month Infrastructure Milestones

| Milestone | Month | Infrastructure Focus |
|-----------|-------|---------------------|
| First sale | 1 | Railway: api + postgres + redis + worker |
| First WhatsApp receipt | 1 | Meta Cloud API connected |
| M-Pesa live | 1 | Daraja Sandbox → Production |
| eTIMS compliance | 2 | KRA eTIMS API connected, test with KRA |
| KDS live | 3 | Socket.io stable, Redis pub/sub tested under load |
| ML service | 5 | Python FastAPI deployed, Prophet models trained |
| Morning briefing | 5 | BullMQ cron + Claude API + WhatsApp delivery |
| 100 merchants | 6 | Evaluate Railway costs, plan migration |
| Read replica | 7 | DuckDB reads from replica only |
| WhatsApp commerce | 7 | Meta Webhook + NLP pipeline stable |
| 500 merchants | 10 | Begin AWS migration: RDS + ElastiCache first |
| AWS production | 12 | Full migration: ECS Fargate, af-south-1 |

---

## 17. The Three Moats This Architecture Protects

**Moat 1 — M-Pesa Native**
The payment module is designed around Daraja as the primary payment method, not a payment-options dropdown. The webhook handler, reconciliation job, offline QR fallback, and STK Push retry logic are all native to the system. A global POS adding M-Pesa later would need to retrofit this into their payment abstraction. We are starting from it.

**Moat 2 — Offline-First for Load Shedding**
WatermelonDB + the sync engine means 72-hour offline is not a degraded mode — it is the normal operating mode with cloud sync as a background bonus. This is built into the foundation, not the feature list.

**Moat 3 — WhatsApp as the Operating System**
Every notification path ends in WhatsApp. The notifications module treats WhatsApp as the primary channel, SMS as fallback, and push notifications as secondary. When the benchmark network reaches 1,000 merchants, the data moat activates. The architecture supports this from day one.

---

*Architecture version: 1.0 — June 2026*  
*Status: Approved. Start building with Month 1-2 features in `18-build-order-and-technical-decisions.md`.*  
*Next step: Initialize monorepo with Turborepo, set up Railway project, connect Daraja sandbox.*
