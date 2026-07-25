import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { OrdersModule } from '../orders/orders.module.js'
import { CrmController } from './crm.controller.js'
import { CrmService } from './crm.service.js'

export const crmModule = {
  name: 'crm',
  phase: 'restaurant-mvp',
  owns: ['customers', 'customer_identities', 'customer_tags', 'loyalty_accounts', 'loyalty_events', 'gift_cards', 'customer_credit_accounts', 'customer_feedback'],
} as const

@Module({
  imports: [AuditModule, OrdersModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
