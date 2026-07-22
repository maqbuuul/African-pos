# Product Requirements Documents — Index

Every module in `HOSPITALITY_OS_MASTER_PLAN.md` gets a PRD here once it's
about to be built. A PRD does not restate the master plan's feature list —
it owns the thing the master plan explicitly doesn't: **workflows,
screen-by-screen UI behavior, permissions, business rules, edge cases,
events emitted, and acceptance criteria**, detailed enough that an
engineer (or an AI assistant) can implement the module without having to
invent behavior. See `ENGINEERING_CHARTER.md` for how this fits into the
rest of the document set.

PRDs are written in build order (`BUILD_WORKFLOW.md` P0–P19), not
alphabetically or by "importance" — a PRD for a module that depends on
another module isn't fully specifiable until the dependency's PRD exists,
because permissions, events, and data references chain backward.

## Template

Every PRD in this directory follows this structure:

1. **Scope** — one paragraph: what this module owns, what it explicitly
   does not own, which master plan section(s) and `DATA_MODEL.md` table
   group(s) it corresponds to.
2. **Dependencies** — which other PRDs/modules must exist first, and why.
3. **User Stories** — per role, "As a [role], I need to [action] so that
   [outcome]," pulling roles from master plan section 5.
4. **Workflows** — step-by-step sequences for every distinct flow the
   module supports, including failure branches, not just the happy path.
5. **Screens & UI Behavior** — every screen this module owns, what's on
   it, what state changes are visible, latency expectations where they
   matter (frontline surfaces have hard targets from master plan section
   21).
6. **Permissions** — exactly which role can do what, referencing master
   plan section 22 (Permission and Approval Matrix) rather than
   reinventing a matrix per PRD.
7. **Business Rules** — the rules that aren't obvious from the data model
   alone: pricing precedence, state-machine transitions, validation
   constraints, what's append-only vs. mutable.
8. **Edge Cases & Failure States** — what happens when things go wrong:
   offline, conflicting writes, partial payments, permission denials,
   duplicate submissions.
9. **Data Model** — pointer to the exact `DATA_MODEL.md` tables this
   module reads/writes, not a redefinition of the schema.
10. **Events Emitted** — the outbox events this module produces (name,
    trigger, consumers), per `ENGINEERING_CHARTER.md`'s "every domain
    event gets an outbox row" rule.
11. **API Surface** — the endpoints this module exposes, at a summary
    level; the full contract lives in the API Specification volume.
12. **Offline Behavior** — explicitly: does this module work offline, and
    if so, exactly what degrades.
13. **Acceptance Criteria** — testable, cross-referenced to the
    `BUILD_WORKFLOW.md` phase's acceptance gate where one exists.
14. **Non-Goals** — what's deliberately out of scope for this PRD/phase,
    so scope doesn't silently creep.

## Status

| # | PRD | Build phase | Status |
| --- | --- | --- | --- |
| 00 | [Organizations & Multi-Tenancy](./00-multi-tenancy.md) | P1 | Done |
| 01 | [Auth & Permissions](./01-auth-permissions.md) | P2 | Done |
| 02 | [Audit Logs](./02-audit-logs.md) | P1/P2 | Done |
| 03 | [Menu & Product Catalog](./03-menu-catalog.md) | P3 | Done |
| 04 | [Floor Plan & Tables](./04-floor-plan-tables.md) | P4 | Done |
| 05 | [Order Engine](./05-order-engine.md) | P5 | Done |
| 06 | [Kitchen Display System](./06-kitchen-kds.md) | P6 | Done |
| 07 | [Payments](./07-payments.md) | P7 | Done |
| 08 | [Shift & Cash Drawer](./08-shift-cash-drawer.md) | P8 | Done |
| 09 | [Receipts & Notifications](./09-receipts-notifications.md) | P9 | Done |
| 10 | [QR / Table Ordering](./10-qr-table-ordering.md) | P10 | Done |
| 11 | [Offline Sync](./11-offline-sync.md) | P11 | Done |
| 12 | [Inventory, Recipes & Purchasing](./12-inventory-recipes-purchasing.md) | P12 | Done |
| 13 | [CRM & Loyalty](./13-crm-loyalty.md) | P13 | Done |
| 14 | [Reports & BI Dashboards](./14-reports-bi.md) | P14 | Done |
| 15 | [Commerce Integrations](./15-commerce-integrations.md) | P15 | Done |
| 16 | [Delivery Integrations](./16-delivery-integrations.md) | P16 | Done |
| 17 | [AI/ML Service](./17-ai-ml-service.md) | P17 | Done |
| 18 | [Security, Compliance & Hardening](./18-security-compliance-hardening.md) | P18 | Done |
| 19 | [Developer Platform](./19-developer-platform.md) | P19 | Done |

## Hotel OS and Retail OS

Master plan sections 8/9/24/25 specify these verticals in full, and
`BUILD_WORKFLOW_HOTEL.md` / `BUILD_WORKFLOW_RETAIL.md` now give them
their own phase sequences (`H1`–`H9`, `R1`–`R7`), mechanically derived
from each PRD's own Dependencies/Acceptance Criteria sections — same
rigor as the Restaurant OS phase table above. What's still genuinely
different from the Restaurant OS set: master plan section 3's Year 1
Focus is Restaurant OS only, so neither vertical has been run through an
actual build, and the `H`/`R` phase *order* (as opposed to the PRD
content itself) involved judgment calls flagged explicitly in each build
workflow's own "Notes On Confidence" section — treat phase sequencing as
a reasonable first pass, not a proven one.

| # | PRD | Build phase | Status |
| --- | --- | --- | --- |
| Hotel 01 | [Reservations & Booking Engine](./hotel/01-reservations-booking.md) | H2 | Done |
| Hotel 02 | [Front Desk (Check-In / Check-Out)](./hotel/02-front-desk.md) | H3 | Done |
| Hotel 03 | [Room & Housekeeping Management](./hotel/03-room-housekeeping.md) | H1 + H5 | Done |
| Hotel 04 | [Folio, Hotel Payments & Night Audit](./hotel/04-folio-payments-night-audit.md) | H4 | Done |
| Hotel 05 | [Maintenance](./hotel/05-maintenance.md) | H6 | Done |
| Hotel 06 | [Guest CRM](./hotel/06-guest-crm.md) | H7 | Done |
| Hotel 07 | [Channel Management](./hotel/07-channel-management.md) | H8 | Done |
| Hotel 08 | [Reports, BI Dashboards & AI](./hotel/08-reports-bi-ai.md) | H9 | Done |
| Retail 01 | [POS & Checkout](./retail/01-pos-checkout.md) | R2 | Done |
| Retail 02 | [Inventory & Variants](./retail/02-inventory-variants.md) | R1 | Done |
| Retail 03 | [Procurement](./retail/03-procurement.md) | R3 | Done |
| Retail 04 | [Returns & Exchanges](./retail/04-returns-exchanges.md) | R4 | Done |
| Retail 05 | [Extended Sales Models](./retail/05-extended-sales-models.md) | R5 | Done |
| Retail 06 | [Omnichannel](./retail/06-omnichannel.md) | R6 | Done |
| Retail 07 | [CRM, Reports, BI & AI](./retail/07-crm-reports-bi-ai.md) | R7 | Done |

## Cross-Cutting Technical Volumes

Not phase-scoped, live in `docs/architecture/` and repo root: API
Specification, Frontend Design System, Engineering Handbook,
Infrastructure & DevOps, Data Platform, Event Catalog. Tracked in
`ENGINEERING_CHARTER.md`'s document backlog.
