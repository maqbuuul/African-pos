# Frontend Surfaces — Hospitality OS

## Scope

Every app a human touches, who it's for, and the exact screen-to-screen
flow it needs. Backend for the restaurant MVP (P0–P14) is built and
tested; every app below is what still has to exist before anyone outside
this codebase can use it. This is the surfaces-and-build-order layer —
component library, design tokens, navigation patterns, and accessibility
rules that these apps are built *from* live in
[docs/architecture/frontend-design-system.md](./architecture/frontend-design-system.md),
not restated here.

## 1. Role → Surface Matrix

One row per person who will open one of these apps. Decided after
checking how Toast, Square, Lightspeed, Clover, and Odoo actually split
their platforms — see §3 for the research-backed decisions.

| Role | App | Platform | Status |
|---|---|---|---|
| Waiter | `pos-mobile` | React Native · phone/tablet | No UI |
| Cashier | `pos-mobile` | React Native · phone/tablet | No UI |
| Host | `pos-mobile` | React Native · phone/tablet | No UI |
| Waiter · Cashier · Host (browser mirror) | ~~`pos-web`~~ | React + Vite · browser | Rejected |
| Manager (on the go) | `insights-mobile` *(proposed)* | React Native · phone | Recommended |
| Owner (on the go) | `insights-mobile` *(proposed)* | React Native · phone | Recommended |
| Chef · Bar · Expediter | `kds-web` | React + Vite · tablet landscape | Monolith |
| Branch Manager · Supervisor · Stock Controller · Accountant · Auditor | `manager-web` | React + Vite · desktop | Shell |
| Owner · Regional Manager | `owner-web` | React + Vite · desktop | Shell |
| Support Agent (platform team) | `admin-web` | React + Vite · desktop | Shell |
| Dine-in / online customer | `customer-web` | React + Vite · phone | Monolith |
| Public visitor | `marketing-web` | Astro · desktop/phone | Placeholder |
| Third-party developer | `developer-portal` | React + Vite | Deferred · P19 |
| Cashier (PC counter) | `desktop-pos` | Tauri | Deferred |

**Status key:** *No UI* — zero screens built. *Shell* — nav skeleton only,
placeholder buttons. *Monolith* — functional but one giant file, needs
component extraction. *Placeholder* — content-only stub. *Deferred* —
intentionally not started, later phase. *Rejected* — considered and
ruled out. *Recommended* — not yet started, proposed addition.

## 2. Foundation — must exist first

Every app in §4 is built out of these two packages. Neither has a single
component yet.

**`packages/ui`** — shadcn/ui + Tailwind. Zero components today. Critical
tier — the pieces every other app is waiting on: `PINPad`, `FloorPlan`,
`ProductGrid`, `TicketCard`, `MetricTile`, `ApprovalQueue`, `Skeleton`,
`ConnectivityIndicator`, `StatusBadge`. Rules: 44px+ touch targets, color
+ label never color alone, role-agnostic primitives. Full component/token
spec lives in
[frontend-design-system.md](./architecture/frontend-design-system.md).

**`packages/api-client`** — typed fetch wrapper. Zero generated clients
today — every app currently would hand-write untyped fetch calls with no
auth-header injection and no shared error handling. Needs: auth
injection, envelope parsing, typed error taxonomy (per
[api-specification.md](./architecture/api-specification.md)).

## 3. Decided, after checking how Toast / Square / Lightspeed / Clover / Odoo do it

### Rejected — `pos-web` as a full mirror of `pos-mobile`

Checked five platforms. Toast, Square, Lightspeed, and Clover each pick
**one** surface for order-taking — always native, always where offline
mode and hardware (printer, card reader, barcode scanner) live. Nobody
runs the same frontline workflow as two parallel apps. Odoo is the one
full exception, and it goes the *other* way entirely — no native app at
all, the whole POS is a browser PWA, hardware reached through a network
proxy box instead of native OS calls. Nobody splits the difference the
way `pos-web` did.

**`pos-mobile` stays the one frontline surface** for Waiter, Cashier, and
Host — matches all four leaders, and matches ADR-0001's own reasoning for
choosing React Native bare in the first place (native modules for POS
peripherals). A parallel browser mirror means two codebases forever for
one job, for a use case (no-install backup terminal) none of the five
platforms researched thought was worth it.

### Recommended — `insights-mobile`, a companion phone app for Manager + Owner

The pattern that **did** repeat, independently, across all four leaders:
a lightweight phone app, separate from the web dashboard, for checking on
the business away from a desk — Toast Now, the Square Dashboard app,
Lightspeed Live, Clover Go. `manager-web` and `owner-web` currently have
no mobile companion at all. That's the real, evidence-backed gap.

Read-mostly, one shared app for both roles (scoped by permission, same as
the web apps): today's revenue, the approvals queue, staff on duty,
low-stock alerts. Not a shrunk-down `manager-web` — a glance, not a
workstation.

## 4. Every app, in detail

### `pos-mobile` — No UI

- **Roles:** Waiter · Cashier · Host
- **Platform:** React Native, phone/tablet
- **Flow:** PIN login → Floor plan → Table detail → Order entry → Cart
  review → Send to kitchen → Bill/payment → Tips → Receipt
- Cashier mode swaps the floor plan for a product-grid counter view; host
  mode swaps order entry for reservations/waitlist/seating. Same shell,
  different nav — **this is the #1 gap**: the API is fully built and this
  app still only shows sync status.

