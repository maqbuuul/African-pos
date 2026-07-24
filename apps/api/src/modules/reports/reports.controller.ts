import { Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { ExportReportDto } from './dto/export-report.dto.js'
import { ScheduleReportDto } from './dto/schedule-report.dto.js'
import { ReportsService } from './reports.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  // ---------------------------------------------------------------------------
  // Dashboards
  // ---------------------------------------------------------------------------
  @Get('dashboards/home')
  @RequirePermission('reports:view_sales')
  homeDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.homeDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/sales')
  @RequirePermission('reports:view_sales')
  salesDashboard(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.salesDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('dashboards/inventory')
  inventoryDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.inventoryDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/staff')
  @RequirePermission('reports:view_staff')
  staffDashboard(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.staffDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('dashboards/customer')
  customerDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.customerDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/finance')
  @RequirePermission('reports:view_profit')
  financeDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.financeDashboard(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // P14 — Role-specific dashboards
  // ---------------------------------------------------------------------------
  @Get('dashboards/owner')
  @RequirePermission('reports:view_profit')
  ownerDashboard(@Req() req: Request) {
    return this.reportsService.ownerDashboard(req.authContext!)
  }

  @Get('dashboards/manager')
  @RequirePermission('reports:view_sales')
  managerDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.managerDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/kitchen')
  @RequirePermission('reports:view_sales')
  kitchenDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.kitchenDashboard(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  @Get('reports/sales')
  @RequirePermission('reports:view_sales')
  salesReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.salesDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('reports/payments')
  paymentsReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.paymentsReport(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('reports/inventory')
  inventoryReport(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.inventoryDashboard(req.authContext!, locationId)
  }

  @Get('reports/staff')
  @RequirePermission('reports:view_staff')
  staffReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.staffDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('reports/finance')
  @RequirePermission('reports:view_profit')
  financeReport(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.financeDashboard(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // P14 — Real-time P&L
  // ---------------------------------------------------------------------------
  @Get('reports/realtime-pnl/:locationId')
  @RequirePermission('reports:view_profit')
  getRealtimePnL(@Req() req: Request, @Param('locationId') locationId: string) {
    return this.reportsService.getRealtimePnL(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // P14 — Competitive benchmarking
  // ---------------------------------------------------------------------------
  @Get('reports/benchmarks')
  @RequirePermission('reports:view_audit')
  getPeerBenchmark(@Req() req: Request, @Query('metric') metric: string) {
    return this.reportsService.getPeerBenchmark(req.authContext!, metric)
  }

  // ---------------------------------------------------------------------------
  // P14 — Scheduled reports
  // ---------------------------------------------------------------------------
  @Get('reports/schedules')
  getScheduledReports(@Req() req: Request) {
    return this.reportsService.getScheduledReports(req.authContext!)
  }

  @Post('reports/schedules')
  @HttpCode(201)
  scheduleReport(@Req() req: Request, @ValidatedBody(ScheduleReportDto) dto: ScheduleReportDto) {
    return this.reportsService.scheduleReport(req.authContext!, dto.reportType, dto.cadence)
  }

  // ---------------------------------------------------------------------------
  // P14 — Daily aggregation
  // ---------------------------------------------------------------------------
  @Post('reports/run-aggregation')
  @HttpCode(200)
  @RequirePermission('reports:view_profit')
  runDailyAggregation(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.runDailyAggregation(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  @Post('reports/:type/export')
  @RequirePermission('reports:export')
  async exportReport(
    @Req() req: Request,
    @Res() res: Response,
    @Query('locationId') locationId: string,
    @Param('type') type: string,
    @ValidatedBody(ExportReportDto) body: ExportReportDto,
  ) {
    const { csv, filename } = await this.reportsService.exportReport(req.authContext!, locationId, type, body)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  }
}
