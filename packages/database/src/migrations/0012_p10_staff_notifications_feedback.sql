-- P10 — Staff notifications and customer feedback tables
-- Adds: staff_notifications (waiter requests, bill requests, etc.)
--        customer_feedback (ratings and comments on order items)

CREATE TABLE IF NOT EXISTS "staff_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "table_id" uuid NOT NULL REFERENCES "restaurant_tables"("id") ON DELETE RESTRICT,
  "notification_type" text NOT NULL DEFAULT 'waiter_request',
  "reason" text,
  "status" text NOT NULL DEFAULT 'pending',
  "acknowledged_by_actor_id" uuid,
  "acknowledged_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "staff_notifications_organization_id_idx" ON "staff_notifications" ("organization_id");
--> statement-breakpoint
CREATE INDEX "staff_notifications_table_id_idx" ON "staff_notifications" ("table_id");
--> statement-breakpoint
CREATE INDEX "staff_notifications_status_idx" ON "staff_notifications" ("status");
--> statement-breakpoint
CREATE INDEX "staff_notifications_location_id_idx" ON "staff_notifications" ("location_id");
--> statement-breakpoint
ALTER TABLE "staff_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "staff_notifications_tenant_isolation" ON "staff_notifications"
  AS PERMISSIVE FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE RESTRICT,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "customer_feedback_organization_id_idx" ON "customer_feedback" ("organization_id");
--> statement-breakpoint
CREATE INDEX "customer_feedback_order_item_id_idx" ON "customer_feedback" ("order_item_id");
--> statement-breakpoint
CREATE INDEX "customer_feedback_product_id_idx" ON "customer_feedback" ("product_id");
--> statement-breakpoint
CREATE INDEX "customer_feedback_location_id_idx" ON "customer_feedback" ("location_id");
--> statement-breakpoint
ALTER TABLE "customer_feedback" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "customer_feedback_tenant_isolation" ON "customer_feedback"
  AS PERMISSIVE FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
