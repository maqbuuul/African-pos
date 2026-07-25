-- Fix: the P14 Reports & BI tables (events, report_snapshots,
-- daily_location_metrics, product_sales_metrics, staff_performance_metrics —
-- 0015_p14_reports_bi.sql) were created with organization_id NOT NULL but no
-- Row-Level Security policy, the only tenant tables in the schema without one.
-- ENGINEERING_CHARTER.md requires every tenant-scoped table to get RLS in the
-- same migration that creates it; these five never did. Without it, a query
-- bug (or a missing WHERE organization_id = ...) anywhere in the reports/
-- analytics module could return every organization's data, not just the
-- caller's — same pattern as every other tenant_isolation policy below.

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY events_tenant_isolation ON "events" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "report_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "report_snapshots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY report_snapshots_tenant_isolation ON "report_snapshots" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "daily_location_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_location_metrics" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY daily_location_metrics_tenant_isolation ON "daily_location_metrics" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "product_sales_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_sales_metrics" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY product_sales_metrics_tenant_isolation ON "product_sales_metrics" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "staff_performance_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_performance_metrics" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY staff_performance_metrics_tenant_isolation ON "staff_performance_metrics" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