### ~~`pos-web`~~ — Rejected

Would have mirrored `pos-mobile`'s Waiter/Cashier/Host flow in a browser.
Rejected after research — see §3.

### `insights-mobile` *(proposed)* — Recommended

- **Roles:** Manager · Owner (on the go)
- **Platform:** React Native, phone
- **Flow:** PIN/login → Today's revenue → Approvals queue → Staff on duty
  → Low-stock alerts → Push notification → detail
- Read-mostly companion to `manager-web`/`owner-web`, not a shrunk-down
  clone of either — matches Toast Now, the Square Dashboard app,
  Lightspeed Live, and Clover Go, which all exist as separate, lightweight
  "check on the business" apps rather than a responsive version of the
  full back office.

### `kds-web` — Monolith

- **Roles:** Chef · Bar staff · Expediter
- **Platform:** React + Vite, tablet landscape
- **Flow:** Station queue → Ticket detail → Accept/start/bump →
  Recall/ack void → Expo view
- Already functional (971 lines, one file). Needs component extraction
  into `packages/ui`, not new screens. Wet-hands-friendly: large targets,
  allergy/rush badges carry a label, not just a color.

### `manager-web` — Shell

- **Roles:** Manager · Supervisor · Stock · Accounts · Audit
- **Platform:** React + Vite, desktop
- **Flow:** Dashboard → Approvals queue → Shift mgmt → Staff → Inventory
  → Reports → Audit log
- 53 lines, `alert()` buttons today. Backend 100% ready. Home screen is
  the live ops dashboard, not a generic landing page — approvals sit one
  click away since they're the most time-sensitive queue in the building.

### `owner-web` — Shell

- **Roles:** Owner · Regional Manager
- **Platform:** React + Vite, desktop
- **Flow:** Exec dashboard → Branch comparison → P&L → Customer intel →
  Forecasts → AI briefings → Billing
- 53 lines, dead links. Reports + CRM backends are done. One reserved
  type size for the single figure that matters most on any given screen
  — the "One Number" — so a glance answers the question.

### `admin-web` — Shell

- **Roles:** Support Agent (platform team)
- **Platform:** React + Vite, desktop
- **Flow:** Tenant list → Tenant detail → Device status → Sync health →
  Integration logs → Feature flags
- 64 lines, hardcoded stats. This is also the natural home for the
  org/business module-entitlement toggles from the multi-tenant
  discussion, once that layer exists.

### `customer-web` — Monolith

- **Roles:** Dine-in (QR) · online customer
- **Platform:** React + Vite, phone portrait
- **Flow:** QR scan → Menu → Cart → Submit → Live status → Request waiter
  → Pay → Feedback
- 797 lines, one file, no routing despite react-router being installed.
  Hardest performance budget in the whole system — under 3s to usable,
  under 200ms search — opened on a stranger's phone over patchy 3G with
  zero patience.

### `marketing-web` — Placeholder

- **Roles:** Public visitor · prospect
- **Platform:** Astro, desktop + phone
- Two placeholder pages. Not a workflow surface — content only. The one
  place in the system SSR actually earns its keep, since it's the one
  surface search engines need to crawl.

### `developer-portal` — Deferred · P19

- **Roles:** Third-party developer
- **Platform:** React + Vite
- App registration, API docs, OAuth, webhooks, marketplace listing.
  Correctly last — nobody integrates against this API before real
  restaurants are running on it.

### `desktop-pos` — Deferred

- **Roles:** Cashier (PC counter)
- **Platform:** Tauri
- Mirrors `pos-mobile`'s counter flow for a PC-based till. Revisit once
  the mobile counter mode is proven in a real restaurant, not before.

## 5. Build order

Dependency order, not priority order — everything under Foundation
blocks everything below it.

| # | Stream | Build | Depends on |
|---|---|---|---|
| 1 | Foundation | `packages/ui` | — |
| 2 | Foundation | `packages/api-client` | — |
| 3 | FOH | `pos-mobile` | 1, 2 |
| 4 | Management | `manager-web` | 1, 2 |
| 5 | Executive | `owner-web` | 1, 2 |
| 5b | Executive | `insights-mobile` *(recommended)* | 1, 2, 4, 5 data |
| 6 | Refactor | `customer-web` | 1, 2 |
| 7 | Refactor | `kds-web` | 1 |
| 8 | Admin | `admin-web` | 1, 2 |
| 9 | Marketing | `marketing-web` | — (parallel-safe) |

## 6. Workflow-efficiency rules — apply to all of the above

Not waiter-specific — every app above is held to the same rules.

- **One tap to the most common action, per role.** Each app's home screen
  *is* that role's most common action — not a generic dashboard everyone
  has to navigate away from.
- **Progressive disclosure.** Rare or destructive actions sit one level
  deeper than common ones — voiding a served item lives on order detail,
  not on the primary order-entry grid.
- **Color is never the only signal.** Every status color also carries a
  label or icon — legible in bright kitchen light, usable by color-blind
  staff.
- **44px+ touch targets** on every POS/KDS/mobile surface — frontline
  usability and accessibility align here, not a tradeoff.
- **Errors describe the fix, never the failure.** Never "Error 422" —
  "That phone number doesn't look right — check the digits and try
  again."
- **Empty states name the next action.** Never bare "No data" — "No
  orders yet — orders will appear here once you start selling."

---

*pos-web rejected, insights-mobile recommended — decided against
Toast/Square/Lightspeed/Clover/Odoo research (§3).*
