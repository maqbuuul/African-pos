# PRD 03: Menu & Product Catalog

## Scope

Owns categories, products, modifiers, and pricing for what a location can
sell. Corresponds to master plan section 7 "Menu Features" and
`DATA_MODEL.md` Restaurant MVP (`menus`, `menu_categories`, `products`,
`modifier_groups`, `modifiers`). Does not own recipes/ingredient costing
(PRD 12), does not own the order-taking flow itself (PRD 05) — this
module is upstream of both: recipes reference products, orders capture a
snapshot of a product at sale time.

## Dependencies

PRD 00 (Multi-Tenancy) for `location_id` scoping. PRD 01 (Auth) for
permission checks on price/menu edits.

## User Stories

- As a **branch manager**, I need to add a product with two modifier
  groups (e.g. size, spice level) in under a minute, so menu changes
  don't require engineering help.
- As a **cashier/waiter**, I need to mark an item unavailable mid-shift
  (ran out of an ingredient) with one tap, so the POS stops offering
  something the kitchen can't make.
- As an **owner**, I need happy-hour and staff-meal pricing to apply
  automatically by time/role without a manager manually swapping prices
  twice a day.
- As an **owner reviewing history**, I need to see what a product's price
  was on any past date, because "did sales drop after the price increase"
  is a real question I need the platform to answer, not just today's
  price.

## Workflows

### Creating a product

```text
Manager opens "Add Product"
  -> Selects category (or creates one; category carries a default KDS
     station used later by PRD 06)
  -> Enters name, local-language name, description, base price + currency
  -> Attaches modifier groups (existing or new: e.g. "Spice Level" with
     options Mild/Medium/Hot, each with its own price delta)
  -> Sets tax category (references Module 18 country tax adapter)
  -> Optionally attaches photo
  -> Saves -> product becomes available immediately unless explicitly
     marked draft/unavailable
```

### Changing a price

```text
Manager edits a product's price
  -> System does NOT overwrite the current price row -- it closes the
     current price's effective_to at now() and inserts a new price row
     with effective_from = now() (see Business Rules: price history)
  -> Existing open orders keep referencing the price version active when
     each order_item was added -- a price change never retroactively
     changes an order already in progress
  -> New orders/order_items use the new price from the moment it's active
```

### Marking an item unavailable (86'ing)

```text
Any staff with orders:create permission at this location taps "86" on
a product from the POS grid or manager console
  -> Product.is_available = false immediately, propagates to:
     - POS grids (removed or shown struck-through, config-dependent)
     - QR/online ordering (PRD 10) within one sync cycle
     - KDS (any in-flight tickets for it are unaffected -- 86 blocks new
       orders, doesn't cancel ones already sent)
  -> Audit log entry written (who, when, which product)
  -> Manager can set an optional auto-restore time/date (e.g. "back
     tomorrow") or leave it manual-restore only
```

### Day-part menu switching

```text
Scheduled job evaluates location's local time against configured
day-part windows (breakfast/lunch/dinner, Ramadan/Iftar per Module 18)
  -> 5 minutes before a switch: manager device gets a pre-switch alert
     (master plan section 7) so staff aren't caught mid-service
  -> At switch time: active menu set changes; products outside the new
     day-part's menu become unavailable for new orders without being
     deleted or losing their history
```

## Screens & UI Behavior

- **Product grid** (POS): the primary selling surface — category tabs,
  product tiles (photo, name, price), unavailable items visually
  distinct, not hidden (staff need to know it exists but can't sell it,
  per master plan Product Rules). Target: tap-to-cart under 150ms
  locally (master plan section 21).
- **Menu builder** (manager-web, owner-web): category/product/modifier
  CRUD, drag-to-reorder categories and products, bulk price update,
  price-history view per product.
- **Menu engineering dashboard** (owner-web): the price-simulation slider
  and Stars/Plow-Horses/Puzzles/Dogs quadrant view described in master
  plan section 7 — reads from PRD 14 (Reports & BI), this module only
  supplies the underlying price-history and sales-linkage data it needs.
- **86 button**: available directly from the POS product grid (long-press
  or dedicated icon), not buried in a settings menu — this needs to be
  fast because it's used mid-rush.

## Permissions

| Action | branch_manager | supervisor | cashier/waiter | chef |
| --- | --- | --- | --- | --- |
| Create/edit product, price, category | Yes | No | No | No |
| Mark item unavailable/available (86) | Yes | Yes | Yes (`orders:create` implies this) | Yes |
| View price history | Yes | Yes | No | No |
| Bulk price update | Yes (owner-approved for large % changes, see below) | No | No | No |

