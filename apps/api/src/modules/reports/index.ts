import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { ReportsController } from './reports.controller.js'
import { ReportsService } from './reports.service.js'
import { WhatsAppReportsService } from './whatsapp-reports.service.js'

export const reportsModule = {
  name: 'reports',
  phase: 'analytics',
  owns: [
    'events',
    'report_snapshots',
    'daily_location_metrics',
    'product_sales_metrics',
    'staff_performance_metrics',
  ],
} as const

@Module({
  imports: [AuditModule],
  controllers: [ReportsController],
  providers: [ReportsService, WhatsAppReportsService],
  exports: [ReportsService, WhatsAppReportsService],
})
export class ReportsModule {}
