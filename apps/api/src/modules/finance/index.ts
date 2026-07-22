import { Module } from '@nestjs/common'

export const financeModule = {
  name: 'finance',
  phase: 'restaurant-operations',
  owns: ['ledger_entries', 'expenses', 'tax_summaries', 'reconciliations'],
} as const

@Module({})
export class FinanceModule {}