A price change beyond a configurable percentage threshold (protects
against fat-finger errors — e.g. entering 8000 instead of 800) requires
owner approval via the approval-request flow (PRD 01), same pattern as
any other large-magnitude change.

## Business Rules

- **Prices are never overwritten, per `ENGINEERING_CHARTER.md`'s
  versioning rule.** `DATA_MODEL.md`'s `product_prices` table is the
  source of truth for price history; `products.price_amount` is only a
  cache of the currently-active `product_prices` row, never written
  directly.
- Every `order_item` stores the exact price and product name **captured
  at sale time** (master plan section 27's conflict policy: "offline
  orders preserve captured price and product name") — this is true
  online too, not just as an offline conflict rule. Historical orders are
  never affected by later price or name changes.
- Modifier groups define selection rules: min/max selections (e.g.
  "choose exactly 1" for size, "choose 0-3" for add-ons) — the POS must
  enforce these before allowing add-to-cart, not just suggest them.
- Products are never hard-deleted. Lifecycle states: `draft` → `active`
  → `seasonal` → `unavailable` (temporary) → `discontinued` → `archived`.
  A discontinued product's historical orders still resolve its name,
  price, and modifiers exactly as sold.
- Category → default KDS station mapping (master plan section 6, Module
  used by PRD 06) is set at the category level and overridable per
  product — most products don't need an override.
- Currency on a product matches its location's operating currency
  (PRD 00) — cross-currency products within one location are not
  supported; multi-currency display (Module 18) is a presentation-layer
  conversion, not a second stored price, except where dual pricing
  (cash vs. card surcharging, master plan section 7) is explicitly
  configured.

## Edge Cases & Failure States

- Two managers edit the same product's price simultaneously: last write
  wins at the price-history level (each is its own new price row with its
  own `effective_from`), but the earlier one's `effective_to` gets closed
  by whichever committed second — no silent data loss, both changes are
  visible in history even though only the latest is "current."
- A modifier option is deleted while it's referenced by open orders:
  disallow hard delete if referenced by any order within a retention
  window; force `discontinued` status instead, consistent with the
  never-delete rule.
- 86'ing a product that has active KDS tickets in flight: those tickets
  are unaffected (already-placed orders complete normally); only new
  order attempts are blocked.
- Day-part switch lands mid-open-order: an order started under the lunch
  menu keeps its already-added items; whether new items must come from
  the new day-part's menu is a location-configurable setting (some
  restaurants want a grace period, some don't).

## Data Model

`DATA_MODEL.md` Restaurant MVP: `menus`, `menu_categories`, `products`,
`product_prices`, `modifier_groups`, `modifiers`.

## Events Emitted

- `ProductCreated` / `ProductUpdated` / `ProductPriceChanged` /
  `ProductAvailabilityChanged` — consumed by: POS/KDS/QR-ordering cache
  invalidation (via PowerSync sync rules), search indexing, product
  analytics, menu engineering dashboard (PRD 14).
- `MenuDayPartSwitched` — consumed by: POS/QR ordering active-menu
  filter, manager pre-switch alert (notification module).

## API Surface

- `GET/POST /products`, `PATCH /products/:id`,
  `POST /products/:id/mark-unavailable`,
  `POST /products/:id/mark-available`
- `GET /products/:id/price-history`
- `GET/POST /categories`, `PATCH /categories/:id`
- `GET/POST /modifier-groups`, `PATCH /modifier-groups/:id`

## Offline Behavior

Fully readable offline — the product catalog (including current prices,
availability, and modifier options) is core cached reference data on
every POS device via PowerSync (ADR 0001). Marking an item unavailable
works offline (queued via operation log, PRD 11) and syncs to other
devices at that location on reconnect; until sync, other offline devices
at the same location may still show it available — a known, accepted
limitation of offline-first operation, not a bug to "fix" with a
distributed lock.

## Acceptance Criteria

- A manager can create a category, a product with two modifier groups,
  mark it unavailable, and the POS grid reflects unavailability within
  one sync cycle (matches `BUILD_WORKFLOW.md` P3 acceptance gate).
- A price change never alters the price/name shown on an already-placed
  order, verified by changing a price after placing an order and
  confirming the order's receipt still shows the original price.
- Price history for any product is queryable for any past date.

## Non-Goals

- Recipe/ingredient costing (PRD 12) — this module owns the sellable
  product and its price, not what it costs to make.
- Menu engineering's Stars/Plow-Horses/Puzzles/Dogs classification logic
  itself (PRD 14) — this module supplies the price-history and
  availability data that analysis consumes.
- Combo/bundle pricing logic beyond modifier groups (tracked as a later
  enhancement to this PRD once basic catalog ships).
