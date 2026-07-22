import { Module } from '@nestjs/common'

export const inventoryModule = {
  name: 'inventory',
  phase: 'restaurant-operations',
  owns: ['suppliers', 'purchase_orders', 'stock_items', 'stock_movements', 'recipes'],
} as const

@Module({})
export class InventoryModule {}
