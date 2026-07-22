CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"device_id" uuid,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_actor_type_check" CHECK ("auth_sessions"."actor_type" in ('user', 'staff', 'system'))
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_organization_id_idx" ON "auth_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_actor_idx" ON "auth_sessions" USING btree ("actor_type","actor_id");--> statement-breakpoint

-- Row-Level Security for the new tenant-scoped table, hand-written for the
-- same reason as every other table's RLS in 0000_shared_foundation.sql
-- (drizzle-kit doesn't codegen RLS yet). pos_app picks up SELECT/INSERT/
-- UPDATE/DELETE via the ALTER DEFAULT PRIVILEGES grant already set for role
-- pos_user in that migration, so no GRANT statement is needed here.
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_sessions_tenant_isolation ON "auth_sessions" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());