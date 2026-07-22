-- P9 — Receipts + Notifications (docs/prd/09-receipts-notifications.md, BUILD_WORKFLOW.md P9).
-- Adds: receipts (receipt generation + delivery status),
-- tax_compliance_submissions (per-country fiscal submission tracking),
-- notification_preferences (staff/customer channel + quiet-hours config).
-- RLS on all tenant-scoped tables; updated_at triggers on mutable tables.
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"content" jsonb NOT NULL,
	"preferred_channel" text,
	"delivery_status" jsonb DEFAULT '{}' NOT NULL,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_org_receipt_number_key" UNIQUE("organization_id", "receipt_number"),
	CONSTRAINT "receipts_preferred_channel_check" CHECK ("receipts"."preferred_channel" in ('print', 'whatsapp', 'sms', 'email', 'pdf'))
);
--> statement-breakpoint
CREATE TABLE "tax_compliance_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"country" text NOT NULL,
	"provider" text NOT NULL,
	"submission_status" text DEFAULT 'queued' NOT NULL,
	"provider_reference" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error_message" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_compliance_submissions_country_len_check" CHECK (char_length("tax_compliance_submissions"."country") = 2),
	CONSTRAINT "tax_compliance_submissions_provider_check" CHECK ("tax_compliance_submissions"."provider" in ('kra_etims', 'firs', 'sars')),
	CONSTRAINT "tax_compliance_submissions_status_check" CHECK ("tax_compliance_submissions"."submission_status" in ('queued', 'sent', 'confirmed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel_preferences" jsonb DEFAULT '{}' NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"opted_out" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_subject_key" UNIQUE("subject_type", "subject_id"),
	CONSTRAINT "notification_preferences_subject_type_check" CHECK ("notification_preferences"."subject_type" in ('staff', 'customer'))
);
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" ADD CONSTRAINT "tax_compliance_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" ADD CONSTRAINT "tax_compliance_submissions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" ADD CONSTRAINT "tax_compliance_submissions_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_organization_id_idx" ON "receipts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "receipts_location_id_idx" ON "receipts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "receipts_order_id_idx" ON "receipts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "receipts_bill_id_idx" ON "receipts" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "tax_compliance_submissions_organization_id_idx" ON "tax_compliance_submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tax_compliance_submissions_receipt_id_idx" ON "tax_compliance_submissions" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "tax_compliance_submissions_status_idx" ON "tax_compliance_submissions" USING btree ("submission_status");--> statement-breakpoint
CREATE INDEX "notification_preferences_organization_id_idx" ON "notification_preferences" USING btree ("organization_id");--> statement-breakpoint

-- updated_at triggers for mutable tables (tax_compliance_submissions is mutable for status updates)
CREATE TRIGGER receipts_set_updated_at BEFORE UPDATE ON "receipts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER tax_compliance_submissions_set_updated_at BEFORE UPDATE ON "tax_compliance_submissions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- notification_preferences uses manual updated_at through the NestJS service

-- Row-Level Security for every tenant-scoped table added in this migration.
ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receipts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY receipts_tenant_isolation ON "receipts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "tax_compliance_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tax_compliance_submissions_tenant_isolation ON "tax_compliance_submissions" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY notification_preferences_tenant_isolation ON "notification_preferences" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
