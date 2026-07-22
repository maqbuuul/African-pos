# Frontend Design System

## Scope

Owns the component library, design tokens, navigation patterns, and
accessibility/responsiveness standards shared across every React + Vite
app in the monorepo (`owner-web`, `manager-web`, `admin-web`, `kds-web`,
`developer-portal`, `customer-web`, `pos-mobile`'s React Native
components). Master plan sections 30 (BI Dashboard Design System) and 32
(UX Design Principles, Performance Budgets, Onboarding) already define
the interaction rules and dashboard-specific conventions in real depth —
this volume is the component/token/architecture layer underneath those
rules, not a restatement of them. This was flagged as a genuine gap in
`ENGINEERING_CHARTER.md`'s document backlog.

## Component Library

Lives in `packages/ui` (per `PROJECT_STRUCTURE.md`), shared across every
React + Vite app. Built on shadcn/ui + Tailwind CSS (master plan section
12's stack), because both are copy-into-your-repo rather than
node_modules-locked — this matters for a solo builder who needs to
customize components without fighting an upstream library's abstraction
boundaries.

- **One component, one job.** A `Button` doesn't grow a `variant="danger-
  with-confirm"` prop — a destructive action composes `Button` +
  `ConfirmDialog` (master plan section 32's confirmation-dialog rule:
  only for destructive/hard-to-reverse actions).
- Components are role-agnostic. `packages/ui` has no concept of "waiter
  button" vs. "manager button" — role-specific screens (master plan
  section 20's "narrow workspace per role") are composed from the same
  primitives, not built from role-specific component variants.
- Every component that displays live/synced data supports the
  loading/offline states section 30 requires as first-class (skeleton
  states, last-updated badges, connectivity indicator) — built into the
  base data-display components (`DataCard`, `MetricTile`, `ListView`),
  not re-implemented per screen.

## Design Tokens

- **Color**: fixed platform-wide semantics per master plan section 30 —
  green/amber/red/blue/purple/gray, never chosen decoratively. Tokens
  named by meaning (`color.status.healthy`, `color.status.needsAttention
  Now`, `color.insight.ai`), never by raw hue (`color.green500`) in
  component code — this is what makes the semantic rule enforceable
  instead of just documented.
- **Typography scale**: one size is reserved exclusively for the "One
  Number Principle" (section 30) — the single largest figure on any
  given dashboard screen. This size is not reused for anything else, so
  a screen literally cannot violate the one-number rule without a
  visibly wrong-looking screen in review.
- **Spacing/density**: POS/KDS surfaces (frontline, touch-first, often
  used at arm's length on a mounted tablet) use a denser, larger-target
  spacing scale than owner/admin dashboards (desk-based, mouse/trackpad,
  can tolerate more information density) — two density presets, not one
  scale trying to serve both.

## Navigation Patterns

- **One tap to the most common action, per role** (master plan section
  32) is a navigation-architecture requirement, not just an interaction
  guideline — each app's home screen route is *that role's* most common
  action's screen, not a generic dashboard everyone lands on and
  navigates away from.
- **Progressive disclosure**: rare/advanced actions live one navigation
  level deeper than common ones, consistently — e.g. voiding a served
  item (PRD 05) is reachable from the order detail screen, not from the
  primary POS grid where it would compete visually with adding items.
- Location switcher (PRD 00) appears identically across every app that
  needs it, as a shared `packages/ui` component — never re-implemented
  per app with subtly different behavior.

## Responsiveness

- Internal apps (`owner-web`, `manager-web`, `admin-web`,
  `developer-portal`): desktop-first, since these are used from a
  laptop/desktop in practice, with tablet support as a secondary target
  — not phone-optimized, since no role uses these from a phone as their
  primary device.
- `kds-web`: tablet-first, landscape orientation assumed, large touch
  targets (kitchen environment: wet hands, gloves, urgency).
- `customer-web` (PRD 10): phone-first, portrait, and the single
  hardest-constrained surface in the system — ADR 0001's explicit
  performance budget (small bundle, aggressive code splitting) is a
  frontend-design-system requirement here, not just a build concern.
- `pos-mobile`: phone/tablet, React Native (ADR 0001), touch-first,
  designed for one-handed operation where possible (a cashier is often
  holding something else).

## Accessibility

- Color is never the only signal — every status communicated by color
  (section 30's fixed semantics) also carries a label or icon, so the
  platform remains usable for color-blind staff and legible in bright
  outdoor/kitchen lighting where color differentiation degrades.
- Touch targets on POS/KDS/mobile surfaces meet a minimum size floor
  (44×44px equivalent) — this is a frontline-usability requirement as
  much as an accessibility one; the two goals align here rather than
  trading off.
- Text contrast meets WCAG AA at minimum across every surface, checked
  as part of component review, not audited only at the end.

## Dark Mode

Not a P0 requirement for any frontline surface (POS/KDS run in
well-lit commercial kitchens/counters where dark mode has no real
benefit), but owner/admin dashboards support it, since those are used
in varied lighting including evenings at home. Implemented via the same
semantic color tokens (above) rather than a parallel color system —
dark mode is a token-value swap, not a second design system.

## Performance Budgets

Exactly master plan section 32's hard ceilings, tested as part of
Definition of Done (master plan section 28), restated here because
they're binding on every component this system produces, not just
final-screen assembly:

- App launch to usable: under 3 seconds.
- Item search: under 200ms.
- Add item to cart: under 100ms.
- Payment screen ready: under 500ms.
- Receipt generation: under 1 second.
- Full resync after 1 hour offline: under 10 seconds.

## Error and Empty States

- Error messages describe the fix, never the failure mode (section 32:
  never `Error 422`, always something like "That phone number doesn't
  look right — check the digits and try again") — this is enforced by
  mapping the API Specification volume's `error.type` taxonomy to
  role-appropriate, human copy in `packages/ui`'s error-display
  components, not left to each screen to phrase individually.
- Empty states are never a bare "No data" — they name what would need to
  happen to populate the screen (e.g. an empty order history says "No
  orders yet — orders will appear here once you start selling," not
  just "No orders").

## Non-Goals

- A general-purpose component library meant for reuse outside this
  product (no public design-system package, no Storybook-as-a-product —
  `packages/ui` exists to serve this monorepo's apps, not as a
  standalone deliverable).
- Native iOS/Android platform-specific design conventions beyond what
  React Native's cross-platform components already provide — this
  product optimizes for Android first (master plan's target market is
  overwhelmingly Android), per master plan section 12's device
  assumptions.
