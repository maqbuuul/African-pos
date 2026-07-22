import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'

export const inventoryModule = {
  name: 'inventory',
  phase: 'restaurant-operations',
  owns: [
    'suppliers',
    'inventory_items',
    'stock_locations',
    'stock_levels',
    'stock_movements',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'stock_counts',
    'stock_adjustments',
    'recipes',
    'recipe_ingredients',
    'wastage_events',
  ],
} as const

@Module({
  imports: [AuditModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class InventoryModule {}
