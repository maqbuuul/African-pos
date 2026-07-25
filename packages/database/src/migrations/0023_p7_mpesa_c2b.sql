CREATE TABLE "mpesa_c2b_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"trans_type" text NOT NULL,
	"trans_id" text NOT NULL,
	"trans_time" timestamp with time zone NOT NULL,
	"trans_amount" integer NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"business_short_code" text NOT NULL,
	"bill_ref_number" text,
	"invoice_number" text,
	"org_account_balance" text,
	"msisdn" text NOT NULL,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"matched_bill_id" uuid,
	"matched_payment_id" uuid,
	"matched_by_actor_id" uuid,
	"matched_at" timestamp with time zone,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mpesa_c2b_transactions_org_trans_id_key" UNIQUE("organization_id","trans_id"),
	CONSTRAINT "mpesa_c2b_transactions_trans_amount_check" CHECK ("mpesa_c2b_transactions"."trans_amount" > 0),
	CONSTRAINT "mpesa_c2b_transactions_currency_len_check" CHECK (char_length("mpesa_c2b_transactions"."currency") = 3),
	CONSTRAINT "mpesa_c2b_transactions_status_check" CHECK ("mpesa_c2b_transactions"."status" in ('unmatched', 'matched', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_provider_check";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_provider_check";--> statement-breakpoint
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_provider_check";--> statement-breakpoint
ALTER TABLE "mpesa_c2b_transactions" ADD CONSTRAINT "mpesa_c2b_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_c2b_transactions" ADD CONSTRAINT "mpesa_c2b_transactions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_c2b_transactions" ADD CONSTRAINT "mpesa_c2b_transactions_matched_bill_id_bills_id_fk" FOREIGN KEY ("matched_bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_c2b_transactions" ADD CONSTRAINT "mpesa_c2b_transactions_matched_payment_id_payments_id_fk" FOREIGN KEY ("matched_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mpesa_c2b_transactions_organization_id_idx" ON "mpesa_c2b_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mpesa_c2b_transactions_location_id_idx" ON "mpesa_c2b_transactions" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "mpesa_c2b_transactions_status_idx" ON "mpesa_c2b_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mpesa_c2b_transactions_matched_bill_id_idx" ON "mpesa_c2b_transactions" USING btree ("matched_bill_id");--> statement-breakpoint
ALTER TABLE "mpesa_c2b_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mpesa_c2b_transactions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mpesa_c2b_transactions_tenant_isolation ON "mpesa_c2b_transactions" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
CREATE TRIGGER mpesa_c2b_transactions_set_updated_at BEFORE UPDATE ON "mpesa_c2b_transactions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_provider_check" CHECK ("payment_intents"."provider" in ('none', 'mpesa_daraja', 'paystack', 'airtel_money_api', 'stripe', 'flutterwave', 'pesapal', 'manual', 'uber_eats', 'glovo', 'bolt_food'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_check" CHECK ("payments"."provider" in ('none', 'mpesa_daraja', 'paystack', 'airtel_money_api', 'stripe', 'flutterwave', 'pesapal', 'manual', 'uber_eats', 'glovo', 'bolt_food'));--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_provider_check" CHECK ("refunds"."provider" in ('none', 'mpesa_daraja', 'paystack', 'airtel_money_api', 'stripe', 'flutterwave', 'pesapal', 'manual', 'uber_eats', 'glovo', 'bolt_food'));