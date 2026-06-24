# BI Dashboard Design — Minimal, Mobile-First, Actionable

> The dashboard is not a data dump. It is a morning briefing. Every view answers: "What do I need to know, and what should I do about it?"

---

## Design Philosophy

### The 3 Questions Every Screen Must Answer
Before any screen is designed, ask:
1. **Who is looking at this?** (owner at 7am, manager mid-service, cashier at POS)
2. **What decision does this help them make?** (staff today, reorder now, promote item)
3. **What is the one most important thing on this screen?** (not 8 things — one)

### Anti-Patterns to Avoid (What Global Leaders Get Wrong)
- ❌ Dashboard with 12 charts that all need scrolling
- ❌ Metrics without context ("Sales: KSh 42,300" — is that good or bad?)
- ❌ Desktop-first layouts that break on mobile
- ❌ Real-time data refresh that flickers and distracts during service
- ❌ Settings buried 4 levels deep
- ❌ Different UI patterns for every screen

---

## User Roles & Their Screens

```
OWNER          → Business Overview, Cross-Business Compare, P&L, Trends
ADMIN          → Same as owner for their business
MANAGER        → Daily Operations, Staff, Stock, End-of-Day
CASHIER/SERVER → POS Terminal only (no dashboard)
REPORT-ONLY    → Read-only dashboard, no operational controls
```

---

## Screen Map — Every View the Dashboard Has

```
HOME (Live)
 ├── Today at a Glance
 ├── Active Orders (restaurant)
 └── Stock Alerts

SALES
 ├── Overview (today / week / month / custom)
 ├── By Hour (heatmap)
 ├── By Item (top sellers, menu engineering)
 └── By Staff

INVENTORY / STOCK
 ├── Stock Levels (with ML days-remaining)
 ├── Low Stock / Reorder Queue
 └── Movement History

CUSTOMERS
 ├── Customer List
 ├── Loyalty Overview
 └── Win-Back Queue

STAFF
 ├── Shift Schedule
 ├── Time & Attendance
 └── Performance

FINANCES
 ├── Revenue vs. Cost
 ├── Payments Breakdown
 └── Taxes & Compliance

REPORTS (Automated)
 ├── Daily Summary
 ├── Weekly Intelligence
 └── Custom Date Range

SETTINGS
 ├── Business & Branches
 ├── Menu / Products
 ├── Staff & Roles
 ├── Payments
 └── Integrations
```

That is the complete map. No more. Every feature request that doesn't fit here gets challenged.

---

## Screen Designs (ASCII Wireframes)

### 1. HOME — Today at a Glance

The most-viewed screen. Opens when manager arrives in the morning.

```
┌─────────────────────────────────────────────┐
│ ≡  Mama's Kitchen · Westlands    🔔 06:58am │
├─────────────────────────────────────────────┤
│                                             │
│  Good morning, James 👋                     │
│  Tuesday looks like a busy day              │
│                                             │
│  ┌─────────────┬─────────────┐              │
│  │   KSh 0     │  0 orders   │              │
│  │  Today so far  │  Open now  │             │
│  └─────────────┴─────────────┘              │
│                                             │
│  ── Yesterday ──────────────────────────    │
│  KSh 42,300    ↑12% vs Mon last week        │
│                                             │
│  ── Forecast for today ─────────────────    │
│  ~KSh 46,000 expected  (payday Tuesday)     │
│  Peak hours: 12pm–2pm, 7pm–9pm             │
│                                             │
│  ── Needs attention ────────────────────    │
│  🔴 Rice (5kg) — runs out today             │
│  🟡 Cooking oil — 3 days left               │
│  → [View all stock alerts]                  │
│                                             │
│  ── Staff today ─────────────────────────   │
│  3 scheduled · 2 clocked in · 1 late        │
│  → [View schedule]                          │
│                                             │
└─────────────────────────────────────────────┘
```

**Rules for this screen:**
- Maximum 3 stock alerts shown (link to see all)
- Revenue comparison always shown in context (vs. same day last week)
- Forecast with a reason ("payday Tuesday") — not just a number
- Staff status is a summary only, tap to expand

---

### 2. SALES OVERVIEW

