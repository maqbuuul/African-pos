# PRD 19: Developer Platform

## Scope

Owns the public API, OAuth app ecosystem, webhooks, sandbox mode, and
developer portal that let third parties build on the platform.
Corresponds to master plan Module 17 (Developer Platform And Public API)
and `BUILD_WORKFLOW.md` section 7 (full technical workflow, already
detailed there — this PRD adds the product/workflow/permission layer on
top rather than re-deriving the request-flow mechanics). Built last,
after the internal API contract is stable, per `BUILD_WORKFLOW.md`'s
explicit dependency note.

## Dependencies

PRD 01 (auth, extended outward to API keys/OAuth), PRD 03/05/07/12/13
(every resource the public API/webhooks expose), PRD 18 (a public
contract needs a stable, hardened system behind it — this is why P19 is
last).

## User Stories

- As a **third-party developer**, I need to register an app, request
  specific scopes, and get a merchant's authorization without ever
  seeing credentials or data beyond what was explicitly granted.
- As a **merchant**, I need to see exactly what an app can access before
  I install it, and revoke that access instantly if I change my mind.
- As a **developer**, I need webhooks I can trust — signed, retried on
  failure, and never silently stopped without me knowing.
- As a **merchant**, I need to browse an app marketplace and install
  vetted integrations without a manual support ticket.
- As the **platform**, I need every third-party write to go through the
  exact same business rules as any internal client — the public API is
  never a shortcut around a module's own validation.

## Workflows

### App registration and auth

```text
API key flow (server-to-server): merchant generates a scoped key from
their own dashboard; every request resolves to one organization_id +
its granted scopes; revocation takes effect on the next request, not on
a cache TTL.

OAuth 2.0 flow (installed marketplace app): developer registers an app
with requested scopes + redirect URL -> merchant clicks install from the
marketplace -> standard authorization-code redirect, merchant approves
the EXACT scopes shown -> code exchanged for access + refresh token ->
access token short-lived, silently refreshed -> merchant can uninstall
at any time, immediately revoking every token issued to that app for
that tenant (BUILD_WORKFLOW.md section 7.1, in full).
```

### Any `/api/v1` write request

```text
Request arrives with Authorization header + Idempotency-Key (mandatory,
not optional -- inherited from this platform's general idempotency
discipline, PRD 07/11)
  -> Token resolved to organization_id + granted scopes
  -> Scope check: missing scope -> 403 scope_denied, same error shape as
     an internal permission_denied (developers get the same quality of
     error internal engineers would)
  -> Idempotency-Key checked; a repeat returns the original result,
     never re-runs the effect
  -> Rate limiter checks the token's tier bucket (60 req/min standard,
     600 req/min bulk-sync tier); 429 with Retry-After if exceeded
  -> Request maps to the EXACT SAME module command an internal client
     calls (CreateOrder, AddOrderItem, UpdateProduct...) -- the public
     API is a thin, scope-restricted client of PRD 03/05/07/12/13,
     never a parallel write path with its own validation logic
  -> Response uses the standard envelope; api_usage_logs row written
```

### Webhook delivery

```text
Domain event fires internally (order.created, payment.completed, any
event from any prior PRD's "Events Emitted" section)
  -> Event bus fans out to internal listeners AND any webhook_
     subscriptions matching this tenant + event type
  -> Payload built and signed (HMAC-SHA256, subscription's own secret)
  -> POST to subscriber's URL; 2xx within 30s -> success recorded
  -> Non-2xx/timeout -> retry with bounded exponential backoff
  -> Repeated consistent failure -> subscription auto-paused, developer
     notified in the portal -- never fails silently forever
```

### Sandbox mode

```text
Per-app test tenant provisioned automatically on registration
  -> sk_test_ / sk_live_ key prefixing makes the environment unambiguous
     at a glance
  -> "Send test event" available per webhook subscription, so a
     developer can verify their handler without needing a real merchant
     transaction
  -> Sandbox and production are hard-separated at the data layer -- a
     sandbox token cannot resolve to a production organization_id under
     any request path, ever (this is a security guarantee, not just a
     convenience)
```

### App marketplace

```text
Developer submits app for review -> platform team reviews scope
justification and security checklist (apps/admin-web's "Developer app
review" surface, per PROJECT_STRUCTURE.md) before public listing
  -> Merchant browses marketplace, installs an app -> OAuth flow above
     runs, merchant sees exact scopes before approving
  -> Revenue-share billing hook triggers if the app has a paid tier
  -> Merchant can uninstall at any time from their own dashboard
```

## Screens & UI Behavior

- **`apps/developer-portal`** (React + Vite, per ADR 0001): app
  registration console, OpenAPI-generated API reference, Postman
  collection, per-app usage analytics, sandbox/test-event management.
