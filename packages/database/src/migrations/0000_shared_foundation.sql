CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"requested_by_staff_id" uuid NOT NULL,
	"approved_by_staff_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	CONSTRAINT "approval_requests_status_check" CHECK ("approval_requests"."status" in ('pending', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"device_id" uuid,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_actor_type_check" CHECK ("audit_logs"."actor_type" in ('user', 'staff', 'system'))
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"vertical" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_vertical_check" CHECK ("businesses"."vertical" in ('restaurant', 'hotel', 'retail')),
	CONSTRAINT "businesses_status_check" CHECK ("businesses"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"device_type" text NOT NULL,
	"platform" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_status_check" CHECK ("devices"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_organization_id_code_key" UNIQUE("organization_id","code"),
	CONSTRAINT "locations_country_len_check" CHECK (char_length("locations"."country") = 2),
	CONSTRAINT "locations_currency_len_check" CHECK (char_length("locations"."currency") = 3),
	CONSTRAINT "locations_status_check" CHECK ("locations"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"country" text NOT NULL,
	"default_currency" text NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_country_len_check" CHECK (char_length("organizations"."country") = 2),
	CONSTRAINT "organizations_currency_len_check" CHECK (char_length("organizations"."default_currency") = 3),
	CONSTRAINT "organizations_status_check" CHECK ("organizations"."status" in ('active', 'suspended', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"pin_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_status_check" CHECK ("staff"."status" in ('invited', 'active', 'suspended', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_roles_staff_id_role_id_location_id_key" UNIQUE("staff_id","role_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_staff_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('invited', 'active', 'suspended', 'deactivated'))
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_staff_id_staff_id_fk" FOREIGN KEY ("requested_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approved_by_staff_id_staff_id_fk" FOREIGN KEY ("approved_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_updated_by_staff_id_staff_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_organization_id_idx" ON "approval_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "businesses_organization_id_idx" ON "businesses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "devices_organization_id_idx" ON "devices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "devices_location_id_idx" ON "devices" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "locations_organization_id_idx" ON "locations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "locations_business_id_idx" ON "locations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "role_permissions_organization_id_idx" ON "role_permissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "roles_organization_id_idx" ON "roles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_system_name_key" ON "roles" USING btree ("name") WHERE "roles"."organization_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles" USING btree ("organization_id","name") WHERE "roles"."organization_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_organization_id_idx" ON "staff" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "staff_location_id_idx" ON "staff" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "staff_roles_organization_id_idx" ON "staff_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenant_settings_organization_id_idx" ON "tenant_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_settings_org_key_key" ON "tenant_settings" USING btree ("organization_id","key") WHERE "tenant_settings"."location_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_settings_org_location_key_key" ON "tenant_settings" USING btree ("organization_id","location_id","key") WHERE "tenant_settings"."location_id" is not null;--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
-- =============================================================================
-- Row-Level Security — hand-written, not drizzle-kit generated (see ADR 0001 /
-- ENGINEERING_CHARTER.md "Every tenant-scoped table gets a Postgres Row-Level
-- Security policy in the same migration that creates the table"). Drizzle's RLS
-- codegen support is not mature enough yet in the pinned drizzle-kit version to
-- trust for a security-critical layer that's easier to review as plain SQL
-- anyway. FORCE ROW LEVEL SECURITY is set on every tenant table so RLS applies
-- even to the table-owning role the API connects as — without it, RLS is
-- decorative for whichever role created the tables.
-- =============================================================================

-- Reads the tenant the current transaction is scoped to (set via
-- `SET LOCAL app.current_organization_id = '<uuid>'` by the API's tenant
-- context service for every request). NULL when unset — used deliberately by a
-- narrow set of policies below for the one legitimate cross-tenant read the
-- system needs: looking a user up by email at login, before their
-- organization is known.
CREATE FUNCTION app_current_organization_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.current_organization_id', true), '')::uuid
$$ LANGUAGE sql STABLE;
--> statement-breakpoint

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION forbid_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable (append-only per Engineering Charter)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON "organizations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER businesses_set_updated_at BEFORE UPDATE ON "businesses" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER locations_set_updated_at BEFORE UPDATE ON "locations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER staff_set_updated_at BEFORE UPDATE ON "staff" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON "roles" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER tenant_settings_set_updated_at BEFORE UPDATE ON "tenant_settings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();
--> statement-breakpoint

-- organizations — keyed by its own id, not an organization_id column. INSERT
-- is intentionally unrestricted: creating a brand-new tenant is the one
-- operation that can't itself be scoped to an existing tenant boundary.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY organizations_select ON "organizations" FOR SELECT
  USING (app_current_organization_id() IS NULL OR "id" = app_current_organization_id());--> statement-breakpoint
CREATE POLICY organizations_insert ON "organizations" FOR INSERT WITH CHECK (true);--> statement-breakpoint
CREATE POLICY organizations_update ON "organizations" FOR UPDATE
  USING ("id" = app_current_organization_id()) WITH CHECK ("id" = app_current_organization_id());--> statement-breakpoint
CREATE POLICY organizations_delete ON "organizations" FOR DELETE
  USING ("id" = app_current_organization_id());
--> statement-breakpoint

-- users — SELECT is relaxed only when no tenant context has been set at all
-- (i.e. the pre-authentication login lookup, which by construction only ever
-- runs a single "find by email" query on a fresh transaction). Every write,
-- and every read once a request is authenticated and tenant-scoped, is strict.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY users_select ON "users" FOR SELECT
  USING (app_current_organization_id() IS NULL OR "organization_id" = app_current_organization_id());--> statement-breakpoint
CREATE POLICY users_insert ON "users" FOR INSERT
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
CREATE POLICY users_update ON "users" FOR UPDATE
  USING ("organization_id" = app_current_organization_id()) WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint
CREATE POLICY users_delete ON "users" FOR DELETE
  USING ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- roles / role_permissions — organization_id is nullable: null rows are
-- system-default roles/grants visible to every tenant. Mutating a null-org
-- (system) row is only ever allowed from a connection with no tenant context
-- at all (the seed script), never from an authenticated tenant request.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY roles_select ON "roles" FOR SELECT
  USING ("organization_id" = app_current_organization_id() OR "organization_id" IS NULL);--> statement-breakpoint
CREATE POLICY roles_insert ON "roles" FOR INSERT
  WITH CHECK (
    "organization_id" = app_current_organization_id()
    OR ("organization_id" IS NULL AND app_current_organization_id() IS NULL)
  );--> statement-breakpoint
CREATE POLICY roles_update ON "roles" FOR UPDATE
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK (
    "organization_id" = app_current_organization_id()
    OR ("organization_id" IS NULL AND app_current_organization_id() IS NULL)
  );--> statement-breakpoint
CREATE POLICY roles_delete ON "roles" FOR DELETE
  USING ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY role_permissions_select ON "role_permissions" FOR SELECT
  USING ("organization_id" = app_current_organization_id() OR "organization_id" IS NULL);--> statement-breakpoint
CREATE POLICY role_permissions_insert ON "role_permissions" FOR INSERT
  WITH CHECK (
    "organization_id" = app_current_organization_id()
    OR ("organization_id" IS NULL AND app_current_organization_id() IS NULL)
  );--> statement-breakpoint
CREATE POLICY role_permissions_update ON "role_permissions" FOR UPDATE
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK (
    "organization_id" = app_current_organization_id()
    OR ("organization_id" IS NULL AND app_current_organization_id() IS NULL)
  );--> statement-breakpoint
CREATE POLICY role_permissions_delete ON "role_permissions" FOR DELETE
  USING ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- audit_logs — append-only. Only SELECT and INSERT policies exist; with no
-- UPDATE/DELETE policy defined, RLS denies both outright for every role
-- (including the owner, via FORCE ROW LEVEL SECURITY above). The
-- audit_logs_immutable trigger is a second, independent guarantee that holds
-- even against a connection that could otherwise bypass RLS entirely.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_logs_select ON "audit_logs" FOR SELECT
  USING ("organization_id" = app_current_organization_id());--> statement-breakpoint
CREATE POLICY audit_logs_insert ON "audit_logs" FOR INSERT
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- Every remaining tenant table: organization_id is NOT NULL and every command
-- is scoped strictly to the current tenant. One FOR ALL policy per table —
-- USING governs SELECT/UPDATE/DELETE, WITH CHECK governs INSERT/UPDATE.
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY businesses_tenant_isolation ON "businesses" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY locations_tenant_isolation ON "locations" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY staff_tenant_isolation ON "staff" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "staff_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY staff_roles_tenant_isolation ON "staff_roles" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_settings_tenant_isolation ON "tenant_settings" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "devices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY devices_tenant_isolation ON "devices" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

ALTER TABLE "approval_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approval_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY approval_requests_tenant_isolation ON "approval_requests" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- Grant the low-privilege runtime role (infra/postgres/init.sql) access to
-- what it needs and nothing more: row data (subject to the RLS policies
-- above) and the tenant-context helper function. No DDL, no role/schema
-- management. ALTER DEFAULT PRIVILEGES means future migrations that add
-- tables as pos_user don't need to remember to re-grant pos_app by hand.
GRANT USAGE ON SCHEMA public TO pos_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pos_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_current_organization_id() TO pos_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE pos_user IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pos_app;