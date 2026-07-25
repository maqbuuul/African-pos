-- sync_conflicts.resolution's CHECK constraint (0013) was hardcoded to only
-- the 4 auto-resolution policy values ('server_wins', 'append_merge',
-- 'manual_review', 'payment_dependent') and never included the human-chosen
-- values ('use_local', 'use_remote', 'manual') that ConflictResolutionSchema
-- (packages/domain) defines and that SyncService.resolveConflict's own DTO
-- (ResolveConflictDto) validates against — the exact values a manager picks
-- when reviewing a conflict that landed in manual_review. Every real
-- conflict-resolution attempt using those values therefore violated the DB
-- constraint outright; found the same way 0022's entity_type fix was found
-- (driving the real service, not schema inspection alone). Neither this
-- constraint nor sync_conflicts_entity_type_check (already fixed in 0022) is
-- represented in the Drizzle TS schema (packages/database/src/schema/restaurant/index.ts's
-- syncConflicts table has no check() calls) — both were only ever hand-added
-- raw SQL in 0013, so drizzle-kit generate cannot detect or manage this
-- drift; this migration is hand-written to match, same as 0022.
ALTER TABLE "sync_conflicts" DROP CONSTRAINT "sync_conflicts_resolution_check";--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolution_check" CHECK ("sync_conflicts"."resolution" in ('server_wins', 'append_merge', 'payment_dependent', 'manual_review', 'use_local', 'use_remote', 'manual'));