- **Merchant-facing app management** (owner-web): installed apps, scopes
  each has, install/uninstall, marketplace browsing.
- **`apps/admin-web`'s developer app review surface**: scope
  justification and security checklist review before public listing
  (already named in `PROJECT_STRUCTURE.md`).

## Permissions

| Action | owner | developer (external) | admin (internal) |
| --- | --- | --- | --- |
| Generate/revoke API keys for own org | Yes | — | Yes (support) |
| Install/uninstall a marketplace app | Yes | — | No |
| Register a developer app | — | Yes | — |
| Approve an app for public marketplace listing | No | No | Yes |
| View own app's usage analytics | No | Yes (own app) | Yes |

## Business Rules

- **A scope grant is never implicit.** An app with `orders:read` cannot
  call any `orders:write` endpoint even if the merchant also granted
  that scope to a different app — scopes are per-app, per-grant, never
  pooled or inherited.
- **The public API never grows its own write path.** Every write maps to
  the exact same internal module command PRD 03/05/07/12/13 already
  expose to internal clients — this is the same module-boundary
  discipline `BUILD_WORKFLOW.md` section 6 applies to external commerce/
  delivery integrations (PRD 15/16), extended to third-party developers.
- Every credential (API key secret, OAuth client secret, webhook signing
  secret) is shown in full exactly once, at creation — every later view
  is masked. This mirrors `ENGINEERING_CHARTER.md`'s "nothing with
  business meaning is hard-deleted" spirit applied to secrets: they're
  never re-displayed, not because they're deleted, but because
  re-display itself is the security risk.
- Idempotency-Key is mandatory on every write, not optional — a missing
  key on a write request is itself a rejectable error, not a fallback to
  non-idempotent behavior.

## Edge Cases & Failure States

- A webhook subscriber's endpoint returns inconsistent success/failure
  (flaky infra on their end): bounded retry with backoff prevents this
  platform from hammering a struggling third-party endpoint
  indefinitely; auto-pause after repeated failure protects both sides.
- A merchant uninstalls an app mid-request (race condition: a request
  is in flight when the token is revoked): the in-flight request is
  allowed to complete if already past the auth-check step (it was valid
  when it started), but no new requests succeed after revocation takes
  effect — revocation is not retroactive to already-authorized-and-
  started work, but is immediate for anything after.
- A sandbox app attempts to reference a production resource ID (e.g. a
  real order ID guessed or leaked): rejected at the data layer, not just
  the API layer — sandbox/production separation must hold even against
  a determined attempt to cross it.
- Rate limit exceeded during a legitimate bulk sync: the standard/
  bulk-sync tier distinction exists specifically so a legitimate
  high-volume integration (e.g. PRD 15's own commerce sync, if it were
  built as a marketplace app rather than first-party) isn't
  indistinguishable from abuse.

## Data Model

`DATA_MODEL.md` Developer Platform group, in full: `developer_apps`,
`api_keys`, `oauth_grants`, `oauth_tokens`, `webhook_subscriptions`,
`webhook_deliveries`, `api_usage_logs`, `marketplace_listings`,
`marketplace_installs`.

## Events Emitted

- `DeveloperAppRegistered` / `AppInstalled` / `AppUninstalled` —
  consumed by: admin review queue, product analytics.
- `WebhookDeliveryFailed` / `WebhookSubscriptionPaused` — consumed by:
  developer portal notification.
- Every domain event from every prior PRD is a potential webhook
  payload — this module doesn't define new events, it re-delivers
  existing ones to authorized external subscribers.

## API Surface

Full detail in `BUILD_WORKFLOW.md` section 7 (not repeated here):
`/api/v1/orders`, `/api/v1/products`, `/api/v1/customers`,
`/api/v1/inventory`, `/api/v1/payments`, `/api/v1/reports` (scope-gated
per master plan Module 17), `POST/GET/DELETE /api/v1/webhooks`.

## Offline Behavior

Not applicable — this is a server-side public API surface for
third-party integrations, with no on-device offline component. A
merchant's own devices' offline behavior (PRD 11) is unaffected by and
unrelated to third-party API availability.

## Acceptance Criteria

Exactly `BUILD_WORKFLOW.md` P19's gate: a third-party test app can
register, request scopes, get a merchant's OAuth grant in sandbox,
create a test order via `/api/v1/orders`, and receive a signed
`order.created` webhook for it.

## Non-Goals

- Building the marketplace's payment/billing infrastructure from
  scratch — integrate with existing payment providers (PRD 07's
  adapters), don't rebuild billing.
- GraphQL API (REST/OpenAPI is the committed surface per
  `BUILD_WORKFLOW.md`; GraphQL is not ruled out forever but isn't P19
  scope).