```
┌─────────────────────────────────────────────┐
│ ← Sales                          Export ↗   │
├──────┬──────┬──────┬──────────────────────┤
│ Today│ Week │ Month│  Custom range         │
├──────┴──────┴──────┴──────────────────────┤
│                                             │
│  Revenue         KSh 42,300                 │
│                  ↑ 12% vs last Tuesday      │
│                                             │
│  Orders          148    Avg: KSh 286        │
│  Covers          312    Table turn: 41 min  │
│                                             │
│  ── Revenue trend (last 7 days) ─────────   │
│                                             │
│  55K ┤                         ╭╮           │
│  50K ┤                    ╭╮  ╭╯╰╮          │
│  45K ┤╭╮          ╭╮      ╯╰╮╯    ╰         │
│  40K ┤╯╰╮  ╭╮    ╭╯╰╮       │              │
│  35K ┤   ╰╮╯ ╰╮╭╯    │      │              │
│       M  T  W  T  F  S  S                  │
│                          ↑ today            │
│                                             │
│  ── By payment method ───────────────────   │
│  M-Pesa      62%   KSh 26,226              │
│  Cash        31%   KSh 13,113              │
│  Card         7%   KSh 2,961               │
│                                             │
│  ── Top items today ──────────────────────  │
│  1. Nyama Choma     KSh 8,400  (21 sold)   │
│  2. Ugali           KSh 4,200  (42 sold)   │
│  3. Pilau           KSh 3,600  (18 sold)   │
│  → [See all items]                          │
└─────────────────────────────────────────────┘
```

**Design notes:**
- Trend line uses sparkline format — fit in context, not a full chart
- Payment methods show % AND amount (% alone is meaningless for small screens)
- Top 3 items inline, tap to see all in full items view

---

### 3. HOURLY HEATMAP

This is the single most actionable chart for a restaurant or retail owner.

```
┌─────────────────────────────────────────────┐
│ ← By Hour                    This week      │
├─────────────────────────────────────────────┤
│                                             │
│     Mon  Tue  Wed  Thu  Fri  Sat  Sun       │
│ 6am  ░    ░    ░    ░    ░    ▒    ▒        │
│ 7am  ▒    ▒    ▒    ▒    ▒    ▒    ░        │
│ 8am  ▒    ▒    ▒    ▓    ▒    ░    ░        │
│ 9am  ▓    ▒    ▓    ▓    ▒    ░    ░        │
│10am  ▓    ▓    ▓    ▓    ▓    ▒    ▒        │
│11am  ▓    ▓    ▓    ▓    ▓    ▒    ▒        │
│12pm  ████ ████ ████ ████ ████ ▓    ▒        │
│ 1pm  ████ ████ ████ ████ ████ ▓    ▒        │
│ 2pm  ▓    ▓    ▓    ▓    ▓    ▒    ▒        │
│ 3pm  ▒    ▒    ▒    ▒    ▒    ░    ░        │
│ 4pm  ▒    ▒    ▒    ▒    ▒    ░    ░        │
│ 5pm  ▓    ▓    ▒    ▓    ▓    ▒    ▒        │
│ 6pm  ████ ████ ████ ████ ████ ████ ████     │
│ 7pm  ████ ████ ████ ████ ████ ████ ████     │
│ 8pm  ████ ████ ████ ████ ████ ████ ████     │
│ 9pm  ▓    ▓    ▓    ▓    ██   ████ ████     │
│10pm  ▒    ▒    ▒    ▒    ▓    ████ ██       │
│                                             │
│ Dark = high revenue.                        │
│ Your quietest slot: Mon-Fri 3-5pm           │
│ → [Create promotion for this slot]          │
└─────────────────────────────────────────────┘
```

**The action link is the key**: "Your quietest slot: Mon-Fri 3-5pm → Create promotion." The chart alone is observation. The link converts observation to action.

---

### 4. MENU ENGINEERING

