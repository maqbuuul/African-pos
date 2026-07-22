# PRD 00: Organizations & Multi-Tenancy

## Scope

Owns the tenant hierarchy every other module scopes itself against:
`organizations` → `businesses` → `locations`, plus subscription/feature
entitlement state. Corresponds to master plan Module 1 and `DATA_MODEL.md`
Shared Foundation (`organizations`, `businesses`, `locations`). Does not
own staff identity, roles, or login (PRD 01), and does not own audit
logging (PRD 02) — those consume this module's `organization_id`/
`location_id` but are specified separately.

## Dependencies

None. This is the root of the dependency graph — every other PRD assumes
`organization_id` and, where relevant, `location_id` and `business_id`
already exist and are enforced.

## User Stories

- As an **owner**, I sign up once and get one organization, so every
  business and location I add afterward is mine by construction, not by
  a setting I could get wrong.
- As an **owner** with multiple concepts (e.g. a restaurant and a
  separate café brand), I need multiple `businesses` under one
  organization, so billing and reporting can roll up while operations
  stay separate.
- As a **regional manager**, I need to see and switch between every
  location in my business, so I don't need a separate login per branch.
- As a **branch manager**, I need my access scoped to exactly my
  location, so I can't accidentally see or touch another branch's data.
- As the **platform**, I need every tenant-scoped query to be
  impossible to run without a resolved `organization_id`, so a code bug
  can't leak one tenant's data to another.

## Workflows

### Signup and first-run

```text
Owner submits signup (name, email, phone, country, business type)
  -> System creates organization (status: active, default_currency from country)
  -> System creates first business (vertical: restaurant)
  -> System creates first location (from signup address, or "Main Location" placeholder)
  -> System creates owner's user record, linked to organization
  -> System provisions default role set (owner, branch_manager, cashier, waiter, chef, ...)
  -> System assigns owner role to the signing-up user
  -> Owner is redirected to onboarding (invite staff, add products) — see master plan section 20 onboarding flow
```

Failure branches: duplicate email → reuse existing user, prompt login
instead of signup. Invalid/unsupported country → block signup with a
clear message rather than defaulting silently (currency, tax adapter, and
payment provider availability all key off country — see master plan
Module 18).

### Adding a location

```text
Owner or regional_manager opens "Add Location"
  -> Enters name, address, country, currency, timezone, phone
  -> System validates country is supported (has a tax adapter — Module 18)
  -> System creates location (status: active)
  -> System prompts: copy menu/products from an existing location, or start blank
  -> Location appears in location switcher for authorized roles
```

### Subscription and feature entitlement check

```text
Any request hits the API
  -> Tenant context middleware resolves organization_id from the auth token
  -> Middleware loads organization.status and active feature_flags
  -> If organization.status != active -> reject with billing-hold error, not a generic 403
  -> If the requested action needs a feature_flag not entitled -> reject with upgrade-required error
  -> Otherwise request proceeds, RLS enforces location/organization scoping at the query level
```

## Screens & UI Behavior

- **Location switcher** (all internal web apps, POS mobile): shows every
  location the current staff/user has a role at. Single-location owners
  never see a switcher at all — don't show UI for a decision that isn't
  a decision.
- **Organization settings** (owner-web, admin-web): name, legal name,
  country, default currency, timezone, subscription plan, feature
  entitlements (read-only for non-admin roles).
- **Location settings** (owner-web, manager-web): name, code, address,
  currency (can differ from org default for multi-country groups), phone,
  status (active/suspended).
- **Admin console** (`apps/admin-web`): tenant support view — organization
  status, subscription state, location list, device count, sync health.
  Internal-only, never exposed to tenant users.

## Permissions

| Action | owner | regional_manager | branch_manager | others |
| --- | --- | --- | --- | --- |
| Create organization | via signup only | — | — | — |
| Create business | Yes | — | — | — |
| Create/edit location | Yes | Yes (own business) | No | No |
| View all locations in org | Yes | Yes (own business) | Own location only | Own location only |
| Edit organization settings | Yes | No | No | No |
| View subscription/billing | Yes | No | No | No |

