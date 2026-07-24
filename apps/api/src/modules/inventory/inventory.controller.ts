import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CompleteStockCountDto } from './dto/complete-stock-count.dto.js'
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js'
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto.js'
import { CreateRecipeDto } from './dto/create-recipe.dto.js'
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto.js'
import { CreateStockLocationDto } from './dto/create-stock-location.dto.js'
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto.js'
import { CreateSupplierDto } from './dto/create-supplier.dto.js'
import { RecordWastageDto } from './dto/record-wastage.dto.js'
import { SellByWeightDto } from './dto/sell-by-weight.dto.js'
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js'
import { UpdateSupplierDto } from './dto/update-supplier.dto.js'
import { InventoryService } from './inventory.service.js'

@Controller('api/v1/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly svc: InventoryService) {}

  // -- Suppliers --
  @Get('suppliers') @RequirePermission('inventory:view')
  listSuppliers(@Req() req: Request) { return this.svc.listSuppliers(req.authContext!) }

  @Get('suppliers/:id') @RequirePermission('inventory:view')
  getSupplier(@Param('id') id: string, @Req() req: Request) { return this.svc.getSupplier(req.authContext!, id) }

  @Post('suppliers') @RequirePermission('inventory:manage')
  createSupplier(@ValidatedBody(CreateSupplierDto) dto: CreateSupplierDto, @Req() req: Request) { return this.svc.createSupplier(req.authContext!, dto) }

  @Patch('suppliers/:id') @RequirePermission('inventory:manage')
  updateSupplier(@Param('id') id: string, @ValidatedBody(UpdateSupplierDto) dto: UpdateSupplierDto, @Req() req: Request) { return this.svc.updateSupplier(req.authContext!, id, dto) }

  // -- Inventory Items --
  @Get('inventory-items') @RequirePermission('inventory:view')
  listInventoryItems(@Req() req: Request, @Query('locationId') locationId?: string) { return this.svc.listInventoryItems(req.authContext!, locationId) }

  @Get('inventory-items/:id') @RequirePermission('inventory:view')
  getInventoryItem(@Param('id') id: string, @Req() req: Request) { return this.svc.getInventoryItem(req.authContext!, id) }

  @Post('inventory-items') @RequirePermission('inventory:manage')
  createInventoryItem(@ValidatedBody(CreateInventoryItemDto) dto: CreateInventoryItemDto, @Req() req: Request) { return this.svc.createInventoryItem(req.authContext!, dto) }

  @Patch('inventory-items/:id') @RequirePermission('inventory:manage')
  updateInventoryItem(@Param('id') id: string, @ValidatedBody(UpdateInventoryItemDto) dto: UpdateInventoryItemDto, @Req() req: Request) { return this.svc.updateInventoryItem(req.authContext!, id, dto) }

  // -- Stock Locations --
  @Get('stock-locations') @RequirePermission('inventory:view')
  listStockLocations(@Req() req: Request) { return this.svc.listStockLocations(req.authContext!) }

  @Post('stock-locations') @RequirePermission('inventory:manage')
  createStockLocation(@ValidatedBody(CreateStockLocationDto) dto: CreateStockLocationDto, @Req() req: Request) { return this.svc.createStockLocation(req.authContext!, dto) }

  // -- Stock Levels --
  @Get('stock-levels') @RequirePermission('inventory:view')
  listStockLevels(@Req() req: Request, @Query('locationId') locationId?: string) { return this.svc.listStockLevels(req.authContext!, locationId) }

  // -- Stock Movements --
  @Get('stock-movements') @RequirePermission('inventory:view')
  listStockMovements(@Req() req: Request, @Query('inventoryItemId') inventoryItemId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.listStockMovements(req.authContext!, inventoryItemId, from ? new Date(from) : undefined, to ? new Date(to) : undefined)
  }

  // -- Purchase Orders --
  @Get('purchase-orders') @RequirePermission('inventory:view')
  listPurchaseOrders(@Req() req: Request, @Query('supplierId') supplierId?: string) { return this.svc.listPurchaseOrders(req.authContext!, supplierId) }

  @Get('purchase-orders/:id') @RequirePermission('inventory:view')
  getPurchaseOrder(@Param('id') id: string, @Req() req: Request) { return this.svc.getPurchaseOrder(req.authContext!, id) }

  @Post('purchase-orders') @RequirePermission('inventory:manage')
  createPurchaseOrder(@ValidatedBody(CreatePurchaseOrderDto) dto: CreatePurchaseOrderDto, @Req() req: Request) { return this.svc.createPurchaseOrder(req.authContext!, dto) }

  @Patch('purchase-orders/:id/status') @RequirePermission('inventory:manage')
  updatePurchaseOrderStatus(@Param('id') id: string, @Query('status') status: string, @Req() req: Request) { return this.svc.updatePurchaseOrderStatus(req.authContext!, id, status) }

  @Post('purchase-orders/:id/receive') @HttpCode(200) @RequirePermission('inventory:receive')
  receiveGoods(@Param('id') id: string, @Query('stockLocationId') stockLocationId: string, @Req() req: Request) { return this.svc.receiveGoods(req.authContext!, id, stockLocationId) }

  // -- Stock Counts --
  @Post('stock-counts') @RequirePermission('inventory:count')
  createStockCount(@Query('stockLocationId') stockLocationId: string, @Query('notes') notes: string | undefined, @Req() req: Request) {
    return this.svc.createStockCount(req.authContext!, stockLocationId, notes)
  }

  @Post('stock-counts/:id/complete') @HttpCode(200) @RequirePermission('inventory:count')
  completeStockCount(@Param('id') id: string, @ValidatedBody(CompleteStockCountDto) body: CompleteStockCountDto, @Req() req: Request) {
    return this.svc.completeStockCount(req.authContext!, id, body)
  }

  // -- Recipes --
  @Get('recipes') @RequirePermission('inventory:view')
  listRecipes(@Req() req: Request) { return this.svc.listRecipes(req.authContext!) }

  @Get('recipes/:id') @RequirePermission('inventory:view')
  getRecipe(@Param('id') id: string, @Req() req: Request) { return this.svc.getRecipe(req.authContext!, id) }

  @Get('recipes/:id/cost') @RequirePermission('inventory:view')
  getRecipeCost(@Param('id') id: string, @Req() req: Request) { return this.svc.getRecipeCost(req.authContext!, id) }

  @Post('recipes') @RequirePermission('inventory:manage_recipes')
  createRecipe(@ValidatedBody(CreateRecipeDto) dto: CreateRecipeDto, @Req() req: Request) { return this.svc.createRecipe(req.authContext!, dto) }

  // -- Wastage --
  @Get('wastage') @RequirePermission('inventory:view')
  listWastage(@Req() req: Request, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.listWastageEvents(req.authContext!, from ? new Date(from) : undefined, to ? new Date(to) : undefined)
  }

  @Post('wastage') @RequirePermission('inventory:adjust')
  recordWastage(@ValidatedBody(RecordWastageDto) dto: RecordWastageDto, @Req() req: Request) { return this.svc.recordWastage(req.authContext!, dto) }

  // -- Stock Transfers --
  @Post('stock-transfers') @RequirePermission('inventory:transfer')
  createStockTransfer(@ValidatedBody(CreateStockTransferDto) dto: CreateStockTransferDto, @Req() req: Request) { return this.svc.createStockTransfer(req.authContext!, dto) }

  @Get('stock-transfers') @RequirePermission('inventory:view')
  listStockTransfers(@Req() req: Request) { return this.svc.listStockTransfers(req.authContext!) }

  // -- Stock Adjustments (standalone) --
  @Post('stock-adjustments') @RequirePermission('inventory:adjust')
  createStockAdjustment(@ValidatedBody(CreateStockAdjustmentDto) dto: CreateStockAdjustmentDto, @Req() req: Request) { return this.svc.createStockAdjustment(req.authContext!, dto) }

  // -- Sell By Weight --
  @Post('sell-by-weight') @RequirePermission('inventory:view')
  sellByWeight(@ValidatedBody(SellByWeightDto) dto: SellByWeightDto, @Req() req: Request) { return this.svc.sellByWeight(req.authContext!, dto.itemId, dto.weightGrams, dto.pricePerKg) }

  // -- Supplier Credit Reminders --
  @Get('supplier-credit-reminders') @RequirePermission('inventory:view')
  supplierCreditReminders(@Req() req: Request) { return this.svc.supplierCreditReminders(req.authContext!) }

  // -- Reports (existing) --
  @Get('reports/stock-value') @RequirePermission('inventory:view')
  stockValue(@Req() req: Request, @Query('locationId') locationId: string) { return this.svc.stockValueReport(req.authContext!, locationId) }

  @Get('reports/low-stock') @RequirePermission('inventory:view')
  lowStock(@Req() req: Request, @Query('locationId') locationId: string) { return this.svc.lowStockReport(req.authContext!, locationId) }

  @Get('reports/stock-movements') @RequirePermission('inventory:view')
  stockMovementsReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.stockMovementSummary(req.authContext!, locationId, new Date(from), new Date(to)) }

  @Get('reports/wastage') @RequirePermission('inventory:view')
  wastage(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.wastageSummaryReport(req.authContext!, locationId, new Date(from), new Date(to)) }

  @Get('reports/stock-activity') @RequirePermission('inventory:view')
  stockActivity(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) { return this.svc.stockActivityReport(req.authContext!, locationId, new Date(from), new Date(to)) }
}
