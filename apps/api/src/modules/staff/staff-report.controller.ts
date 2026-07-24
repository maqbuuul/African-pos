import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { StaffReportService } from './staff-report.service.js'

@Controller('api/v1/staff/reports')
@UseGuards(JwtAuthGuard)
export class StaffReportController {
  constructor(@Inject(StaffReportService) private readonly staffReportService: StaffReportService) {}

  @Get('performance')
  @RequirePermission('staff:view_reports')
  performance(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.staffReportService.performance(req.authContext!, locationId, new Date(from), new Date(to))
  }
}
