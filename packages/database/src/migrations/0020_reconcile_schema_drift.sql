-- Reconciliation migration — closes the gap between packages/database/src/schema
-- (source of truth) and what migrations 0000-0019 actually create, found while
-- auditing schema drift (M2). Verified against a real Postgres instance with
-- 0000-0019 applied fresh: this is the complete, exact remaining diff, not a
-- speculative drizzle-kit diff (which was computed against a stale snapshot and
-- wrongly flagged ~20 already-existing tables as new — see the audit notes).
--
-- Adds: cook_time_samples (table PRD 06 KDS cook-time learning never got a
-- migration for). Adds columns for already-shipped features whose migrations
-- were missing a column: bar tabs (payment_intents.tab_id, kitchen_ticket_items
-- .pour_cost), split payment links (payment_intents.payment_link_token), card
-- surcharging (payment_intents/payments.surcharge_amount, products
-- .card_surcharge_pct), payment fraud flagging (payments.fraud_alert), rush/VIP
-- order flagging (kitchen_tickets.is_rush/is_vip), bar vs kitchen KDS stations
-- (kds_stations.station_type), QR ordering per-item labels (order_items
-- .session_label), and staff-notification richness (staff_id/message/channel
-- /sent_at) that 0012 never carried. Also relaxes staff_notifications.table_id
-- to nullable (some notification types, e.g. change_error_alert, aren't tied to
-- a table) and expands payment_intents_status_check to include 'held' (bar tab
-- pre-auth).

CREATE TABLE "cook_time_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"prep_seconds" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cook_time_samples_prep_seconds_check" CHECK ("cook_time_samples"."prep_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "cook_time_samples" ADD CONSTRAINT "cook_time_samples_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_time_samples" ADD CONSTRAINT "cook_time_samples_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_time_samples" ADD CONSTRAINT "cook_time_samples_station_id_kds_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."kds_stations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_time_samples" ADD CONSTRAINT "cook_time_samples_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cook_time_samples_organization_id_idx" ON "cook_time_samples" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cook_time_samples_location_id_idx" ON "cook_time_samples" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "cook_time_samples_station_id_idx" ON "cook_time_samples" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "cook_time_samples_product_id_idx" ON "cook_time_samples" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "cook_time_samples_observed_at_idx" ON "cook_time_samples" USING btree ("observed_at");--> statement-breakpoint
ALTER TABLE "cook_time_samples" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cook_time_samples" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cook_time_samples_tenant_isolation ON "cook_time_samples" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- Missing indexes on already-existing sync tables (columns exist, index didn't).
CREATE INDEX "sync_conflicts_location_id_idx" ON "sync_conflicts" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_cursors_device_id_key" ON "sync_cursors" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "sync_operations_location_id_idx" ON "sync_operations" USING btree ("location_id");--> statement-breakpoint

-- Bar/kitchen station distinction (master plan Restaurant OS bar tabs).
ALTER TABLE "kds_stations" ADD COLUMN "station_type" text DEFAULT 'kitchen' NOT NULL;--> statement-breakpoint
ALTER TABLE "kds_stations" ADD CONSTRAINT "kds_stations_station_type_check" CHECK ("kds_stations"."station_type" in ('kitchen', 'bar'));--> statement-breakpoint

-- Bar tab pour-cost tracking.
ALTER TABLE "kitchen_ticket_items" ADD COLUMN "pour_cost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Rush/VIP order flagging (PRD 06 KDS intelligence).
ALTER TABLE "kitchen_tickets" ADD COLUMN "is_rush" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD COLUMN "is_vip" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- QR ordering: per-item course/session label (fire-course support).
ALTER TABLE "order_items" ADD COLUMN "session_label" text;--> statement-breakpoint

-- Bar tabs, split payment links, and card surcharging on payment intents.
ALTER TABLE "payment_intents" ADD COLUMN "tab_id" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "payment_link_token" text;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD COLUMN "surcharge_amount" integer;--> statement-breakpoint
ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_status_check";--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_status_check" CHECK ("payment_intents"."status" in ('pending', 'processing', 'confirmed', 'held', 'failed', 'cancelled', 'expired'));--> statement-breakpoint

-- Card surcharging and fraud flagging on confirmed payments.
ALTER TABLE "payments" ADD COLUMN "surcharge_amount" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fraud_alert" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Per-product card surcharge percentage override.
ALTER TABLE "products" ADD COLUMN "card_surcharge_pct" integer;--> statement-breakpoint

-- staff_notifications: 0012 predates staff_id/message/channel/sent_at being
-- added to the domain model, and predates change_error_alert-style
-- notifications that aren't tied to a table.
ALTER TABLE "staff_notifications" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_notifications" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "staff_notifications" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "staff_notifications" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_notifications" ALTER COLUMN "table_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "staff_notifications_staff_id_idx" ON "staff_notifications" USING btree ("staff_id");--> statement-breakpoint

-- sync_cursors/sync_operations: columns the domain model added after 0013.
ALTER TABLE "sync_cursors" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "sync_operations" ADD COLUMN "conflict_resolution" text;
