import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { InventoryService } from './inventory.service.js'

@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventoryService: InventoryService) {}

  @Get('reports/stock-value')
  stockValue(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.inventoryService.stockValueReport(req.authContext!, locationId)
  }

  @Get('reports/low-stock')
  lowStock(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.inventoryService.lowStockReport(req.authContext!, locationId)
  }

  @Get('reports/stock-movements')
  stockMovementsReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.inventoryService.stockMovementSummary(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('reports/wastage')
  wastage(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.inventoryService.wastageSummaryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }
}
