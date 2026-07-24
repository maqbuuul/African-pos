# Frontend UI/UX Plan — African Hospitality OS

## 1. User Types & Their Surfaces

### FRONT OF HOUSE (Customer-Facing)

| User | App | Platform | Screens | Design Philosophy |
|---|---|---|---|---|
| **Waiter/Server** | `pos-mobile` | React Native, Tablet | PIN Login (big keypad) → Floor Plan (color-coded table grid) → Table Detail (guest count, timer) → Order Entry (category tabs, product grid, modifiers, notes, seat assignment) → Cart Review → Send to Kitchen → Order Status → Bill/Payment (split by item/seat/evenly, M-Pesa, cash, card) → Tips → Receipt | **Clean, minimal, professional.** Big touch targets (44px+). One-handed operation. Table colors: green=available, yellow=seated, red=ordered, blue=eating, gray=cleaning. Big PIN buttons. Fast workflow — fewest taps to common action. |
| **Cashier** | `pos-mobile` | React Native, Tablet | PIN Login → Counter Mode (product search bar, category grid with thumbnails, cart) → Checkout → Payment (cash calculator with denominations, M-Pesa STK push, card terminal) → Receipt | Same app, different nav. Large thumbnail buttons. Barcode scanner support. |
| **Host** | `pos-mobile` | React Native, Tablet | Floor Plan (all tables) → Reservations List → Waitlist → Walk-in Seating → Customer Lookup | Read-heavy. Quick seat assignments. |
| **Customer (QR)** | `customer-web` | React + Vite, Phone-first | QR Scan → Table Session → Menu (categories, products with photos, local names) → Cart → Submit → Order Status (live: received → in kitchen → ready → served) → Request Waiter → Pay (M-Pesa) → Feedback/Rating | Performance budget: <3s to usable, <200ms search. Offline cart. |
| **Customer (Online)** | `customer-web` | React + Vite, Phone-first | Location/Menu → Cart → Checkout (delivery/pickup) → Tracking → History | Future — same order engine. |
| **Kiosk Customer** | `kiosk-web` (future) | React + Vite, Touch | Large-format menu → AI upsell → Gamified loyalty → Payment (cash/change, card, M-Pesa) | Deferred per BUILD_WORKFLOW. |

### BACK OF HOUSE

| User | App | Platform | Screens | Design Notes |
|---|---|---|---|---|
| **Chef/Kitchen Staff** | `kds-web` | React + Vite, Tablet (landscape) | Station Queue (ticket cards, progress bars, timers, allergy badges, rush/VIP flags) → Ticket Detail (modifiers, notes, plating photos, seat/course) → Item Actions (Accept, Start, Bump, Recall, Ack Void) → Expo View (multi-station per order) → 86 Item | **Already built** (971 lines, monolithic). Wet-hands friendly. Large touch targets. Needs component extraction. |
| **Bar Staff** | `kds-web` | React + Vite, Tablet | Bar Station Queue → Pour Cost (poured vs theoretical) → Drink Recipe Display → Tab Management → Batch Close Tabs | Same KDS, bar-specific tabs. |
| **Expediter** | `kds-web` | React + Vite, Large Screen | Expo View (all stations/orders) → Rush/VIP alerts → Cross-station delay alerts → Bump whole order | Large display at the pass. |

### MANAGEMENT

| User | App | Platform | Screens | Notes |
|---|---|---|---|---|
| **Branch Manager** | `manager-web` | React + Vite, Desktop | Dashboard (live revenue, open orders, staff on duty, kitchen delays, stock alerts) → Approvals Queue (voids, discounts, refunds, adjustments → approve/reject with reason) → Shift Management (open/close, live P&L, denom count, reconciliation) → Staff (attendance, clock-in/out, deactivate) → Inventory (stock, POs, counts, adjustments, wastage) → Reports (sales, payments, voids, discounts, shifts) → Audit Log (search, filter, export) | **Shell only (53 lines).** Backend 100% ready. |
| **Supervisor** | `manager-web` | React + Vite, Desktop | Live service view, queue status, minor discount approvals, escalation. | Subset of manager screens. |
| **Stock Controller** | `manager-web` | React + Vite, Desktop | Inventory dashboard, stock levels, POs, goods receiving, counts, transfers, suppliers. | Subset of manager inventory. |
| **Accountant** | `manager-web` | React + Vite, Desktop | Revenue reports, payment reconciliation, tax summary, P&L, cash flow, expenses. | Subset of manager reports. |
| **Auditor** | `manager-web` | React + Vite, Desktop | Audit log search/export, permission changes, voids/discounts by staff, cash variances, login activity, suspicious flags. | Read-only. |

