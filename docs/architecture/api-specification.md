# API Specification

## Scope

Owns the technical contract every endpoint in the system follows:
versioning, authentication schemes, request/response conventions,
pagination, filtering, error taxonomy, idempotency, and rate limiting.
This is the gap `ENGINEERING_CHARTER.md`'s document backlog flagged —
master plan section 26 already defines the response envelope, module
boundary rule, and a representative list of core endpoints; this volume
is the fuller contract those endpoints (and every PRD's own "API
Surface" section) must conform to, not a restatement of section 26.

## Versioning

- All public/external-facing endpoints (PRD 19's developer platform,
  PRD 15/16's webhook receivers) are versioned under `/api/v1/...`.
- Internal endpoints consumed only by first-party clients
  (`apps/pos-mobile`, `apps/manager-web`, etc.) are not required to carry
  a version prefix — they evolve alongside their clients, deployed
  together from the same monorepo. If internal and public surfaces ever
  diverge enough to need independent versioning, that's an ADR-worthy
  decision, not a default assumption.
- Breaking changes to `/api/v1` require a new version (`/api/v2`) with
  both versions supported through a documented deprecation window —
  third-party developer platform apps (PRD 19) cannot be broken without
  notice.

## Authentication

Two schemes, matching PRD 01 and PRD 19:

- **Internal session** (web/mobile first-party clients): short-lived
  access token + refresh token (PIN-login flow, PRD 01), or email/
  password + optional 2FA for owner/regional_manager web logins.
- **Public API** (PRD 19): API key (`Authorization: Bearer <key>`,
  server-to-server) or OAuth 2.0 access token (installed marketplace
  apps). Every public request resolves to exactly one
  `organization_id` plus a granted scope set — never broader.

Both schemes terminate in the same tenant-context middleware (PRD 00)
before any handler runs — there is one tenant-resolution code path, not
one for internal and a different one for public.

## Request Conventions

- `Idempotency-Key` header is **mandatory** on every mutating request
  that touches money, sync, or an external integration (master plan
  section 26's "Required API Behaviors," restated because it's load-
  bearing) — enforced at the gateway/middleware level, not left to each
  handler to remember.
- Pagination: cursor-based (`?cursor=...&limit=...`), not offset-based —
  offset pagination degrades under concurrent writes, which this system
  has constantly (multiple POS devices writing simultaneously). Response
  includes `next_cursor: string | null`.
- Filtering: query parameters map directly to indexed columns where
  possible (`?location_id=...&status=...&from=...&to=...`) — no
  free-form filter query language for v1.
- Every list endpoint defaults to the requesting user/token's tenant
  scope (`organization_id`, and `location_id` where the resource is
  location-scoped) — there is no way to request "all tenants" from any
  endpoint, public or internal.

## Response Envelope

Exactly master plan section 26's envelope (success: `data` + `meta`;
error: `error` + `meta`) — not redefined here. This volume adds the
error `type` taxonomy that section 26's example only shows one instance
of:

| `error.type` | HTTP status | Meaning |
| --- | --- | --- |
| `permission_denied` | 403 | Authenticated, but lacks the required permission (PRD 01) |
| `scope_denied` | 403 | Public API token lacks the required OAuth/API-key scope (PRD 19) — same shape as `permission_denied` by design, per `BUILD_WORKFLOW.md` section 7.2 |
| `validation_error` | 422 | Request body/params fail schema validation |
| `not_found` | 404 | Resource doesn't exist or isn't in the caller's tenant scope (these are indistinguishable on purpose — never leak existence of another tenant's resource) |
| `conflict` | 409 | State-machine violation (e.g. voiding an already-voided item), or an idempotency key reused with a different payload |
| `approval_required` | 202 (not an error status) | Action was accepted but held pending manager approval (PRD 01) — distinct from a rejection |
| `rate_limited` | 429 | Public API rate limit exceeded (PRD 19), includes `Retry-After` header |
| `billing_hold` | 403 | Organization suspended (PRD 00) — distinct from `permission_denied` so clients can render the right message |
| `internal_error` | 500 | Unexpected server error — never exposes internal detail in `error.detail` |

## Idempotency

- Idempotency keys are scoped per `(organization_id, endpoint,
  idempotency_key)` — the same key value from two different tenants (or
  two different endpoints) is not a collision.
- A repeated request with a previously-seen key returns the **original**
  response, byte-for-byte, without re-running any side effect — this is
  what makes retried mobile-money payments (PRD 07) and retried sync
  pushes (PRD 11) safe.
- A repeated key with a **different** request body is a `conflict` error
  (409) — this catches a client bug (key reuse across genuinely
  different requests) rather than silently applying the wrong one.

## Rate Limiting

Applies to the public API (PRD 19) only — internal first-party clients
are not rate-limited by this layer (though normal infrastructure-level
protection still applies).

- Standard tier: 60 requests/minute per token.
- Bulk-sync tier: 600 requests/minute (granted for integrations with a
  legitimate high-volume need, e.g. catalog sync — PRD 15).
- Exceeding the limit returns `rate_limited` (429) with `Retry-After`.

## Webhooks (Outbound)

Full delivery mechanics in `BUILD_WORKFLOW.md` section 7.3 and PRD 19 —
this volume states the contract from the receiver's perspective:

- Every payload is signed: `X-Signature: HMAC-SHA256(body, subscription_secret)`.
  Receivers must verify before trusting the payload.
- Delivery expects a 2xx response within 30 seconds; anything else is
  treated as failure and retried with bounded exponential backoff.
- Event names match the domain events cataloged in each PRD's "Events
  Emitted" section (`order.created`, `payment.completed`, etc.) — there
  is one canonical event catalog, not a separate webhook-specific naming
  scheme. A future "Canonical Event Catalog" document (flagged in
  `ENGINEERING_CHARTER.md`'s backlog as a natural addition once the
  event list stabilizes) will formalize payload schemas per event.

## Webhooks (Inbound — from integration partners)

Per `BUILD_WORKFLOW.md` section 6: every inbound webhook (payment
providers, commerce/delivery platforms, WhatsApp) is signature-verified
before any domain command runs, and writes a `channel_sync_logs` row
regardless of outcome. Inbound webhook handlers never write directly to
domain tables — they call the same module commands an internal or public
API client would (PRD 15/16's explicit rule, generalized here as a
platform-wide contract).

## Endpoint Reference

This volume does not re-list every endpoint — each PRD's own "API
Surface" section is the source of truth for that module's endpoints, and
master plan section 26's "Core API Groups" gives the representative
top-level list. The actual machine-readable contract (OpenAPI 3.x spec)
is generated from the NestJS controllers' decorators (ADR 0001's
framework choice) rather than hand-maintained separately — this avoids
the spec and the implementation drifting apart, which is the single most
common failure mode of hand-written API docs.

## Non-Goals

- GraphQL (PRD 19's non-goals — REST/OpenAPI is the committed v1
  surface).
- A generic query language / OData-style filtering (deliberately
  constrained to indexed-column filters for v1, per Request Conventions
  above — expand only if a real client need justifies the complexity).
