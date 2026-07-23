-- P12 — Staff Attendance (docs/prd/12-staff-attendance.md, BUILD_WORKFLOW.md P12).
-- Adds: staff_attendance table for clock-in/out and break tracking.
-- RLS: tenant-isolation policy on the single table.
CREATE TABLE "staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"clock_in" timestamp with time zone DEFAULT now() NOT NULL,
	"clock_out" timestamp with time zone,
	"status" text DEFAULT 'clocked_in' NOT NULL,
	"break_start" timestamp with time zone,
	"break_end" timestamp with time zone,
	"notes" text,
	"recorded_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_attendance_status_check" CHECK ("staff_attendance"."status" in ('clocked_in', 'on_break', 'clocked_out'))
);
--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_attendance_organization_id_idx" ON "staff_attendance" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_location_id_idx" ON "staff_attendance" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_staff_id_idx" ON "staff_attendance" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_clock_in_idx" ON "staff_attendance" USING btree ("clock_in");--> statement-breakpoint
CREATE TRIGGER staff_attendance_set_updated_at BEFORE UPDATE ON "staff_attendance" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE "staff_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_attendance" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY staff_attendance_tenant_isolation ON "staff_attendance" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
