-- P7 — Payments Core (docs/prd/07-payments.md, BUILD_WORKFLOW.md P7).
-- Adds: integration_connections (shared credential store for all integrations),
-- payment_intents (every collection attempt), payments (confirmed ledger),
-- refunds (never deletes original payment), tips (staff attribution).
-- Idempotency enforced by UNIQUE(organization_id, idempotency_key) on both
-- payment_intents and payments — a retried request with the same key
-- returns the existing row without triggering a second provider call.
-- RLS on all tables: same pattern as 0000_shared_foundation.sql.
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"category" text NOT NULL,
	"provider" text NOT NULL,
	"credentials_encrypted" text NOT NULL,
	"metadata" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connections_category_check" CHECK ("integration_connections"."category" in ('payments', 'messaging', 'accounting', 'delivery', 'hospitality_channels', 'commerce', 'tax', 'hardware')),
	CONSTRAINT "integration_connections_status_check" CHECK ("integration_connections"."status" in ('active', 'inactive', 'error'))
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"method" text NOT NULL,
	"provider" text DEFAULT 'none' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_reference" text,
	"checkout_url" text,
	"customer_phone" text,
	"customer_email" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"processed_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_org_idempotency_key" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "payment_intents_amount_check" CHECK ("payment_intents"."amount" > 0),
	CONSTRAINT "payment_intents_currency_len_check" CHECK (char_length("payment_intents"."currency") = 3),
	CONSTRAINT "payment_intents_method_check" CHECK ("payment_intents"."method" in ('cash', 'mpesa', 'airtel_money', 'evc_plus', 'edahab', 'zaad', 'card', 'bank_transfer', 'card_terminal', 'loyalty_points', 'gift_card', 'customer_credit', 'external_platform')),
	CONSTRAINT "payment_intents_provider_check" CHECK ("payment_intents"."provider" in ('none', 'mpesa_daraja', 'paystack', 'airtel_money_api', 'stripe', 'flutterwave', 'manual', 'uber_eats', 'glovo', 'bolt_food')),
	CONSTRAINT "payment_intents_status_check" CHECK ("payment_intents"."status" in ('pending', 'processing', 'confirmed', 'failed', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"method" text NOT NULL,
	"provider" text DEFAULT 'none' NOT NULL,
	"provider_reference" text,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"change_given_amount" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_by_actor_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_org_idempotency_key" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_change_given_amount_check" CHECK ("payments"."change_given_amount" >= 0),
	CONSTRAINT "payments_currency_len_check" CHECK (char_length("payments"."currency") = 3),
	CONSTRAINT "payments_method_check" CHECK ("payments"."method" in ('cash', 'mpesa', 'airtel_money', 'evc_plus', 'edahab', 'zaad', 'card', 'bank_transfer', 'card_terminal', 'loyalty_points', 'gift_card', 'customer_credit', 'external_platform')),
	CONSTRAINT "payments_provider_check" CHECK ("payments"."provider" in ('none', 'mpesa_daraja', 'paystack', 'airtel_money_api', 'stripe', 'flutterwave', 'manual', 'uber_eats', 'glovo', 'bolt_food')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('confirmed', 'partially_refunded', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"method" text NOT NULL,
	"provider" text DEFAULT 'none' NOT NULL,
	"provider_reference" text,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_by_actor_id" uuid NOT NULL,
	"approved_by_actor_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_check" CHECK ("refunds"."amount" > 0),
	CONSTRAINT "refunds_currency_len_check" CHECK (char_length("refunds"."currency") = 3),
	CONSTRAINT "refunds_method_check" CHECK ("refunds"."method" in ('cash', 'mpesa', 'airtel_money', 'evc_plus', 'edahab', 'zaad', 'card', 'bank_transfer', 'card_terminal', 'loyalty_points', 'gift_card', 'customer_credit', 'external_platform')),
	CONSTRAINT "refunds_provider_check" CHECK ("refunds"."provider" in ('none', 'mpesa_daraja', 'paystack', 'airtel_money_api', 'stripe', 'flutterwave', 'manual', 'uber_eats', 'glovo', 'bolt_food')),
	CONSTRAINT "refunds_status_check" CHECK ("refunds"."status" in ('pending', 'confirmed', 'failed', 'requires_manual_settlement'))
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"staff_id" uuid,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tips_amount_check" CHECK ("tips"."amount" > 0),
	CONSTRAINT "tips_currency_len_check" CHECK (char_length("tips"."currency") = 3)
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_connections_organization_id_idx" ON "integration_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_connections_location_id_idx" ON "integration_connections" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "integration_connections_category_provider_idx" ON "integration_connections" USING btree ("category","provider");--> statement-breakpoint
-- Partial unique index for the org-wide (null location) case: Postgres treats
-- NULL as distinct in standard unique indexes, so two org-wide rows for the
-- same provider would not conflict without this explicit partial index.
CREATE UNIQUE INDEX "integration_connections_org_provider_null_loc_key" ON "integration_connections" USING btree ("organization_id","provider") WHERE "location_id" IS NULL;--> statement-breakpoint
-- Regular unique index handles location-specific connections (location_id IS NOT NULL).
CREATE UNIQUE INDEX "integration_connections_org_location_provider_key" ON "integration_connections" USING btree ("organization_id","location_id","provider") WHERE "location_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_intents_organization_id_idx" ON "payment_intents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_intents_location_id_idx" ON "payment_intents" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "payment_intents_order_id_idx" ON "payment_intents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_intents_bill_id_idx" ON "payment_intents" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_organization_id_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_location_id_idx" ON "payments" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_bill_id_idx" ON "payments" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "payments_payment_intent_id_idx" ON "payments" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_organization_id_idx" ON "refunds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "refunds_location_id_idx" ON "refunds" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_id_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tips_organization_id_idx" ON "tips" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tips_location_id_idx" ON "tips" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "tips_payment_id_idx" ON "tips" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "tips_bill_id_idx" ON "tips" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "tips_staff_id_idx" ON "tips" USING btree ("staff_id");
--> statement-breakpoint

-- updated_at triggers, reusing set_updated_at() from 0000_shared_foundation.sql.
-- tips is intentionally excluded: tip rows are immutable after creation.
CREATE TRIGGER integration_connections_set_updated_at BEFORE UPDATE ON "integration_connections" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER payment_intents_set_updated_at BEFORE UPDATE ON "payment_intents" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON "payments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON "refunds" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration,
-- hand-written for the same reason as earlier phases: drizzle-kit doesn't
-- codegen RLS and tenant isolation is not a follow-up task.
ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_connections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY integration_connections_tenant_isolation ON "integration_connections" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "payment_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_intents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY payment_intents_tenant_isolation ON "payment_intents" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY payments_tenant_isolation ON "payments" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY refunds_tenant_isolation ON "refunds" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "tips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tips" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tips_tenant_isolation ON "tips" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
