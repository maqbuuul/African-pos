-- P10 — QR Table Ordering (BUILD_WORKFLOW.md P10, section 3).
-- Adds: qr_slug column to restaurant_tables for QR token lookup.
-- Stable slug, printed once on the table, never changes.
ALTER TABLE "restaurant_tables" ADD COLUMN "qr_slug" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_location_id_qr_slug_key" ON "restaurant_tables" ("location_id", "qr_slug");
