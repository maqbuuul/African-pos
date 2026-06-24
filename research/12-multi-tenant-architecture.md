# Multi-Tenant Architecture — Complete Design

> One owner. Many businesses. Many branches. Zero complexity for the user.

---

## The Problem with Every Existing POS

Toast: one restaurant = one account. Square: one business = one account. Lightspeed: multi-location exists but is bolted on.

**African reality**: One entrepreneur owns a restaurant in Westlands, a salon in Karen, and a small retail shop in Ngong Road. They want **one login, one dashboard, one bill** — and the ability to compare all three businesses side by side. No POS on earth does this cleanly.

---

## Entity Hierarchy

```
USER (one person, one login)
  └── ORGANIZATION (optional wrapper for business groups / holding companies)
        └── BUSINESS (e.g., "Mama's Kitchen", "Glam Salon", "Ngong Minimart")
              ├── LOCATION / BRANCH (e.g., "Westlands Branch", "CBD Branch")
              │     ├── TERMINAL (POS device at that branch)
              │     ├── STAFF (assigned to this branch)
              │     └── INVENTORY (stock at this branch)
              └── SHARED SETTINGS (menu, products, pricing — optionally shared across branches)
```

**Key rules:**
- One user can own many businesses
- One business can have many branches
- Staff belong to a branch (not a business — a manager can be assigned to multiple branches)
- Inventory is per branch (real stock lives somewhere physical)
- Menus and pricing can be set at business level (inherited by branches) or overridden per branch
- Reports can be viewed at any level: per branch, per business, or across all businesses

---

## Database Schema — Multi-Tenant Core

```sql
-- ─────────────────────────────────────────────────────
-- USERS & AUTHENTICATION
-- ─────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,          -- primary auth method in Africa
  password_hash TEXT,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  locale        TEXT DEFAULT 'en',    -- 'sw', 'yo', 'ha', 'am', 'fr'
  timezone      TEXT DEFAULT 'Africa/Nairobi',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────
-- ORGANIZATIONS (optional — for holding companies)
-- ─────────────────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  logo_url    TEXT,
  plan        TEXT DEFAULT 'business',  -- 'starter' | 'business' | 'pro' | 'enterprise'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- BUSINESSES
-- ─────────────────────────────────────────────────────
CREATE TABLE businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  owner_id        UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,      -- 'restaurant' | 'retail' | 'hybrid' | 'salon' | 'pharmacy' | 'fuel'
  sub_type        TEXT,               -- 'qsr' | 'fine_dining' | 'cafe' | 'bar' | 'supermarket' | ...
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#1A73E8',
  country         TEXT NOT NULL,      -- 'KE' | 'NG' | 'GH' | 'UG' | 'TZ' | 'ET' ...
  currency        TEXT NOT NULL,      -- 'KES' | 'NGN' | 'GHS' | 'UGX' | 'TZS'
  timezone        TEXT NOT NULL,
  tax_number      TEXT,               -- KRA PIN, FIRS TIN, SARS number
  tax_rate        DECIMAL DEFAULT 0,
  tax_inclusive   BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- LOCATIONS / BRANCHES
-- ─────────────────────────────────────────────────────
CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  name            TEXT NOT NULL,      -- 'Main Branch', 'Westlands', 'CBD Outlet'
  address         TEXT,
  city            TEXT,
  coordinates     POINT,              -- lat/lng for map
  phone           TEXT,
  mpesa_till      TEXT,               -- M-Pesa till number
  mpesa_paybill   TEXT,               -- M-Pesa paybill + account
  mtn_momo_code   TEXT,
  airtel_money    TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  opens_at        TIME DEFAULT '07:00',
  closes_at       TIME DEFAULT '22:00',
  timezone        TEXT,               -- overrides business timezone if different
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- STAFF & ROLES
-- ─────────────────────────────────────────────────────
CREATE TABLE staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),   -- NULL if not yet invited
  business_id   UUID NOT NULL REFERENCES businesses(id),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  pin           TEXT,                          -- 4-digit POS PIN (hashed)
  role          TEXT NOT NULL,                 -- see roles below
  is_active     BOOLEAN DEFAULT TRUE,
  invited_at    TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Staff can work at specific locations
CREATE TABLE staff_locations (
  staff_id    UUID REFERENCES staff(id),
  location_id UUID REFERENCES locations(id),
  is_manager  BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (staff_id, location_id)
);

-- ─────────────────────────────────────────────────────
-- ROLE PERMISSION MODEL
-- ─────────────────────────────────────────────────────
/*
  ROLES:
  'owner'        → sees all businesses, all data, billing, settings
  'admin'        → full access to one business (all branches)
  'manager'      → full access to their assigned branch(es)
  'supervisor'   → can approve voids/comps/discounts at their branch
  'cashier'      → take orders, process payments, basic reports
  'server'       → take orders, handheld POS only
  'kitchen'      → KDS only, cannot see financials
  'delivery'     → delivery dispatch view only
  'report_only'  → read-only: reports and dashboard

  PERMISSION CHECK pattern (in every API):
  1. Extract JWT → get user_id + role
  2. Verify staff.business_id matches requested business_id
  3. For location-scoped requests: verify staff_locations includes location_id
  4. For financial data: verify role IN ('owner', 'admin', 'manager')
*/

CREATE TABLE permissions (
  role      TEXT PRIMARY KEY,
  can_void  BOOLEAN, can_comp   BOOLEAN, can_discount   BOOLEAN,
  can_refund BOOLEAN, can_close_day BOOLEAN, can_manage_staff BOOLEAN,
  can_view_reports BOOLEAN, can_view_costs BOOLEAN, can_manage_menu BOOLEAN,
  can_manage_inventory BOOLEAN, can_manage_settings BOOLEAN
);

INSERT INTO permissions VALUES
--  role          void   comp   disc   refund close_day mgmt_staff rpts  costs  menu   inv    settings
 ('owner',        TRUE,  TRUE,  TRUE,  TRUE,  TRUE,     TRUE,      TRUE, TRUE,  TRUE,  TRUE,  TRUE),
 ('admin',        TRUE,  TRUE,  TRUE,  TRUE,  TRUE,     TRUE,      TRUE, TRUE,  TRUE,  TRUE,  TRUE),
 ('manager',      TRUE,  TRUE,  TRUE,  TRUE,  TRUE,     FALSE,     TRUE, TRUE,  TRUE,  TRUE,  FALSE),
 ('supervisor',   TRUE,  TRUE,  TRUE,  FALSE, FALSE,    FALSE,     TRUE, FALSE, FALSE, FALSE, FALSE),
 ('cashier',      FALSE, FALSE, FALSE, FALSE, FALSE,    FALSE,     FALSE,FALSE, FALSE, FALSE, FALSE),
 ('server',       FALSE, FALSE, FALSE, FALSE, FALSE,    FALSE,     FALSE,FALSE, FALSE, FALSE, FALSE),
 ('kitchen',      FALSE, FALSE, FALSE, FALSE, FALSE,    FALSE,     FALSE,FALSE, FALSE, FALSE, FALSE),
 ('report_only',  FALSE, FALSE, FALSE, FALSE, FALSE,    FALSE,     TRUE, TRUE,  FALSE, FALSE, FALSE);
```

