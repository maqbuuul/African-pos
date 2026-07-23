-- P11 -- Inventory, Recipes & Purchasing (docs/prd/12-inventory-recipes-purchasing.md, BUILD_WORKFLOW.md P12).
-- Adds: suppliers, inventory_items, stock_locations, stock_levels, stock_movements,
-- purchase_orders, purchase_order_items, goods_receipts, stock_counts,
-- stock_adjustments, recipes, recipe_ingredients, wastage_events.
-- RLS on all tenant-scoped tables; updated_at triggers on mutable tables.
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"received_by_actor_id" uuid NOT NULL,
	"notes" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"item_type" text DEFAULT 'ingredient' NOT NULL,
	"sku" text,
	"barcode" text,
	"unit" text NOT NULL,
	"category" text,
	"preferred_supplier_id" uuid,
	"reorder_point" integer,
	"reorder_quantity" integer,
	"unit_cost" integer,
	"currency" text DEFAULT 'KES' NOT NULL,
	"track_stock" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_item_type_check" CHECK ("inventory_items"."item_type" in ('ingredient', 'packaging', 'supply', 'finished_good', 'hotel_supply', 'other')),
	CONSTRAINT "inventory_items_unit_check" CHECK ("inventory_items"."unit" in ('piece', 'kg', 'g', 'lb', 'oz', 'l', 'ml', 'cup', 'tbsp', 'tsp', 'dozen', 'case', 'bag', 'box', 'bottle', 'can', 'crate', 'portion'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"opted_out" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_subject_key" UNIQUE("subject_type","subject_id"),
	CONSTRAINT "notification_preferences_subject_type_check" CHECK ("notification_preferences"."subject_type" in ('staff', 'customer'))
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"ordered_quantity" real NOT NULL,
	"received_quantity" real DEFAULT 0 NOT NULL,
	"unit" text NOT NULL,
	"expected_unit_cost" integer,
	"actual_unit_cost" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"expected_delivery_date" timestamp with time zone,
	"notes" text,
	"total_amount" integer DEFAULT 0,
	"currency" text DEFAULT 'KES' NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_org_order_number_key" UNIQUE("organization_id","order_number"),
	CONSTRAINT "purchase_orders_status_check" CHECK ("purchase_orders"."status" in ('draft', 'sent', 'partially_received', 'received', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"content" jsonb NOT NULL,
	"preferred_channel" text,
	"delivery_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_org_receipt_number_key" UNIQUE("organization_id","receipt_number"),
	CONSTRAINT "receipts_preferred_channel_check" CHECK ("receipts"."preferred_channel" in ('print', 'whatsapp', 'sms', 'email', 'pdf'))
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_product_version_key" UNIQUE("product_id","version_number"),
	CONSTRAINT "recipes_status_check" CHECK ("recipes"."status" in ('draft', 'active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"stock_location_id" uuid,
	"stock_count_id" uuid,
	"expected_quantity" real NOT NULL,
	"counted_quantity" real NOT NULL,
	"variance" real NOT NULL,
	"reason" text NOT NULL,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"adjusted_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"stock_location_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"counted_by_actor_id" uuid NOT NULL,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_counts_status_check" CHECK ("stock_counts"."status" in ('open', 'submitted', 'approved'))
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"stock_location_id" uuid,
	"quantity" real DEFAULT 0 NOT NULL,
	"unit" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_levels_item_stock_loc_key" UNIQUE("inventory_item_id","stock_location_id")
);
--> statement-breakpoint
CREATE TABLE "stock_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"stock_location_id" uuid,
	"movement_type" text NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"unit_cost" integer,
	"reference_type" text,
	"reference_id" text,
	"reason" text,
	"transfer_reference_id" text,
	"moved_by_actor_id" uuid NOT NULL,
	"moved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_movement_type_check" CHECK ("stock_movements"."movement_type" in ('receive', 'sale', 'recipe_deduction', 'transfer_out', 'transfer_in', 'adjustment', 'wastage', 'return'))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"payment_terms" text,
	"credit_limit" integer,
	"currency" text DEFAULT 'KES' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "wastage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"stock_location_id" uuid,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"reason" text NOT NULL,
	"cost_impact" integer,
	"recorded_by_actor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stock_count_id_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" ADD CONSTRAINT "tax_compliance_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" ADD CONSTRAINT "tax_compliance_submissions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_compliance_submissions" ADD CONSTRAINT "tax_compliance_submissions_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_events" ADD CONSTRAINT "wastage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_events" ADD CONSTRAINT "wastage_events_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_events" ADD CONSTRAINT "wastage_events_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_events" ADD CONSTRAINT "wastage_events_stock_location_id_stock_locations_id_fk" FOREIGN KEY ("stock_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goods_receipts_organization_id_idx" ON "goods_receipts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_po_id_idx" ON "goods_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "inventory_items_organization_id_idx" ON "inventory_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inventory_items_location_id_idx" ON "inventory_items" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "inventory_items_sku_idx" ON "inventory_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "notification_preferences_organization_id_idx" ON "notification_preferences" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_po_id_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_item_id_idx" ON "purchase_order_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_organization_id_idx" ON "purchase_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_location_id_idx" ON "purchase_orders" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "receipts_organization_id_idx" ON "receipts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "receipts_location_id_idx" ON "receipts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "receipts_order_id_idx" ON "receipts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "receipts_bill_id_idx" ON "receipts" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_item_id_idx" ON "recipe_ingredients" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "recipes_organization_id_idx" ON "recipes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "recipes_product_id_idx" ON "recipes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_organization_id_idx" ON "stock_adjustments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_item_id_idx" ON "stock_adjustments" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_count_id_idx" ON "stock_adjustments" USING btree ("stock_count_id");--> statement-breakpoint
CREATE INDEX "stock_counts_organization_id_idx" ON "stock_counts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_counts_location_id_idx" ON "stock_counts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "stock_levels_organization_id_idx" ON "stock_levels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_levels_item_location_idx" ON "stock_levels" USING btree ("inventory_item_id","stock_location_id");--> statement-breakpoint
CREATE INDEX "stock_locations_organization_id_idx" ON "stock_locations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_locations_location_id_idx" ON "stock_locations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "stock_movements_organization_id_idx" ON "stock_movements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_movements_location_id_idx" ON "stock_movements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_id_idx" ON "stock_movements" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "stock_movements_moved_at_idx" ON "stock_movements" USING btree ("moved_at");--> statement-breakpoint
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "suppliers_location_id_idx" ON "suppliers" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "tax_compliance_submissions_organization_id_idx" ON "tax_compliance_submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tax_compliance_submissions_receipt_id_idx" ON "tax_compliance_submissions" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "tax_compliance_submissions_status_idx" ON "tax_compliance_submissions" USING btree ("submission_status");--> statement-breakpoint
CREATE INDEX "wastage_events_organization_id_idx" ON "wastage_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "wastage_events_location_id_idx" ON "wastage_events" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "wastage_events_item_id_idx" ON "wastage_events" USING btree ("inventory_item_id");
-- updated_at triggers for mutable tables
CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER inventory_items_set_updated_at BEFORE UPDATE ON "inventory_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER stock_locations_set_updated_at BEFORE UPDATE ON "stock_locations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER stock_levels_set_updated_at BEFORE UPDATE ON "stock_levels" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER stock_movements_set_updated_at BEFORE UPDATE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER purchase_orders_set_updated_at BEFORE UPDATE ON "purchase_orders" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER purchase_order_items_set_updated_at BEFORE UPDATE ON "purchase_order_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER goods_receipts_set_updated_at BEFORE UPDATE ON "goods_receipts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER stock_counts_set_updated_at BEFORE UPDATE ON "stock_counts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER stock_adjustments_set_updated_at BEFORE UPDATE ON "stock_adjustments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER wastage_events_set_updated_at BEFORE UPDATE ON "wastage_events" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration.
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY suppliers_tenant_isolation ON "suppliers" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY inventory_items_tenant_isolation ON "inventory_items" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "stock_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_locations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY stock_locations_tenant_isolation ON "stock_locations" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY stock_levels_tenant_isolation ON "stock_levels" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY stock_movements_tenant_isolation ON "stock_movements" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY purchase_orders_tenant_isolation ON "purchase_orders" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "purchase_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchase_order_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY purchase_order_items_tenant_isolation ON "purchase_order_items" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "goods_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goods_receipts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY goods_receipts_tenant_isolation ON "goods_receipts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "stock_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_counts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY stock_counts_tenant_isolation ON "stock_counts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "stock_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_adjustments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY stock_adjustments_tenant_isolation ON "stock_adjustments" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "wastage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wastage_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY wastage_events_tenant_isolation ON "wastage_events" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
