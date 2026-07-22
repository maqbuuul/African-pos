CREATE TABLE "floor_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "floor_plans_status_check" CHECK ("floor_plans"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"floor_plan_id" uuid NOT NULL,
	"label" text NOT NULL,
	"section" text,
	"capacity" integer DEFAULT 4 NOT NULL,
	"shape" text DEFAULT 'square' NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"party_size" integer,
	"assigned_staff_id" uuid,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_tables_capacity_check" CHECK ("restaurant_tables"."capacity" > 0),
	CONSTRAINT "restaurant_tables_status_check" CHECK ("restaurant_tables"."status" in ('available', 'seated', 'ordered', 'food_ready', 'eating', 'bill_requested', 'payment_pending', 'paid', 'cleaning', 'reserved', 'blocked')),
	CONSTRAINT "restaurant_tables_shape_check" CHECK ("restaurant_tables"."shape" in ('square', 'round', 'rectangle'))
);
--> statement-breakpoint
CREATE TABLE "table_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"primary_table_id" uuid NOT NULL,
	"merged_table_id" uuid NOT NULL,
	"order_id" uuid,
	"merged_by_actor_id" uuid NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unmerged_by_actor_id" uuid,
	"unmerged_at" timestamp with time zone,
	CONSTRAINT "table_merges_distinct_tables_check" CHECK ("table_merges"."primary_table_id" <> "table_merges"."merged_table_id")
);
--> statement-breakpoint
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_floor_plan_id_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "public"."floor_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_assigned_staff_id_staff_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_merges" ADD CONSTRAINT "table_merges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_merges" ADD CONSTRAINT "table_merges_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_merges" ADD CONSTRAINT "table_merges_primary_table_id_restaurant_tables_id_fk" FOREIGN KEY ("primary_table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_merges" ADD CONSTRAINT "table_merges_merged_table_id_restaurant_tables_id_fk" FOREIGN KEY ("merged_table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "floor_plans_organization_id_idx" ON "floor_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "floor_plans_location_id_idx" ON "floor_plans" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "restaurant_tables_organization_id_idx" ON "restaurant_tables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restaurant_tables_location_id_idx" ON "restaurant_tables" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "restaurant_tables_floor_plan_id_idx" ON "restaurant_tables" USING btree ("floor_plan_id");--> statement-breakpoint
CREATE INDEX "restaurant_tables_status_idx" ON "restaurant_tables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "restaurant_tables_assigned_staff_id_idx" ON "restaurant_tables" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_location_id_label_key" ON "restaurant_tables" USING btree ("location_id","label");--> statement-breakpoint
CREATE INDEX "table_merges_organization_id_idx" ON "table_merges" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "table_merges_primary_table_id_idx" ON "table_merges" USING btree ("primary_table_id");--> statement-breakpoint
CREATE INDEX "table_merges_merged_table_id_idx" ON "table_merges" USING btree ("merged_table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_merges_active_merged_table_key" ON "table_merges" USING btree ("merged_table_id") WHERE "table_merges"."unmerged_at" is null;
--> statement-breakpoint

-- updated_at triggers, reusing set_updated_at() from 0000_shared_foundation.sql.
-- table_merges has no updated_at column (mergedAt/unmergedAt are the mutated
-- timestamps, same reasoning as product_prices being append-only-ish).
CREATE TRIGGER floor_plans_set_updated_at BEFORE UPDATE ON "floor_plans" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER restaurant_tables_set_updated_at BEFORE UPDATE ON "restaurant_tables" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration,
-- hand-written for the same reason as 0000/0002 (drizzle-kit doesn't codegen
-- RLS). pos_app already has SELECT/INSERT/UPDATE/DELETE via the ALTER
-- DEFAULT PRIVILEGES grant set in 0000_shared_foundation.sql.
ALTER TABLE "floor_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "floor_plans" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY floor_plans_tenant_isolation ON "floor_plans" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "restaurant_tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "restaurant_tables" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY restaurant_tables_tenant_isolation ON "restaurant_tables" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "table_merges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "table_merges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY table_merges_tenant_isolation ON "table_merges" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());