---

## Registration Flow — Simplified to 3 Steps

The biggest failure in global POS: too many steps before the merchant can start selling. Toast takes 45 minutes to set up. Square takes 5 minutes but is frustrating. Our target: **meaningful progress in 60 seconds, fully operational in 10 minutes.**

### Step 1 of 3 — Who Are You?
```
┌─────────────────────────────────────────┐
│  Welcome to [POS Name]                  │
│                                         │
│  Full name  [________________]          │
│  Phone      [+254 ___________]          │
│                                         │
│  ── or continue with ──                 │
│  [Google]  [Apple]                      │
│                                         │
│  → Phone OTP sent instantly             │
│    No password needed                   │
└─────────────────────────────────────────┘
```

### Step 2 of 3 — Your First Business
```
┌─────────────────────────────────────────┐
│  Set up your first business             │
│                                         │
│  Business name  [________________]      │
│                                         │
│  What kind of business?                 │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │🍽️ Food & │ │🛍️ Retail │ │💈 Salon │ │
│  │  Drink   │ │   Shop   │ │   Spa   │ │
│  └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │💊 Pharma │ │⛽ Fuel   │ │ Other   │ │
│  └──────────┘ └──────────┘ └─────────┘ │
│                                         │
│  Country  [Kenya ▼]  Currency [KES ▼]   │
└─────────────────────────────────────────┘
```

### Step 3 of 3 — First Branch
```
┌─────────────────────────────────────────┐
│  Where is your first branch?            │
│                                         │
│  Branch name   [Main Branch]            │
│  (e.g., "Westlands" or "Main Branch")   │
│                                         │
│  M-Pesa Till # [Optional ___________]   │
│                                         │
│  ✓ That's it! You can add more later    │
│                                         │
│         [ Start selling → ]             │
└─────────────────────────────────────────┘
```

