import { Inject, Injectable } from '@nestjs/common'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { ReportsService } from '../reports/reports.service.js'

@Injectable()
export class StaffReportService {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  // staff_performance_metrics is reports-owned.
  async performance(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return this.reportsService.staffPerformanceReport(authContext, locationId, from, to)
  }
}
