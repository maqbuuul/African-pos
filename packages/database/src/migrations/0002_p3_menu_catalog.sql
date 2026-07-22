CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"menu_id" uuid NOT NULL,
	"name" text NOT NULL,
	"local_name" text,
	"description" text,
	"default_kds_station" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_categories_status_check" CHECK ("menu_categories"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"day_part_windows" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menus_status_check" CHECK ("menus"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modifier_groups_select_check" CHECK ("modifier_groups"."min_select" >= 0 and "modifier_groups"."max_select" >= "modifier_groups"."min_select"),
	CONSTRAINT "modifier_groups_status_check" CHECK ("modifier_groups"."status" in ('active', 'discontinued'))
);
--> statement-breakpoint
CREATE TABLE "modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_delta" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modifiers_currency_len_check" CHECK (char_length("modifiers"."currency") = 3),
	CONSTRAINT "modifiers_status_check" CHECK ("modifiers"."status" in ('active', 'discontinued'))
);
--> statement-breakpoint
CREATE TABLE "product_modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_modifier_groups_product_id_modifier_group_id_key" UNIQUE("product_id","modifier_group_id")
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"reason" text,
	"changed_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_prices_currency_len_check" CHECK (char_length("product_prices"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"local_name" text,
	"description" text,
	"sku" text,
	"photo_url" text,
	"price_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"tax_category_id" uuid,
	"kds_station_override" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"auto_restore_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_currency_len_check" CHECK (char_length("products"."currency") = 3),
	CONSTRAINT "products_status_check" CHECK ("products"."status" in ('draft', 'active', 'seasonal', 'unavailable', 'discontinued', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_modifier_group_id_modifier_groups_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_modifier_group_id_modifier_groups_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_changed_by_staff_id_staff_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_categories_organization_id_idx" ON "menu_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "menu_categories_menu_id_idx" ON "menu_categories" USING btree ("menu_id");--> statement-breakpoint
CREATE INDEX "menus_organization_id_idx" ON "menus" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "menus_location_id_idx" ON "menus" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_organization_id_idx" ON "modifier_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "modifier_groups_location_id_idx" ON "modifier_groups" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "modifiers_organization_id_idx" ON "modifiers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "modifiers_modifier_group_id_idx" ON "modifiers" USING btree ("modifier_group_id");--> statement-breakpoint
CREATE INDEX "product_modifier_groups_organization_id_idx" ON "product_modifier_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_modifier_groups_product_id_idx" ON "product_modifier_groups" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_prices_organization_id_idx" ON "product_prices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_prices_product_id_idx" ON "product_prices" USING btree ("product_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "product_prices_active_key" ON "product_prices" USING btree ("product_id") WHERE "product_prices"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "products_organization_id_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "products_location_id_idx" ON "products" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_location_id_sku_key" ON "products" USING btree ("location_id","sku") WHERE "products"."sku" is not null;
--> statement-breakpoint

-- updated_at triggers, reusing the set_updated_at() function defined in
-- 0000_shared_foundation.sql (product_prices and product_modifier_groups
-- have no updated_at column — both are append-only/join tables).
CREATE TRIGGER menus_set_updated_at BEFORE UPDATE ON "menus" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER menu_categories_set_updated_at BEFORE UPDATE ON "menu_categories" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON "products" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER modifier_groups_set_updated_at BEFORE UPDATE ON "modifier_groups" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER modifiers_set_updated_at BEFORE UPDATE ON "modifiers" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration,
-- hand-written for the same reason as 0000_shared_foundation.sql (drizzle-kit
-- doesn't codegen RLS yet). pos_app already picked up SELECT/INSERT/UPDATE/
-- DELETE on these via the ALTER DEFAULT PRIVILEGES grant set in that
-- migration, so no GRANT statement is needed here.
ALTER TABLE "menus" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menus" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY menus_tenant_isolation ON "menus" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "menu_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY menu_categories_tenant_isolation ON "menu_categories" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY products_tenant_isolation ON "products" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "product_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_prices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY product_prices_tenant_isolation ON "product_prices" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifier_groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY modifier_groups_tenant_isolation ON "modifier_groups" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "modifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "modifiers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY modifiers_tenant_isolation ON "modifiers" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "product_modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY product_modifier_groups_tenant_isolation ON "product_modifier_groups" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

-- Postgres full-text search (PRD 03: "pg_trgm trigram index on product
-- create/update — name, local name, SKU"; ADR 0001 decision 8: Meilisearch
-- is not introduced at this phase). Trigram GIN indexes support both `ILIKE
-- '%term%'` and `similarity()`-ranked search without a separate search
-- service. No Drizzle DSL for operator-class-specific GIN indexes, so these
-- are hand-written like the RLS policies above.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_local_name_trgm_idx" ON "products" USING gin ("local_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_sku_trgm_idx" ON "products" USING gin ("sku" gin_trgm_ops);