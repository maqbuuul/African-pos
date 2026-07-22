-- P10 — Offline Sync (docs/prd/11-offline-sync.md, BUILD_WORKFLOW.md P11).
-- Adds: sync_operations (append-only log of device uploads),
-- sync_cursors (per-device sync checkpoint tracking),
-- sync_conflicts (operations requiring manual review).
-- RLS on all tenant-scoped tables; updated_at triggers on mutable tables.
CREATE TABLE "sync_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"base_version" integer,
	"idempotency_key" text,
	"status" text DEFAULT 'synced' NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_operations_idempotency_key_unique" UNIQUE("organization_id", "idempotency_key"),
	CONSTRAINT "sync_operations_entity_type_check" CHECK ("sync_operations"."entity_type" in ('order', 'order_item', 'order_item_modifier', 'payment', 'refund', 'tip', 'receipt', 'shift', 'cash_drawer_session', 'cash_drawer_adjustment', 'customer', 'audit_event')),
	CONSTRAINT "sync_operations_operation_check" CHECK ("sync_operations"."operation" in ('create', 'update', 'delete', 'upsert')),
	CONSTRAINT "sync_operations_status_check" CHECK ("sync_operations"."status" in ('pending', 'synced', 'conflict', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_cursor_value" text,
	"pending_operation_count" integer DEFAULT 0 NOT NULL,
	"sync_status" text DEFAULT 'online' NOT NULL,
	"battery_level" integer,
	"on_battery" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_cursors_device_id_unique" UNIQUE("device_id"),
	CONSTRAINT "sync_cursors_status_check" CHECK ("sync_cursors"."sync_status" in ('online', 'syncing', 'catching_up', 'offline'))
);
--> statement-breakpoint
CREATE TABLE "sync_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"op_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"resolution" text DEFAULT 'manual_review' NOT NULL,
	"server_snapshot" jsonb,
	"client_snapshot" jsonb,
	"message" text NOT NULL,
	"resolved_by_actor_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_conflicts_entity_type_check" CHECK ("sync_conflicts"."entity_type" in ('order', 'order_item', 'order_item_modifier', 'payment', 'refund', 'tip', 'receipt', 'shift', 'cash_drawer_session', 'cash_drawer_adjustment', 'customer', 'audit_event')),
	CONSTRAINT "sync_conflicts_resolution_check" CHECK ("sync_conflicts"."resolution" in ('server_wins', 'append_merge', 'manual_review', 'payment_dependent'))
);
--> statement-breakpoint
-- Indexes for sync_operations
CREATE INDEX "sync_operations_organization_id_idx" ON "sync_operations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sync_operations_device_id_idx" ON "sync_operations" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "sync_operations_status_idx" ON "sync_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_operations_idempotency_key_idx" ON "sync_operations" USING btree ("idempotency_key");--> statement-breakpoint
-- Indexes for sync_cursors
CREATE INDEX "sync_cursors_organization_id_idx" ON "sync_cursors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sync_cursors_device_id_idx" ON "sync_cursors" USING btree ("device_id");--> statement-breakpoint
-- Indexes for sync_conflicts
CREATE INDEX "sync_conflicts_organization_id_idx" ON "sync_conflicts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sync_conflicts_device_id_idx" ON "sync_conflicts" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "sync_conflicts_entity_type_entity_id_idx" ON "sync_conflicts" USING btree ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX "sync_conflicts_resolution_idx" ON "sync_conflicts" USING btree ("resolution");--> statement-breakpoint

-- updated_at triggers for mutable tables
CREATE TRIGGER sync_operations_set_updated_at BEFORE UPDATE ON "sync_operations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER sync_cursors_set_updated_at BEFORE UPDATE ON "sync_cursors" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER sync_conflicts_set_updated_at BEFORE UPDATE ON "sync_conflicts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Row-Level Security for every tenant-scoped table added in this migration.
ALTER TABLE "sync_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_operations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sync_operations_tenant_isolation ON "sync_operations" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "sync_cursors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_cursors" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sync_cursors_tenant_isolation ON "sync_cursors" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());--> statement-breakpoint

ALTER TABLE "sync_conflicts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_conflicts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY sync_conflicts_tenant_isolation ON "sync_conflicts" FOR ALL
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
