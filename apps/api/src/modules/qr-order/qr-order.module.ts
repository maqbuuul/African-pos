import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PaymentsModule } from '../payments/index.js'
import { QrOrderController } from './qr-order.controller.js'
import { QrOrderService } from './qr-order.service.js'

export const qrOrderModule = {
  name: 'qr-order',
  phase: 'restaurant-mvp',
  owns: [],
} as const

@Module({
  imports: [AuditModule, PaymentsModule],
  controllers: [QrOrderController],
  providers: [QrOrderService],
})
export class QrOrderModule {}
