import { Module } from '@nestjs/common'

export const paymentsModule = {
  name: 'payments',
  phase: 'restaurant-mvp',
  owns: ['payment_intents', 'payments', 'refunds', 'cash_drawer_sessions'],
} as const

@Module({})
export class PaymentsModule {}
