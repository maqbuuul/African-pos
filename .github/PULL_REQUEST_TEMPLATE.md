## Summary

<!-- What changed and why. Link the relevant docs/prd/*.md, ADR, or TODO.md item. -->

## Which phase / PRD does this implement?

<!-- e.g. P5 Order Engine — docs/prd/05-order-engine.md -->

## Checklist

Full detail: `ENGINEERING_HANDBOOK.md`'s PR/Code Review Checklist,
`CONTRIBUTING.md`'s Pull Requests & Code Review section.

- [ ] Satisfies the relevant PRD's Definition of Done (master plan
      section 28): backend command, API validation, permission checks,
      audit logs where required, UI happy path, visible error states,
      offline behavior handled or explicitly blocked, tests cover core
      business rules, report data captured, analytics event emitted,
      docs updated.
- [ ] Does not violate any master plan section 28 Non-Negotiable Rule
      (no payment deletion, no inventory overwrite without a movement
      record, no destructive action without an audit event, no
      cross-tenant reads, no client-only order totals, no manager
      override without approver identity, no untraceable report).
- [ ] Matches the PRD's Business Rules and Edge Cases sections, not just
      the reviewer's memory of the discussion that produced this PR.
- [ ] New tenant-scoped table? RLS policy is in the same migration, same
      PR.
- [ ] New domain event? Outbox row added, and the event is added to
      `docs/architecture/event-catalog.md`.
- [ ] Schema change? `DATA_MODEL.md` updated in this PR.
- [ ] Nothing here is a silent architecture decision that should have
      been an ADR instead.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass
      locally (CI will verify, but don't rely on CI to find this first).

## Test plan

<!-- How was this verified? Which PRD Acceptance Criteria does it satisfy? -->
