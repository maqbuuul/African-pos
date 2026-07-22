import { Module } from '@nestjs/common'

export const crmModule = {
  name: 'crm',
  phase: 'restaurant-mvp',
  owns: ['customers', 'loyalty_accounts', 'gift_cards', 'feedback'],
} as const

@Module({})
export class CrmModule {}