### EXECUTIVE

| User | App | Platform | Screens | Notes |
|---|---|---|---|---|
| **Owner** | `owner-web` | React + Vite, Desktop | Executive Dashboard (live revenue, profit, alerts, forecasts, recommendations, One Number) → Branch Comparison (side-by-side, peer benchmark) → P&L (daily/monthly, gross margin, COGS) → Customer Intelligence (retention, LTV, churn, top customers) → Forecasts (revenue, demand trends) → AI Briefings (daily report, anomalies, recommendations) → Billing (subscription, usage) → Settings (permissions, roles, integrations) | **Shell only (53 lines).** Reports + CRM backends complete. |
| **Regional Manager** | `owner-web` | React + Vite, Desktop | Multi-branch ranking, exceptions dashboard, inter-branch stock transfer, manager review. | Subset + branching views. |

### ADMIN / SUPPORT

| User | App | Platform | Screens | Notes |
|---|---|---|---|---|
| **Support Agent** | `admin-web` | React + Vite, Desktop | Tenant list/search → Tenant detail (org, location, users, devices, subscription) → Device Status → Sync Health → Integration Logs → Feature Flags → Manual Retry for failed jobs → eTIMS submission status | **64-line shell.** Hardcoded stats. |

### DEFERRED (P19+)

| App | User | Notes |
|---|---|---|
| `desktop-pos` (Tauri) | Cashier (PC-based) | Deferred until mobile POS stabilizes. |
| `developer-portal` (React + Vite) | Third-party developers | P19 phase: app registration, API docs, OAuth, webhooks, marketplace. |
| `marketing-web` (Astro) | Public visitors | Marketing site, docs, pricing. Currently 2 placeholder pages. |

---

## 2. Design System — `packages/ui`

Every component needed, organized by priority. Built on **shadcn/ui + Tailwind CSS**.

### Critical (block frontend builds)

| Component | Used By | Description |
|---|---|---|
| `PINPad` | pos-mobile, kds-web, manager-web | Large-button numeric keypad, 6-digit PIN entry, big backspace, big enter. Clean, centered. |
| `ProductGrid` | pos-mobile, customer-web | Touch-friendly item grid with category tabs, images, prices, availability badges. |
| `FloorPlan` | pos-mobile, manager-web | Interactive table layout — drag/pan, tap table, color-coded status, table labels. |
| `TableCard` | pos-mobile, manager-web | Single table indicator: shape, number, status color, guest count, timer, waiter name. |
| `TicketCard` | kds-web | KDS ticket: item list, progress bar, timer, allergy badges, rush/VIP flag, station color. |
| `MetricTile` | manager-web, owner-web, admin-web | KPI display: label, value, trend arrow, sparkline, color semantic. One Number Principle. |
| `ApprovalQueue` | manager-web | Pending approval list: action type, requester, amount, timestamp, approve/reject buttons with reason input. |
| `Skeleton` | All apps | Loading placeholder — shimmer animation per component shape. |
| `ConnectivityIndicator` | All apps | 3-state banner: Online (hidden/green dot), Syncing (amber, spinner), Offline (red, "X min remaining"). |

### High Priority

| Component | Used By |
|---|---|
| `DataTable` (sort, filter, paginate, export) | manager-web, owner-web, admin-web |
| `ShiftDrawer` (cash denomination count) | pos-mobile, manager-web |
| `PaymentSplit` (by item / by seat / evenly UI) | pos-mobile |
| `CartReview` (order summary with edit, notes, seat labels) | pos-mobile, customer-web |
| `ConfirmDialog` (destructive action with reason textarea) | All apps |
| `StatusBadge` (color + label for all entity states) | All apps |
| `EmptyState` (contextual "no data" with next-action prompt) | All apps |
| `SearchBar` (with debounce, results dropdown) | pos-mobile, manager-web, customer-web |
| `MenuCategoryTabs` (horizontal scrollable category row) | pos-mobile, customer-web |

### Medium Priority

| Component | Used By |
|---|---|
| `NavigationSidebar` | manager-web, owner-web, admin-web |
| `ActionButton` (primary/secondary/danger with icon) | All apps |
| `Toast` (success/error/info notifications) | All apps |
| `Modal` (overlay dialog) | All apps |
| `DateRangePicker` | manager-web, owner-web, admin-web |
| `FileUpload` (product photos, invoice photos) | manager-web |
| `CustomerCard` (profile summary with loyalty, credit, history) | manager-web, pos-mobile |
| `KDSExpoView` (multi-station per order, combined readiness) | kds-web |
| `NoteBadge` (allergy, kitchen note on tickets) | kds-web |

