-- P8 — Shift + Cash Drawer (docs/prd/08-shift-cash-drawer.md, BUILD_WORKFLOW.md P8).
-- Adds: shifts (shift lifecycle), cash_drawer_sessions (float + counted figures),
-- cash_drawer_adjustments (mid-shift ledger, append-only).
-- expected_amount is NOT a stored column — it is computed fresh from the
-- payments/refunds/tips tables by ShiftService on every read, avoiding any
-- staleness or update-hook coupling with the P7 payments module.
-- RLS on all tables, updated_at triggers on shifts and cash_drawer_sessions
-- (adjustments are immutable after insert, so no trigger needed).
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"device_id" uuid,
	"opened_by_staff_id" uuid NOT NULL,
	"closed_by_actor_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"starting_cash_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"close_report" jsonb,
	"variance_reason" text,
	"variance_acknowledged_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_starting_cash_amount_check" CHECK ("shifts"."starting_cash_amount" >= 0),
	CONSTRAINT "shifts_currency_len_check" CHECK (char_length("shifts"."currency") = 3),
	CONSTRAINT "shifts_status_check" CHECK ("shifts"."status" in ('draft', 'open', 'closing', 'closed', 'reconciled'))
);
--> statement-breakpoint
CREATE TABLE "cash_drawer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"starting_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"counted_amount" integer,
	"denomination_count" jsonb,
	"change_error_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_drawer_sessions_shift_id_key" UNIQUE("shift_id"),
	CONSTRAINT "cash_drawer_sessions_starting_amount_check" CHECK ("cash_drawer_sessions"."starting_amount" >= 0),
	CONSTRAINT "cash_drawer_sessions_currency_len_check" CHECK (char_length("cash_drawer_sessions"."currency") = 3),
	CONSTRAINT "cash_drawer_sessions_status_check" CHECK ("cash_drawer_sessions"."status" in ('open', 'counted', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "cash_drawer_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text NOT NULL,
	"adjusted_by_actor_id" uuid NOT NULL,
	"approved_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_drawer_adjustments_amount_check" CHECK ("cash_drawer_adjustments"."amount" > 0),
	CONSTRAINT "cash_drawer_adjustments_currency_len_check" CHECK (char_length("cash_drawer_adjustments"."currency") = 3),
	CONSTRAINT "cash_drawer_adjustments_direction_check" CHECK ("cash_drawer_adjustments"."direction" in ('in', 'out'))
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_staff_id_staff_id_fk" FOREIGN KEY ("opened_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_adjustments" ADD CONSTRAINT "cash_drawer_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_adjustments" ADD CONSTRAINT "cash_drawer_adjustments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_adjustments" ADD CONSTRAINT "cash_drawer_adjustments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_drawer_adjustments" ADD CONSTRAINT "cash_drawer_adjustments_session_id_cash_drawer_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cash_drawer_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shifts_organization_id_idx" ON "shifts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shifts_location_id_idx" ON "shifts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "shifts_device_id_idx" ON "shifts" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "shifts_opened_by_staff_id_idx" ON "shifts" USING btree ("opened_by_staff_id");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shifts_opened_at_idx" ON "shifts" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "cash_drawer_sessions_organization_id_idx" ON "cash_drawer_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cash_drawer_sessions_location_id_idx" ON "cash_drawer_sessions" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "cash_drawer_sessions_shift_id_idx" ON "cash_drawer_sessions" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "cash_drawer_adjustments_organization_id_idx" ON "cash_drawer_adjustments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cash_drawer_adjustments_location_id_idx" ON "cash_drawer_adjustments" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "cash_drawer_adjustments_shift_id_idx" ON "cash_drawer_adjustments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "cash_drawer_adjustments_session_id_idx" ON "cash_drawer_adjustments" USING btree ("session_id");
--> statement-breakpoint

-- updated_at triggers, reusing set_updated_at() from 0000_shared_foundation.sql.
-- cash_drawer_adjustments is intentionally excluded: adjustment rows are immutable after creation.
CREATE TRIGGER shifts_set_updated_at BEFORE UPDATE ON "shifts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER cash_drawer_sessions_set_updated_at BEFORE UPDATE ON "cash_drawer_sessions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration,
-- hand-written for the same reason as earlier phases: drizzle-kit doesn't
-- codegen RLS and tenant isolation is not a follow-up task.
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shifts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY shifts_tenant_isolation ON "shifts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "cash_drawer_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cash_drawer_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cash_drawer_sessions_tenant_isolation ON "cash_drawer_sessions" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "cash_drawer_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cash_drawer_adjustments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cash_drawer_adjustments_tenant_isolation ON "cash_drawer_adjustments" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
