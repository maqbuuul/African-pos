-- P12 — Make stock_levels a trigger-maintained materialized projection
-- BUILD_WORKFLOW.md: "Every stock change is a stock_movements row; stock_levels
-- is a materialized projection, never written directly."
-- This trigger maintains stock_levels automatically from stock_movements inserts.

CREATE OR REPLACE FUNCTION maintain_stock_levels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO stock_levels (
    organization_id, location_id, inventory_item_id, stock_location_id,
    quantity, unit
  )
  VALUES (
    NEW.organization_id, NEW.location_id, NEW.inventory_item_id,
    NEW.stock_location_id, NEW.quantity, NEW.unit
  )
  ON CONFLICT (inventory_item_id, stock_location_id)
  DO UPDATE SET
    quantity = stock_levels.quantity + NEW.quantity,
    unit = NEW.unit,
    updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_maintain_stock_levels ON stock_movements;
--> statement-breakpoint

CREATE TRIGGER trg_maintain_stock_levels
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION maintain_stock_levels();
