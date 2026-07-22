CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"allocated_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_items_bill_id_order_item_id_key" UNIQUE("bill_id","order_item_id"),
	CONSTRAINT "bill_items_allocated_amount_check" CHECK ("bill_items"."allocated_amount" >= 0),
	CONSTRAINT "bill_items_currency_len_check" CHECK (char_length("bill_items"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"bill_number" integer NOT NULL,
	"split_method" text,
	"status" text DEFAULT 'open' NOT NULL,
	"subtotal_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"service_charge_amount" integer DEFAULT 0 NOT NULL,
	"tip_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_order_id_bill_number_key" UNIQUE("order_id","bill_number"),
	CONSTRAINT "bills_currency_len_check" CHECK (char_length("bills"."currency") = 3),
	CONSTRAINT "bills_status_check" CHECK ("bills"."status" in ('open', 'payment_pending', 'paid', 'partially_refunded', 'refunded', 'voided')),
	CONSTRAINT "bills_split_method_check" CHECK ("bills"."split_method" in ('by_item', 'by_seat', 'evenly'))
);
--> statement-breakpoint
CREATE TABLE "order_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"amount_applied" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text,
	"applied_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_discounts_value_check" CHECK ("order_discounts"."discount_value" > 0),
	CONSTRAINT "order_discounts_amount_applied_check" CHECK ("order_discounts"."amount_applied" >= 0),
	CONSTRAINT "order_discounts_currency_len_check" CHECK (char_length("order_discounts"."currency") = 3),
	CONSTRAINT "order_discounts_type_check" CHECK ("order_discounts"."discount_type" in ('percentage', 'fixed'))
);
--> statement-breakpoint
CREATE TABLE "order_item_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"modifier_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"price_delta_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_modifiers_currency_len_check" CHECK (char_length("order_item_modifiers"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"local_name_snapshot" text,
	"seat_number" integer,
	"course" text,
	"kitchen_note" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_amount" integer NOT NULL,
	"modifiers_price_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"tax_category_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"void_reason" text,
	"comp_reason" text,
	"resolved_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_currency_len_check" CHECK (char_length("order_items"."currency") = 3),
	CONSTRAINT "order_items_status_check" CHECK ("order_items"."status" in ('draft', 'sent', 'accepted', 'in_progress', 'ready', 'served', 'void_requested', 'voided', 'comped'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"table_id" uuid,
	"customer_id" uuid,
	"staff_id" uuid,
	"channel" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"subtotal_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"service_charge_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_currency_len_check" CHECK (char_length("orders"."currency") = 3),
	CONSTRAINT "orders_channel_check" CHECK ("orders"."channel" in ('pos', 'qr_table', 'kiosk', 'whatsapp', 'online', 'shopify', 'woocommerce', 'uber_eats', 'glovo', 'bolt_food')),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('draft', 'open', 'sent_to_kitchen', 'partially_ready', 'ready', 'served', 'bill_requested', 'payment_pending', 'paid', 'voided', 'refunded'))
);
--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_modifier_id_modifiers_id_fk" FOREIGN KEY ("modifier_id") REFERENCES "public"."modifiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_items_organization_id_idx" ON "bill_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_items_order_item_id_idx" ON "bill_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "bills_organization_id_idx" ON "bills" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bills_location_id_idx" ON "bills" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "bills_order_id_idx" ON "bills" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_discounts_organization_id_idx" ON "order_discounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "order_discounts_order_id_idx" ON "order_discounts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_modifiers_organization_id_idx" ON "order_item_modifiers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "order_item_modifiers_order_item_id_idx" ON "order_item_modifiers" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_organization_id_idx" ON "order_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "order_items_location_id_idx" ON "order_items" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_status_idx" ON "order_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_organization_id_idx" ON "orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "orders_location_id_idx" ON "orders" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "orders_table_id_idx" ON "orders" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "orders_staff_id_idx" ON "orders" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
--> statement-breakpoint

-- updated_at triggers, reusing set_updated_at() from 0000_shared_foundation.sql.
-- bill_items/order_item_modifiers/order_discounts have no updated_at column —
-- they're append-only detail/join rows (same reasoning as table_merges).
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON "orders" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER order_items_set_updated_at BEFORE UPDATE ON "order_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER bills_set_updated_at BEFORE UPDATE ON "bills" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration,
-- hand-written for the same reason as 0000/0002/0004 (drizzle-kit doesn't
-- codegen RLS). pos_app already has SELECT/INSERT/UPDATE/DELETE via the ALTER
-- DEFAULT PRIVILEGES grant set in 0000_shared_foundation.sql.
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY orders_tenant_isolation ON "orders" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY order_items_tenant_isolation ON "order_items" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "order_item_modifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY order_item_modifiers_tenant_isolation ON "order_item_modifiers" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "order_discounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_discounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY order_discounts_tenant_isolation ON "order_discounts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bills" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY bills_tenant_isolation ON "bills" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "bill_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY bill_items_tenant_isolation ON "bill_items" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());