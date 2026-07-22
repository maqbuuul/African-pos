import { Module } from '@nestjs/common'

export const reportsModule = {
  name: 'reports',
  phase: 'restaurant-mvp',
  owns: ['report_snapshots', 'scheduled_reports'],
} as const

@Module({})
export class ReportsModule {}
