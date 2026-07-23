import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js'
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js'
import { CreateRecipeDto } from './dto/create-recipe.dto.js'
import { CreateStockLocationDto } from './dto/create-stock-location.dto.js'
import { CreateSupplierDto } from './dto/create-supplier.dto.js'
import { RecordWastageDto } from './dto/record-wastage.dto.js'
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js'
import { UpdateSupplierDto } from './dto/update-supplier.dto.js'
import { InventoryService } from './inventory.service.js'

@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly svc: InventoryService) {}

  // -- Suppliers --
  @Get('suppliers') listSuppliers(@Req() req: Request) { return this.svc.listSuppliers(req.authContext!) }
  @Get('suppliers/:id') getSupplier(@Param('id') id: string, @Req() req: Request) { return this.svc.getSupplier(req.authContext!, id) }
  @Post('suppliers') createSupplier(@ValidatedBody(CreateSupplierDto) dto: CreateSupplierDto, @Req() req: Request) { return this.svc.createSupplier(req.authContext!, dto) }
  @Patch('suppliers/:id') updateSupplier(@Param('id') id: string, @ValidatedBody(UpdateSupplierDto) dto: UpdateSupplierDto, @Req() req: Request) { return this.svc.updateSupplier(req.authContext!, id, dto) }

  // -- Inventory Items --
  @Get('inventory-items') listInventoryItems(@Req() req: Request, @Query('locationId') locationId?: string) { return this.svc.listInventoryItems(req.authContext!, locationId) }
  @Get('inventory-items/:id') getInventoryItem(@Param('id') id: string, @Req() req: Request) { return this.svc.getInventoryItem(req.authContext!, id) }
  @Post('inventory-items') createInventoryItem(@ValidatedBody(CreateInventoryItemDto) dto: CreateInventoryItemDto, @Req() req: Request) { return this.svc.createInventoryItem(req.authContext!, dto) }
  @Patch('inventory-items/:id') updateInventoryItem(@Param('id') id: string, @ValidatedBody(UpdateInventoryItemDto) dto: UpdateInventoryItemDto, @Req() req: Request) { return this.svc.updateInventoryItem(req.authContext!, id, dto) }

  // -- Stock Locations --
  @Get('stock-locations') listStockLocations(@Req() req: Request) { return this.svc.listStockLocations(req.authContext!) }
  @Post('stock-locations') createStockLocation(@ValidatedBody(CreateStockLocationDto) dto: CreateStockLocationDto, @Req() req: Request) { return this.svc.createStockLocation(req.authContext!, dto) }

  // -- Stock Levels --
  @Get('stock-levels') listStockLevels(@Req() req: Request, @Query('locationId') locationId?: string) { return this.svc.listStockLevels(req.authContext!, locationId) }

  // -- Stock Movements --
  @Get('stock-movements') listStockMovements(@Req() req: Request, @Query('inventoryItemId') inventoryItemId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.listStockMovements(req.authContext!, inventoryItemId, from ? new Date(from) : undefined, to ? new Date(to) : undefined)
  }

  // -- Purchase Orders --
  @Get('purchase-orders') listPurchaseOrders(@Req() req: Request, @Query('supplierId') supplierId?: string) { return this.svc.listPurchaseOrders(req.authContext!, supplierId) }
  @Get('purchase-orders/:id') getPurchaseOrder(@Param('id') id: string, @Req() req: Request) { return this.svc.getPurchaseOrder(req.authContext!, id) }
  @Post('purchase-orders') createPurchaseOrder(@ValidatedBody(CreatePurchaseOrderDto) dto: CreatePurchaseOrderDto, @Req() req: Request) { return this.svc.createPurchaseOrder(req.authContext!, dto) }
  @Patch('purchase-orders/:id/status') updatePurchaseOrderStatus(@Param('id') id: string, @Query('status') status: string, @Req() req: Request) { return this.svc.updatePurchaseOrderStatus(req.authContext!, id, status) }
  @Post('purchase-orders/:id/receive') @HttpCode(200) receiveGoods(@Param('id') id: string, @Query('stockLocationId') stockLocationId: string, @Req() req: Request) { return this.svc.receiveGoods(req.authContext!, id, stockLocationId) }

  // -- Stock Counts --
  @Post('stock-counts') createStockCount(@Query('stockLocationId') stockLocationId: string, @Query('notes') notes: string | undefined, @Req() req: Request) {
    return this.svc.createStockCount(req.authContext!, stockLocationId, notes)
  }
  @Post('stock-counts/:id/complete') @HttpCode(200) completeStockCount(@Param('id') id: string, @Req() req: Request) {
    return this.svc.completeStockCount(req.authContext!, id)
  }
  @Post('stock-counts/:id/approve') @HttpCode(200) approveStockCount(@Param('id') id: string, @Req() req: Request) {
    return this.svc.approveStockCount(req.authContext!, id)
  }

  // -- Recipes --
  @Get('recipes') listRecipes(@Req() req: Request) { return this.svc.listRecipes(req.authContext!) }
  @Get('recipes/:id') getRecipe(@Param('id') id: string, @Req() req: Request) { return this.svc.getRecipe(req.authContext!, id) }
  @Post('recipes') createRecipe(@ValidatedBody(CreateRecipeDto) dto: CreateRecipeDto, @Req() req: Request) { return this.svc.createRecipe(req.authContext!, dto) }

  // -- Wastage --
  @Get('wastage') listWastage(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.listWastageEvents(req.authContext!, from ? new Date(from) : undefined, to ? new Date(to) : undefined)
  }
  @Post('wastage') recordWastage(@ValidatedBody(RecordWastageDto) dto: RecordWastageDto, @Req() req: Request) { return this.svc.recordWastage(req.authContext!, dto) }

  // -- Reports (existing) --
  @Get('reports/stock-value') stockValue(@Req() req: Request, @Query('locationId') locationId: string) { return this.svc.stockValueReport(req.authContext!, locationId) }
  @Get('reports/low-stock') lowStock(@Req() req: Request, @Query('locationId') locationId: string) { return this.svc.lowStockReport(req.authContext!, locationId) }
  @Get('reports/stock-movements') stockMovementsReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.stockMovementSummary(req.authContext!, locationId, new Date(from), new Date(to)) }
  @Get('reports/wastage') wastage(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.wastageSummaryReport(req.authContext!, locationId, new Date(from), new Date(to)) }
  @Get('reports/stock-activity') stockActivity(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.stockActivityReport(req.authContext!, locationId, new Date(from), new Date(to)) }
}
