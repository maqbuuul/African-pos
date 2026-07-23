-- P10 — Allow public table lookup by qr_slug without tenant context.
-- The existing policy only allows SELECT when organization_id matches the
-- session variable, but the public /public/table-sessions endpoint needs to
-- look up a table by qr_slug before any authentication occurs.
-- --> statement-breakpoint
DROP POLICY IF EXISTS "restaurant_tables_tenant_isolation" ON "restaurant_tables";
--> statement-breakpoint
CREATE POLICY "restaurant_tables_select" ON "restaurant_tables" FOR SELECT
  USING (
    (app_current_organization_id() IS NULL)
    OR
    ("organization_id" = app_current_organization_id())
  );
--> statement-breakpoint
CREATE POLICY "restaurant_tables_insert" ON "restaurant_tables" FOR INSERT
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
CREATE POLICY "restaurant_tables_update" ON "restaurant_tables" FOR UPDATE
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
CREATE POLICY "restaurant_tables_delete" ON "restaurant_tables" FOR DELETE
  USING ("organization_id" = app_current_organization_id());