Full permission-key taxonomy lives in master plan section 22; this table
is the subset that's specific to tenancy scope, not a duplicate of the
whole matrix.

## Business Rules

- `organization_id` is the tenant boundary. Every tenant-owned table
  carries it, and it is set once at row creation and never changed —
  moving a location between organizations is not a supported operation
  (it's effectively a different business relationship, handled as
  offboard-and-reonboard, not a data migration).
- A `business` belongs to exactly one `organization`. A `location`
  belongs to exactly one `business`. No shared/pooled locations across
  organizations, ever — this is the whole point of the tenant boundary.
- Currency defaults from the location's country at creation but is
  editable per-location, because a location's operating currency can
  differ from the org's billing currency (e.g., a Kenyan org with a
  Somaliland location operating in USD).
- `organization.status` (`active`, `suspended`, `closed`) is the circuit
  breaker for the entire tenant — suspending it must be checked in the
  tenant-context middleware itself, not re-implemented per module.
- Feature entitlements gate module access, not permissions. A user can
  have the `inventory:adjust` permission and still be blocked if the
  org's plan doesn't include inventory — these are two independent
  checks, not one.

## Edge Cases & Failure States

- Signup with a country that has no tax adapter yet (Module 18): block
  at signup with an explicit "not yet available in [country]" message,
  not a silent fallback to a default tax regime that would produce wrong
  compliance behavior later.
- Owner deletes their last location: not allowed — an organization with
  zero locations is an invalid state; force "suspend" or a support-assisted
  offboarding flow instead of an unrecoverable delete.
- Regional manager assigned to a location outside their business (data
  error or bug): tenant-context middleware must reject this at the query
  layer via RLS, not just hide it in the UI — this is exactly the class of
  bug RLS exists to backstop, per `ENGINEERING_CHARTER.md`.
- Race condition: two devices creating a location with the same `code`
  simultaneously — enforce a unique constraint on `(organization_id, code)`
  at the database level, don't rely on app-layer uniqueness checks alone.

## Data Model

`DATA_MODEL.md` Shared Foundation: `organizations`, `businesses`,
`locations`, `tenant_settings`. Subscription/feature-entitlement state
lives in `DATA_MODEL.md`'s Pricing And Billing group
(`subscription_plans`, `organization_subscriptions`) — feature
entitlements are a plan-level attribute there, not a separate
`feature_flag` table.

## Events Emitted

- `OrganizationCreated` — consumed by: onboarding flow, product analytics.
- `LocationCreated` — consumed by: onboarding flow, menu-copy prompt,
  product analytics.
- `OrganizationSuspended` — consumed by: all modules via tenant-context
  middleware (blocks further writes), notification module (alerts owner).
- `SubscriptionChanged` — consumed by: feature-entitlement cache
  invalidation, billing.

## API Surface

- `POST /organizations` (signup only, not a general admin endpoint)
- `GET /organizations/:id`, `PATCH /organizations/:id`
- `POST /locations`, `GET /locations`, `GET /locations/:id`,
  `PATCH /locations/:id`
- `GET /organizations/:id/feature-flags`

Full request/response contracts live in the API Specification volume.

## Offline Behavior

Not directly offline-capable — a device cannot create an organization or
location while offline. Location *metadata* (name, address, settings) is
part of the cached reference data a POS device pulls down (via PowerSync,
per ADR 0001) so it's readable offline; it just can't be created or
edited from an offline device.

## Acceptance Criteria

- A new signup produces exactly one organization, one business, one
  location, and one owner user, with no orphaned or partial state if any
  step fails (wrap in a transaction).
- A regional manager can switch between every location in their business
  and cannot see locations outside it, verified by attempting a direct
  API call to a foreign location's ID (must fail via RLS, not just be
  hidden in the UI).
- Suspending an organization blocks every write endpoint across every
  module within one request cycle — no cached "still active" state.

## Non-Goals

- Billing/payment collection for the subscription itself (separate,
  later — master plan section 29 Pricing and Monetization).
- Cross-organization data sharing of any kind (explicitly never supported
  — benchmarking, per master plan, uses anonymized aggregation, not
  cross-tenant queries).
- Org-to-org merge/split tooling.