**After step 3**: User is in the POS immediately. No payment required to start (free tier). Add products by scanning a barcode or tapping "Add Item." First sale possible in under 2 minutes.

---

## Adding a Second Business (The Unique Feature)

From the owner dashboard, a clear "Add Business" button. Same 3-step flow. Second business appears in a switcher:

```
┌──────────────────────────────────┐
│  ≡   [Mama's Kitchen ▼]    🔔 👤 │
│      ─────────────────           │
│      ✓ Mama's Kitchen            │
│        Glam Salon                │
│        Ngong Minimart            │
│        + Add new business        │
└──────────────────────────────────┘
```

---

## Adding a Branch

Inside a business → Settings → Branches → Add Branch. Same quick form:
- Branch name
- Location/address
- Payment methods (which M-Pesa tills)
- Which staff work here

Branch is live immediately. Menu and products are inherited from the business — zero re-entry.

---

## Staff Invitation Flow

No user accounts needed to invite staff. Owner enters staff member's phone number + role. System sends WhatsApp:

```
"[Owner Name] has invited you to join [Business Name] on [POS Name].
Your role: Cashier at Westlands Branch.
Your 4-digit PIN: 7823.
Download the app: [link]
Or tap to get started on web: [link]"
```

Staff logs in with their phone number + OTP. PIN is used at the POS terminal (no need to log in/out between staff members — just PIN switch).

---

## Multi-Business Analytics (The Killer Feature)

The owner dashboard shows all businesses at once:

```
┌─────────────────────────────────────────────────┐
│ 📊 Today Across All Businesses       Jun 24      │
├──────────────┬──────────────┬───────────────────┤
│ Mama's Kitchen│  Glam Salon  │  Ngong Minimart   │
│  KSh 42,300  │  KSh 18,500  │   KSh 31,200      │
│  ↑ 12%       │  ↓ 3%        │   ↑ 8%            │
├──────────────┴──────────────┴───────────────────┤
│ Combined today:  KSh 92,000  ↑ 8% vs yesterday  │
│ Combined MTD:   KSh 1.84M                        │
└─────────────────────────────────────────────────┘
```

Tap any business → drill into it. Switch business with the top bar dropdown.

---

## Row-Level Security (Data Isolation)

Every database query is scoped. No merchant ever sees another merchant's data.

```sql
-- PostgreSQL Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_business_isolation ON orders
  USING (
    business_id IN (
      SELECT b.id FROM businesses b
      JOIN staff s ON s.business_id = b.id
      WHERE s.user_id = current_setting('app.current_user_id')::UUID
      UNION
      SELECT b.id FROM businesses b
      WHERE b.owner_id = current_setting('app.current_user_id')::UUID
    )
  );
-- Applied to every table. No query can leak cross-tenant data.
```

```typescript
// API middleware: inject user context before every query
async function tenantMiddleware(req, res, next) {
  const { userId, businessId, locationId, role } = req.user; // from JWT

  // Set Postgres session variable for RLS
  await db.query(`SET LOCAL app.current_user_id = '${userId}'`);
  await db.query(`SET LOCAL app.current_business_id = '${businessId}'`);

  // Verify user has access to the requested business
  const hasAccess = await verifyBusinessAccess(userId, businessId);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  next();
}
```

---

## Billing Model (Per Business, Not Per User)

```
User has 3 businesses:
- Mama's Kitchen: Pro plan ($38/month)
- Glam Salon: Business plan ($15/month)
- Ngong Minimart: Starter (free)

One invoice. One payment. Breakdown shown per business.
```

This is how it should work. Not one account per business with separate logins. Not confusing shared billing. One bill, clear breakdown.

---

## API Structure (Multi-Tenant Aware)

Every API endpoint encodes the business context:

```
GET  /api/businesses                     → list my businesses
GET  /api/businesses/:id                 → one business details
GET  /api/businesses/:id/locations       → branches of that business
GET  /api/businesses/:id/analytics       → business-level analytics
GET  /api/locations/:id/orders           → orders at a branch
GET  /api/locations/:id/inventory        → stock at a branch
POST /api/locations/:id/orders           → create order at a branch

# Cross-business (owner only)
GET  /api/overview                       → all businesses summary
GET  /api/overview/analytics?period=mtd  → combined analytics
```

No ambiguity. The business and location are always in the URL — not inferred from session.
