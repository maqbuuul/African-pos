import { Module } from '@nestjs/common'

import { ShiftsModule } from './shifts.module.js'

export const financeModule = {
  name: 'finance',
  phase: 'restaurant-operations',
  owns: ['shifts', 'cash_drawer_sessions', 'cash_drawer_adjustments'],
} as const

@Module({
  imports: [ShiftsModule],
})
export class FinanceModule {}
