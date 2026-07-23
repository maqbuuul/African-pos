import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { ReportsService } from './reports.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  // ---------------------------------------------------------------------------
  // Dashboards
  // ---------------------------------------------------------------------------
  @Get('dashboards/home')
  homeDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.homeDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/sales')
  salesDashboard(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.salesDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('dashboards/inventory')
  inventoryDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.inventoryDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/staff')
  staffDashboard(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.staffDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('dashboards/customer')
  customerDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.customerDashboard(req.authContext!, locationId)
  }

  @Get('dashboards/finance')
  financeDashboard(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.financeDashboard(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  @Get('reports/sales')
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
  staffReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('days') days?: string) {
    return this.reportsService.staffDashboard(req.authContext!, locationId, days ? Number(days) : 7)
  }

  @Get('reports/finance')
  financeReport(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.reportsService.financeDashboard(req.authContext!, locationId)
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  @Post('reports/:type/export')
  async exportReport(
    @Req() req: Request,
    @Res() res: Response,
    @Query('locationId') locationId: string,
    @Param('type') type: string,
    @Body() body: { days?: number; startDate?: string; endDate?: string },
  ) {
    const { csv, filename } = await this.reportsService.exportReport(req.authContext!, locationId, type, body)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  }
}
