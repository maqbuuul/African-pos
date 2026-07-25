-- sync_operations/sync_conflicts' entity_type CHECK constraints (0013) were
-- hardcoded to a singular-noun list ('order', 'order_item', 'payment', ...)
-- that never matched SyncEntityTypeSchema in packages/domain (plural nouns:
-- 'orders', 'order_items', 'products', 'customers', 'inventory_items',
-- 'payments', 'refunds', 'receipts', 'etims_submission') — the only enum
-- application code ever validates a push against. Every possible value
-- PushOperationsDto accepts therefore violated the DB constraint outright;
-- found by actually driving POST /api/v1/sync/push against a live DB.
ALTER TABLE "sync_operations" DROP CONSTRAINT "sync_operations_entity_type_check";--> statement-breakpoint
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_entity_type_check" CHECK ("sync_operations"."entity_type" in ('orders', 'order_items', 'products', 'customers', 'inventory_items', 'payments', 'refunds', 'receipts', 'etims_submission'));--> statement-breakpoint
ALTER TABLE "sync_conflicts" DROP CONSTRAINT "sync_conflicts_entity_type_check";--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_entity_type_check" CHECK ("sync_conflicts"."entity_type" in ('orders', 'order_items', 'products', 'customers', 'inventory_items', 'payments', 'refunds', 'receipts', 'etims_submission'));
