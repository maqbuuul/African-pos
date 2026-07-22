CREATE TABLE "kds_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"assigned_staff_id" uuid,
	"is_expo" boolean DEFAULT false NOT NULL,
	"expected_prep_time_seconds" integer DEFAULT 900 NOT NULL,
	"recall_grace_seconds" integer DEFAULT 120 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kds_stations_expected_prep_time_seconds_check" CHECK ("kds_stations"."expected_prep_time_seconds" > 0),
	CONSTRAINT "kds_stations_recall_grace_seconds_check" CHECK ("kds_stations"."recall_grace_seconds" >= 0),
	CONSTRAINT "kds_stations_status_check" CHECK ("kds_stations"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "kitchen_ticket_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"local_name_snapshot" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"seat_number" integer,
	"course" text,
	"kitchen_note" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"recalled_at" timestamp with time zone,
	"void_requested_at" timestamp with time zone,
	"void_acknowledged_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitchen_ticket_items_quantity_check" CHECK ("kitchen_ticket_items"."quantity" > 0),
	CONSTRAINT "kitchen_ticket_items_status_check" CHECK ("kitchen_ticket_items"."status" in ('queued', 'accepted', 'in_progress', 'ready', 'void_requested', 'voided'))
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"table_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"fired_by_actor_id" uuid NOT NULL,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kitchen_tickets_status_check" CHECK ("kitchen_tickets"."status" in ('open', 'partially_ready', 'ready', 'voided'))
);
--> statement-breakpoint
ALTER TABLE "kds_stations" ADD CONSTRAINT "kds_stations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kds_stations" ADD CONSTRAINT "kds_stations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kds_stations" ADD CONSTRAINT "kds_stations_assigned_staff_id_staff_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_ticket_id_kitchen_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kitchen_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_station_id_kds_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."kds_stations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_station_id_kds_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."kds_stations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kds_stations_organization_id_idx" ON "kds_stations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kds_stations_location_id_idx" ON "kds_stations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "kds_stations_assigned_staff_id_idx" ON "kds_stations" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kds_stations_location_id_code_key" ON "kds_stations" USING btree ("location_id","code");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_organization_id_idx" ON "kitchen_ticket_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_location_id_idx" ON "kitchen_ticket_items" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_ticket_id_idx" ON "kitchen_ticket_items" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_station_id_idx" ON "kitchen_ticket_items" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_order_id_idx" ON "kitchen_ticket_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_order_item_id_idx" ON "kitchen_ticket_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_status_idx" ON "kitchen_ticket_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_organization_id_idx" ON "kitchen_tickets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_location_id_idx" ON "kitchen_tickets" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_station_id_idx" ON "kitchen_tickets" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_order_id_idx" ON "kitchen_tickets" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_status_idx" ON "kitchen_tickets" USING btree ("status");
--> statement-breakpoint

-- updated_at triggers, reusing set_updated_at() from 0000_shared_foundation.sql.
CREATE TRIGGER kds_stations_set_updated_at BEFORE UPDATE ON "kds_stations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER kitchen_tickets_set_updated_at BEFORE UPDATE ON "kitchen_tickets" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER kitchen_ticket_items_set_updated_at BEFORE UPDATE ON "kitchen_ticket_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration,
-- hand-written for the same reason as earlier phases: drizzle-kit doesn't
-- codegen RLS and tenant isolation is not a follow-up task.
ALTER TABLE "kds_stations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kds_stations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY kds_stations_tenant_isolation ON "kds_stations" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "kitchen_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY kitchen_tickets_tenant_isolation ON "kitchen_tickets" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "kitchen_ticket_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY kitchen_ticket_items_tenant_isolation ON "kitchen_ticket_items" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());