---

## 3. Design Tokens

### Color — Fixed Semantics (never decorative)

| Token | Usage | Hex |
|---|---|---|
| `color.status.healthy` | Online, synced, paid, available | Green |
| `color.status.needsAttention` | Low stock, pending approval, syncing, bill requested | Amber |
| `color.status.critical` | Offline, stockout, voided, refunded, error | Red |
| `color.status.active` | In progress, seated, ordered | Blue |
| `color.insight.ai` | AI recommendation, forecast | Purple |
| `color.neutral` | Backgrounds, text, borders | Gray scale |

### Density Presets

- **POS/KDS (touch-first):** Larger spacing, 44px+ minimum touch targets, larger font for key numbers
- **Desktop (mouse/keyboard):** Standard density, more information per view

### Typography

- One reserved size for the "One Number" — the single most important metric on any dashboard
- POS/KDS: larger base font for readability at arm's length

---

## 4. Navigation Architecture

### Per-App Navigation

| App | Navigation Pattern | Home Screen |
|---|---|---|
| `pos-mobile` | Tab bar (Floor, Orders, Pay, More) + Modal (order entry) | Floor Plan (waiter) or Product Grid (cashier) |
| `customer-web` | Single page, scroll-based sections | Menu by category |
| `kds-web` | Tab bar (Station, Expo, Analytics, Print) | Station queue |
| `manager-web` | Sidebar navigation | Daily operations dashboard |
| `owner-web` | Sidebar navigation | Executive dashboard |
| `admin-web` | Sidebar navigation | Tenant list |

### Rules

- **One tap to most common action per role** — home screen is *that role's* primary action, not a generic dashboard
- **Progressive disclosure** — rare/advanced actions one level deeper (e.g., void served item is on order detail, not the primary grid)
- **Location switcher** — identical component across every app that needs it (shared `packages/ui` component)

---

## 5. Responsiveness Targets

| App | Primary | Secondary |
|---|---|---|
| `pos-mobile` | Phone + Tablet (RN) | — |
| `kds-web` | Tablet landscape | Desktop |
| `manager-web` | Desktop | Tablet |
| `owner-web` | Desktop | Tablet |
| `admin-web` | Desktop | Tablet |
| `customer-web` | Phone portrait | Tablet |
| `marketing-web` | Desktop + Phone | — |

---

## 6. Error & Empty States Rules

- **Error messages describe the fix, not the failure.** Never "Error 422" — always "That phone number doesn't look right — check the digits and try again."
- **Empty states name the next action.** Never bare "No data" — always "No orders yet — orders will appear here once you start selling."
- **Color is never the only signal.** Every status indicator also carries a label or icon (color-blind safe, legible in bright kitchen light).

---

## 7. Build Order

| Order | Stream | Description | Dependencies |
|---|---|---|---|
| **1** | Foundation | `packages/ui` design system (tokens, core components: Button, Input, Card, Modal, Skeleton, ConnectivityIndicator, StatusBadge, EmptyState) | None |
| **2** | Foundation | `packages/api-client` typed fetch wrapper (auth injection, envelope parsing, error types) | None |
| **3** | FOH | `pos-mobile` waiter POS: PINPad, FloorPlan, ProductGrid, CartReview, Payment, Tips, Receipt | 1, 2 |
| **4** | Management | `manager-web`: Dashboard, Approvals, Shifts, Staff, Inventory, Reports, Audit | 1, 2 |
| **5** | Executive | `owner-web`: Executive Dashboard, Branch Comparison, P&L, Customer Intelligence | 1, 2 |
| **6** | Refactor | `customer-web`: component extraction, routing, state management | 1, 2 |
| **7** | Refactor | `kds-web`: component extraction, Zustand integration | 1 |
| **8** | Admin | `admin-web`: Tenant management, device/sync health dashboard | 1, 2 |
| **9** | Marketing | `marketing-web`: real content pages (can run in parallel with 3-8) | None |

---

## 8. Performance Budgets (from frontend-design-system.md)

| Metric | Target |
|---|---|
| App launch to usable | <3s |
| Item search | <200ms |
| Add item to cart | <100ms |
| Payment screen ready | <500ms |
| Receipt generation | <1s |
| Full resync after 1hr offline | <10s |