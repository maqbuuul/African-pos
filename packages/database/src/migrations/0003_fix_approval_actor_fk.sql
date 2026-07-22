-- Hand-written, not drizzle-kit generated: renaming a column with an
-- ambiguous FK-removal at the same time needs drizzle-kit's interactive
-- rename prompt, which can't run in this non-TTY environment (same reason
-- RLS/pg_trgm statements elsewhere in this migration set are hand-written).
--
-- Fixes a real bug found while verifying P3: approval_requests.approved_by_staff_id
-- had an FK to `staff` only, but P3's owner-approval flow
-- (products:approve_large_price_change, docs/prd/03-menu-catalog.md) requires
-- an owner — a `users` row, not `staff` — to resolve the approval, which
-- violated the FK on every attempt. Same fix applied to requested_by_staff_id
-- for symmetry (a `users` actor could equally end up as a requester), matching
-- audit_logs.actor_id's existing no-FK, dual-target pattern.
ALTER TABLE "approval_requests" DROP CONSTRAINT "approval_requests_requested_by_staff_id_staff_id_fk";--> statement-breakpoint
ALTER TABLE "approval_requests" DROP CONSTRAINT "approval_requests_approved_by_staff_id_staff_id_fk";--> statement-breakpoint
ALTER TABLE "approval_requests" RENAME COLUMN "requested_by_staff_id" TO "requested_by_actor_id";--> statement-breakpoint
ALTER TABLE "approval_requests" RENAME COLUMN "approved_by_staff_id" TO "approved_by_actor_id";