```
┌─────────────────────────────────────────────┐
│ ← Menu Performance              Last 30 days│
├─────────────────────────────────────────────┤
│  Filter: [All ▼]  [Restaurant ▼]  [Dinner▼] │
├─────────────────────────────────────────────┤
│                                             │
│  ⭐ STARS — promote these                   │
│  ┌───────────────────────────────────────┐  │
│  │ Nyama Choma        Margin 68%  21/day │  │
│  │ Pilau              Margin 72%  18/day │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  🐴 PLOWHORSES — popular but low margin     │
│  ┌───────────────────────────────────────┐  │
│  │ Ugali              Margin 28%  42/day │  │
│  │ Chapati            Margin 31%  35/day │  │
│  │ → Raise price by KSh 20?  Est. +KSh   │  │
│  │   14,000/mo extra profit              │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ❓ PUZZLES — good margin, not selling      │
│  ┌───────────────────────────────────────┐  │
│  │ Grilled Tilapia    Margin 74%   3/day │  │
│  │ → Move to top of menu + photo?        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  🐕 DOGS — remove or refresh               │
│  ┌───────────────────────────────────────┐  │
│  │ Chips Masala       Margin 22%   1/day │  │
│  │ → Consider removing this item         │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

Each section has a specific action. Not just "here's your data" — "here's what to do."

---

### 5. STOCK / INVENTORY VIEW

```
┌─────────────────────────────────────────────┐
│ ← Stock                   [+ Add Item]  [⚙] │
├───────────────────────────────────────────┤
│  🔍 Search items...                         │
│  Filter: [All ▼]  [Kitchen ▼]  Sort:[Days▼] │
├─────────────────────────────────────────────┤
│                                             │
│  🔴 Needs action (2)                        │
│  ┌─────────────────────────────────────┐    │
│  │ Rice 5kg     ░░░░░░░░░░  0 days    │    │
│  │ 23 bags · 0.0 days · ORDER NOW      │    │
│  │                        [Order →]    │    │
│  ├─────────────────────────────────────┤    │
│  │ Cooking Oil  ▓░░░░░░░░░  2 days    │    │
│  │ 8 litres · 2.1 days                 │    │
│  │                        [Order →]    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  🟡 Order soon (5)                 [Show]   │
│                                             │
│  ✅ Well stocked (43)              [Show]   │
│                                             │
└─────────────────────────────────────────────┘
```

**Stock bar** uses visual depletion:
```
Full:    ██████████  "21+ days"
Good:    ███████░░░  "7-14 days"
Low:     ████░░░░░░  "3-6 days"
Critical:██░░░░░░░░  "1-2 days"
Empty:   ░░░░░░░░░░  "Out of stock"
```

Progress bar width = days remaining / 21 (capped). Color changes by threshold. Instantly scannable without reading a number.

---

### 6. STAFF PERFORMANCE

```
┌─────────────────────────────────────────────┐
│ ← Staff                  This week          │
├─────────────────────────────────────────────┤
│  [Performance]  [Schedule]  [Time & Attend] │
├─────────────────────────────────────────────┤
│                                             │
│  ── Top performers ──────────────────────   │
│                                             │
│  1. Grace N.                                │
│     Sales: KSh 84,200 · Avg: KSh 340        │
│     Tips: KSh 4,100   · Tables: 82          │
│     ████████████████████████  100%          │
│                                             │
│  2. Peter O.                                │
│     Sales: KSh 71,400 · Avg: KSh 302        │
│     Tips: KSh 3,200   · Tables: 74          │
│     ████████████████████░░░░   86%          │
│                                             │
│  3. David K.                                │
│     Sales: KSh 48,200 · Avg: KSh 241        │
│     Tips: KSh 1,900   · Tables: 62          │
│     ████████████░░░░░░░░░░░░   58%          │
│     ↑ Table turn 15% above average          │
│     → Consider a coaching conversation      │
│                                             │
│  ── Voids & Comps ───────────────────────   │
│  Total voids today: KSh 1,200  (3 items)    │
│  [See void log]                             │
└─────────────────────────────────────────────┘
```

Performance is shown as a relative index (100% = top performer this period), not just raw numbers. This makes comparison intuitive even if the team size varies.

---

### 7. CUSTOMER & LOYALTY

```
┌─────────────────────────────────────────────┐
│ ← Customers                                 │
├──────────────┬──────────────┬──────────────┤
│  2,841       │  KSh 386     │  28%         │
│  Total       │  Avg spend   │  Return rate │
├──────────────┴──────────────┴──────────────┤
│                                             │
│  ── Win-back queue (14 customers) ────────  │
│  These customers haven't visited in 30+ days│
│                                             │
│  Sarah M.        Last: 34 days ago          │
│  KSh 12,400 lifetime · Usually Fri/Sat      │
│  [Send WhatsApp]                            │
│                                             │
│  John K.         Last: 41 days ago          │
│  KSh 8,900 lifetime · Usually lunch         │
│  [Send WhatsApp]                            │
│                                             │
│  → [Send to all 14 — one tap]               │
│                                             │
│  ── Loyalty leaderboard ─────────────────   │
│  👑 Grace N.     4,200 pts  · Gold          │
│  🥈 Peter M.     3,800 pts  · Gold          │
│  🥉 Alice O.     2,100 pts  · Silver        │
│                                             │
│  🎂 3 birthdays this week                  │
│  → [Send birthday offer — one tap]          │
└─────────────────────────────────────────────┘
```

The win-back queue and birthday offers both have one-tap send. These should take 30 seconds, not 5 minutes.

---

### 8. OWNER MULTI-BUSINESS VIEW

Only visible to owners with 2+ businesses. This is the feature nobody else has.

```
┌─────────────────────────────────────────────┐
│ ≡  All Businesses                  Jun 2026 │
├─────────────────────────────────────────────┤
│  ── This month ──────────────────────────   │
│                                             │
│  🍽️  Mama's Kitchen         KSh 1,840,000   │
│      4 branches · ↑8% vs last month        │
│      🟡 2 stock alerts  🟢 Staff: on track  │
│                                             │
│  💈  Glam Salon             KSh 620,000     │
│      2 branches · ↓3% vs last month        │
│      ⚠️ Revenue down — check Jun 14-18      │
│                                             │
│  🛍️  Ngong Minimart         KSh 980,000     │
│      1 branch · ↑11% vs last month         │
│      🟡 4 stock alerts                      │
│                                             │
│  ── Combined ────────────────────────────   │
│  Total revenue:     KSh 3,440,000           │
│  vs last month:     KSh 3,180,000  ↑ 8.2%  │
│  vs last year:      KSh 2,620,000  ↑ 31%   │
│                                             │
│  ── AI Insight ──────────────────────────   │
│  💡 "Your salon revenue dropped 3% while    │
│  both other businesses grew. The dip is     │
│  concentrated Jun 14-18. Was there a        │
│  staffing change that week?"                │
└─────────────────────────────────────────────┘
```

The AI insight at the bottom is the differentiator. Owners don't have time to compare all three dashboards. The system does it for them and surfaces the anomaly.

---

## Mobile vs. Tablet vs. Desktop

### Mobile (Primary — 60%+ of usage)
- **Single column** always
- **Thumb-friendly tap targets** (minimum 44px)
- **No hover states** — everything must work with tap
- **Bottom navigation** (5 items max): Home, Sales, Stock, Staff, More
- **Swipe gestures**: swipe left on stock item to quick-reorder
- Charts: **sparklines only** (full charts only on tablet/desktop)

### Tablet (POS Terminal — 30%)
- Two-column layout
- Left: order/POS operations
- Right: summaries and alerts
- Full charts visible

### Desktop (Manager/Owner review — 10%)
- Full dashboard with all charts
- Multi-column data tables
- Keyboard shortcuts for power users

---

## The "One Number" Principle

On every screen, there is one number larger than all others. That number is the most important thing on that screen. Everything else is context for that number.

| Screen | The One Number |
|--------|---------------|
| Home today | Revenue today |
| Sales week | Revenue this week vs. last week % |
| Stock item | Days remaining |
| Staff | Top performer's revenue |
| Customer | Return rate |
| P&L | Net profit this month |

Never make the user hunt for the important number. It should be immediately obvious at a glance, even if they look at the screen for 2 seconds.

---

## Color System (Contextual, Not Decorative)

```
GREEN  → Good, above expected, trending up
         Use: sales above forecast, healthy stock, staff performing well

AMBER  → Attention needed, but not urgent
         Use: stock 4-7 days remaining, mild revenue drop, one late staff

RED    → Action required now
         Use: out of stock, revenue significantly below, void rate spike

BLUE   → Information, neutral
         Use: data points without a clear good/bad judgment

PURPLE → Milestone, achievement, loyalty tier
         Use: customer reaching gold tier, record sales day

GRAY   → Historical / comparison data
         Use: last week's bar in a chart, inactive items
```

No decorative colors. Color carries meaning — always.

---

## Loading States (Africa-Specific)

In low-bandwidth environments, loading states matter more than in developed markets.

```
Rule 1: Show skeleton screens, not spinners.
         Skeleton shows the layout before data arrives.
         Spinner shows nothing — more frustrating.

Rule 2: Cache everything that was loaded before.
         If a manager checks stock at 7am and the phone loses
         signal at 8am, the stock screen should still show
         last-known data with a "Last updated: 47 min ago" badge.

Rule 3: Critical numbers load first.
         Revenue today loads before charts.
         Charts can lazy-load.

Rule 4: Offline badge is always visible.
         ⚡ = live  |  📵 = offline (cached data)  |  🔄 = syncing
```
