# PRD 01: Authentication & Permissions

## Scope

Owns identity, login, session management, and role-based access control
for every human actor in the system. Corresponds to master plan Module 2
and `DATA_MODEL.md` Shared Foundation (`users`, `staff`, `roles`,
`permissions`, `role_permissions`, `staff_roles`, `devices`,
`approval_requests`). Does not own audit logging itself (PRD 02, though
this module is audit logging's single biggest source of events) and does
not own tenancy (PRD 00, which this module depends on).

## Dependencies

PRD 00 (Multi-Tenancy) — every `staff`/`user` row is scoped to an
`organization_id`, and `staff_roles` is scoped to `location_id`.

## User Stories

- As a **cashier**, I need to log in with a 4-6 digit PIN in under two
  seconds, so a queue of customers isn't waiting on my login.
- As an **owner**, I need email + password (and 2FA) login, because I'm
  logging in occasionally from a browser, not dozens of times a shift
  from a shared terminal.
- As a **branch manager**, I need to approve a cashier's refund request
  from my own device without walking to the register, so service isn't
  interrupted.
- As an **auditor**, I need to see every login, failed PIN attempt, and
  permission change, so I can investigate incidents after the fact.
- As the **platform**, I need every sensitive action gated by a named
  permission, not a hard-coded role check, so permission changes don't
  require a code deploy.

## Workflows

### PIN login (POS/KDS/handheld devices)

```text
Staff selects their name/photo from the device's staff list (cached locally)
  -> Staff enters PIN
  -> Device checks PIN locally first if device has cached hash + is offline
     -> if offline and PIN matches cached hash: grant session, queue login event for sync
     -> if offline and no cached hash or mismatch: block, show "connect to verify" (fail closed, not open)
  -> If online: device calls POST /auth/pin-login
     -> Server validates staff belongs to this location, PIN hash matches, staff.status = active
     -> Server checks device is in `devices` and status = authorized
     -> On success: issue short-lived session token scoped to (staff_id, location_id, device_id)
     -> On failure: increment failed-attempt counter; lock PIN after N consecutive failures (see Business Rules)
  -> Login event written to audit log (success or failure)
```

### Email + password login (web apps)

```text
User enters email + password
  -> Server validates credentials
  -> If owner/regional_manager and 2FA enabled: prompt for 2FA code
  -> On success: issue access token + refresh token
  -> Access token scoped to organization_id; location scope resolved per-request via location switcher selection
  -> Session appears in "active sessions" list, revocable by the user or an admin
```

### Manager approval (sensitive action)

```text
Cashier attempts a gated action (e.g. refund above threshold)
  -> System checks cashier's permissions -> lacks orders:refund at this amount
  -> System creates approval_request (action, entity, reason prompt, requested_by_staff_id)
  -> Request appears on manager's device (push notification + in-app queue)
  -> Manager reviews context (order detail, amount, reason) and approves or denies
  -> On approve: original action executes, tagged with approved_by_staff_id
  -> On deny: action blocked, cashier notified with reason
  -> Both outcomes write an audit log entry
```

### Device authorization

```text
New device installed at a location
  -> Device generates a device fingerprint, requests activation code from manager/owner
  -> Manager enters activation code on the device (or approves from admin-web)
  -> Device registered in `devices` (status: authorized), scoped to location_id
  -> Device can now attempt PIN logins; unauthorized devices are rejected before PIN check even runs
```

## Screens & UI Behavior

- **PIN pad** (POS/KDS): staff photo grid → numeric PIN pad. Target:
  usable in under 2 seconds end-to-end, per master plan section 21
  latency targets. Wrong PIN gives immediate feedback, no artificial
  delay except after the lockout threshold.
- **Login (web)**: email/password, 2FA prompt when applicable, "forgot
  password" flow (email-based reset, rate-limited).
- **Active sessions** (owner-web, admin-web): list of active sessions per
  user/staff, device, last-active time, revoke button.
- **Approval queue** (manager-web, manager mobile view): pending
  approval requests, sorted by age, with enough order/action context to
  decide without navigating away.
- **Staff & roles** (manager-web, owner-web): staff list, role
  assignment per location, PIN reset (manager-initiated, staff must set
  new PIN on next login), deactivation.

## Permissions

Permission keys and the full sales/payments/cash-drawer/inventory/
staff/reports groups are defined in master plan section 22 — this module
is the enforcement engine for that matrix, not a second copy of it.
Specific to this module:

| Action | owner | branch_manager | others |
| --- | --- | --- | --- |
| Assign/change staff roles | Yes | Yes (own location) | No |
| Reset another staff member's PIN | Yes | Yes (own location) | No |
| View login/audit history | Yes | Yes (own location) | auditor: yes, org-wide |
| Approve sensitive actions | Yes | Yes | supervisor: subset, per master plan section 22 approval list |
| Authorize new devices | Yes | Yes (own location) | No |

## Business Rules

- PINs are 4-6 digits, unique **per location** (not globally) — two
  staff at different locations can share a PIN, two staff at the same
  location cannot.
- PIN lockout: 5 consecutive failed attempts locks the staff PIN for 15
  minutes at that device, and a lockout event is audit-logged and
  visible to the branch manager immediately (in case it's an attempted
  breach, not the actual staff member).
- 2FA is mandatory for `owner` and `regional_manager` roles, optional and
  discouraged-against for frontline PIN-login roles (device-shared PINs
  and 2FA don't compose well operationally).
- Every permission is a named capability (`orders:void_bill`, not "is
  manager"). Roles are just named bundles of permissions — this is what
  lets an owner customize a role without a code change.
- Session tokens for PIN-login roles are short-lived and device-bound;
  they do not survive a device reboot without re-authentication, by
  design — a lost/stolen unlocked device shouldn't stay a live session
  indefinitely.
- Deactivating a staff member does not delete their `staff` row (master
  plan's never-delete rule) — it sets `status = inactive`, revokes all
  active sessions immediately, and preserves every historical order/
  action reference.

## Edge Cases & Failure States

- Device is offline and staff has never logged in on it before (no
  cached PIN hash): login is blocked, not silently allowed — offline PIN
  verification requires a prior successful online login to have cached
  the hash. This is a deliberate fail-closed choice.
- Manager approval requested while the manager's own device is offline:
  request queues; cashier sees "awaiting approval, manager offline" not
  a silent hang. Falls back to a second eligible approver at the
  location if one exists and is online.
- Two managers try to approve/deny the same request simultaneously: first
  write wins, second gets a "already resolved" response, not a duplicate
  action.
- Staff PIN collision attempt at signup/reset time (PIN already used at
  that location): reject at creation, force a different PIN — never
  silently allow a collision.

## Data Model

`DATA_MODEL.md` Shared Foundation: `users`, `staff`, `roles`,
`permissions`, `role_permissions`, `staff_roles`, `devices`,
`approval_requests`.

## Events Emitted

- `StaffLoggedIn` / `StaffLoginFailed` — consumed by: audit log, fraud/
  anomaly detection (P17), branch manager lockout alerts.
- `StaffDeactivated` — consumed by: audit log, session revocation, all
  modules that need to stop showing this staff member as assignable.
- `ApprovalRequested` / `ApprovalGranted` / `ApprovalDenied` — consumed
  by: audit log, notification module (push to manager/requester),
  product analytics.
- `DeviceAuthorized` / `DeviceDeauthorized` — consumed by: audit log,
  admin-web device status view.

## API Surface

- `POST /auth/pin-login`, `POST /auth/logout`
- `POST /auth/login` (email/password), `POST /auth/2fa/verify`,
  `POST /auth/refresh`
- `GET /auth/sessions`, `DELETE /auth/sessions/:id`
- `POST /staff`, `PATCH /staff/:id`, `POST /staff/:id/reset-pin`,
  `POST /staff/:id/deactivate`
- `POST /approval-requests`, `PATCH /approval-requests/:id`
  (approve/deny)
- `POST /devices/activate`, `PATCH /devices/:id` (authorize/revoke)

## Offline Behavior

PIN login works offline **only** if the device has previously
authenticated this staff member online and cached the PIN hash and
permission set. Permission checks themselves are evaluated against the
locally cached role/permission set while offline, then reconciled on
reconnect if the server-side permissions changed in the meantime (server
wins, per master plan section 27 conflict policy — "server wins for
[configuration]"). Approval requests queue offline and sync per PRD 11
(Offline Sync) when connectivity returns; the gated action itself is
held pending approval, not executed optimistically offline.

## Acceptance Criteria

- A cashier can complete PIN login in under 2 seconds on a warmed-up
  device, online or offline (with prior cached login).
- A permission removed from a role takes effect for all affected staff
  within one sync cycle, without requiring logout/login.
- An unauthorized device cannot complete a PIN login even with a correct
  PIN — device authorization is checked before, not instead of, identity.
- Every login attempt (success and failure) and every permission/role
  change produces exactly one audit log entry.

## Non-Goals

- Customer-facing authentication (QR ordering is anonymous/phone-based,
  not staff auth — see PRD 10).
- SSO/SAML for enterprise customers (master plan Enterprise suite,
  later).
- Biometric (fingerprint/face) login — explicitly an integration with
  third-party hardware/SDKs later, not built in-house (master plan
  Workforce section, chat source material).
