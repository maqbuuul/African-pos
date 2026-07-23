-- P13 — CRM + Loyalty (docs/prd/13-crm-loyalty.md, BUILD_WORKFLOW.md P13).
-- Adds: customers, customer_identities, customer_tags, loyalty_accounts,
-- loyalty_events, gift_cards, customer_credit_accounts, customer_feedback.
-- RLS on all tables: same pattern as 0000_shared_foundation.sql.
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"phone" text,
	"email" text,
	"first_name" text,
	"last_name" text,
	"notes" text,
	"allergy_notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_status_check" CHECK ("customers"."status" in ('active', 'inactive', 'merged'))
);
--> statement-breakpoint
CREATE TABLE "customer_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"identity_type" text NOT NULL,
	"identity_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tags_customer_id_tag_key" UNIQUE("customer_id","tag")
);
--> statement-breakpoint
CREATE TABLE "loyalty_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"tier" text DEFAULT 'bronze' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_accounts_tier_check" CHECK ("loyalty_accounts"."tier" in ('bronze', 'silver', 'gold', 'platinum'))
);
--> statement-breakpoint
CREATE TABLE "loyalty_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"loyalty_account_id" uuid NOT NULL,
	"order_id" uuid,
	"event_type" text NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_events_event_type_check" CHECK ("loyalty_events"."event_type" in ('earn', 'redeem', 'adjust', 'expire'))
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"code" text NOT NULL,
	"initial_balance" integer NOT NULL,
	"current_balance" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_cards_status_check" CHECK ("gift_cards"."status" in ('active', 'redeemed', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "customer_credit_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"credit_limit" integer DEFAULT 0 NOT NULL,
	"current_balance" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_credit_accounts_status_check" CHECK ("customer_credit_accounts"."status" in ('active', 'frozen', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "customer_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"order_item_id" uuid,
	"source" text NOT NULL,
	"rating" integer,
	"comment" text,
	"external_review_id" text,
	"source_url" text,
	"sentiment" text,
	"is_negative" boolean DEFAULT false NOT NULL,
	"alert_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_feedback_external_review_id_key" UNIQUE("external_review_id")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_events" ADD CONSTRAINT "loyalty_events_loyalty_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("loyalty_account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credit_accounts" ADD CONSTRAINT "customer_credit_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_credit_accounts" ADD CONSTRAINT "customer_credit_accounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_organization_id_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_identities_organization_id_idx" ON "customer_identities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_identities_customer_id_idx" ON "customer_identities" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_identities_type_value_key" ON "customer_identities" USING btree ("identity_type", "identity_value");--> statement-breakpoint
CREATE INDEX "customer_tags_organization_id_idx" ON "customer_tags" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_tags_customer_id_idx" ON "customer_tags" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_accounts_organization_id_idx" ON "loyalty_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_customer_id_key" ON "loyalty_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_events_organization_id_idx" ON "loyalty_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "loyalty_events_loyalty_account_id_idx" ON "loyalty_events" USING btree ("loyalty_account_id");--> statement-breakpoint
CREATE INDEX "loyalty_events_created_at_idx" ON "loyalty_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gift_cards_organization_id_idx" ON "gift_cards" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards" USING btree ("code");--> statement-breakpoint
CREATE INDEX "customer_credit_accounts_organization_id_idx" ON "customer_credit_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_credit_accounts_customer_id_key" ON "customer_credit_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_organization_id_idx" ON "customer_feedback" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_location_id_idx" ON "customer_feedback" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_customer_id_idx" ON "customer_feedback" USING btree ("customer_id");--> statement-breakpoint
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON "customers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER loyalty_accounts_set_updated_at BEFORE UPDATE ON "loyalty_accounts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER gift_cards_set_updated_at BEFORE UPDATE ON "gift_cards" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER customer_credit_accounts_set_updated_at BEFORE UPDATE ON "customer_credit_accounts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customers_tenant_isolation ON "customers" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "customer_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_identities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customer_identities_tenant_isolation ON "customer_identities" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "customer_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customer_tags_tenant_isolation ON "customer_tags" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY loyalty_accounts_tenant_isolation ON "loyalty_accounts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "loyalty_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loyalty_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY loyalty_events_tenant_isolation ON "loyalty_events" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "gift_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gift_cards" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gift_cards_tenant_isolation ON "gift_cards" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "customer_credit_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_credit_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customer_credit_accounts_tenant_isolation ON "customer_credit_accounts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
ALTER TABLE "customer_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_feedback" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customer_feedback_tenant_isolation ON "customer_feedback" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
