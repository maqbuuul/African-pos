import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { ChangePriceDto } from './dto/change-price.dto.js'
import { CreateProductDto } from './dto/create-product.dto.js'
import { MarkUnavailableDto } from './dto/mark-unavailable.dto.js'
import { UpdateProductDto } from './dto/update-product.dto.js'
import { APPROVAL_HEADER, ProductsService } from './products.service.js'

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('locationId') locationId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    return this.productsService.list(req.authContext!, { locationId, categoryId, q })
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.productsService.getById(req.authContext!, id)
  }

  @Get(':id/price-history')
  @RequirePermission('products:view_price_history')
  priceHistory(@Param('id') id: string, @Req() req: Request) {
    return this.productsService.priceHistory(req.authContext!, id)
  }

  @Post()
  @RequirePermission('products:manage')
  create(@ValidatedBody(CreateProductDto) dto: CreateProductDto, @Req() req: Request) {
    return this.productsService.create(req.authContext!, dto)
  }

  @Patch(':id')
  @RequirePermission('products:manage')
  update(@Param('id') id: string, @ValidatedBody(UpdateProductDto) dto: UpdateProductDto, @Req() req: Request) {
    return this.productsService.update(req.authContext!, id, dto)
  }

  // Separate from PATCH :id — changing price opens a new price-history row
  // rather than a plain column update (see ProductsService.changePrice), and
  // carries its own owner-approval escalation for large jumps that PATCH
  // doesn't need.
  @Post(':id/price')
  @HttpCode(200)
  @RequirePermission('products:manage')
  changePrice(@Param('id') id: string, @ValidatedBody(ChangePriceDto) dto: ChangePriceDto, @Req() req: Request) {
    const approvalHeader = req.headers[APPROVAL_HEADER]
    const approvalRequestId = Array.isArray(approvalHeader) ? approvalHeader[0] : approvalHeader
    return this.productsService.changePrice(req.authContext!, id, dto, approvalRequestId)
  }

  @Post(':id/mark-unavailable')
  @HttpCode(200)
  @RequirePermission('products:toggle_availability')
  markUnavailable(@Param('id') id: string, @ValidatedBody(MarkUnavailableDto) dto: MarkUnavailableDto, @Req() req: Request) {
    return this.productsService.markUnavailable(req.authContext!, id, dto)
  }

  @Post(':id/mark-available')
  @HttpCode(200)
  @RequirePermission('products:toggle_availability')
  markAvailable(@Param('id') id: string, @Req() req: Request) {
    return this.productsService.markAvailable(req.authContext!, id)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  @Get('reports/price-history')
  @RequirePermission('products:view_price_history')
  priceHistoryReport(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.productsService.priceHistoryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('reports/unavailable-items')
  unavailableItems(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.productsService.unavailableItemsReport(req.authContext!, locationId)
  }

  @Get('reports/category-breakdown')
  categoryBreakdown(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.productsService.categoryBreakdownReport(req.authContext!, locationId)
  }
}
