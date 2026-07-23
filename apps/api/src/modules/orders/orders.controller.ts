import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { AddOrderItemDto } from './dto/add-order-item.dto.js'
import { ApplyDiscountDto } from './dto/apply-discount.dto.js'
import { CreateOrderDto } from './dto/create-order.dto.js'
import { FireOrderDto } from './dto/fire-order.dto.js'
import { SplitOrderDto } from './dto/split-order.dto.js'
import { UpdateOrderItemDto } from './dto/update-order-item.dto.js'
import { VoidOrderDto } from './dto/void-order.dto.js'
import { APPROVAL_HEADER, OrdersService } from './orders.service.js'

@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  private approvalRequestId(req: Request): string | undefined {
    const header = req.headers[APPROVAL_HEADER]
    return Array.isArray(header) ? header[0] : header
  }

  @Get()
  list(@Req() req: Request, @Query('locationId') locationId?: string, @Query('tableId') tableId?: string, @Query('status') status?: string) {
    return this.ordersService.list(req.authContext!, { locationId, tableId, status })
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.getById(req.authContext!, id)
  }

  @Post()
  @RequirePermission('orders:create')
  create(@ValidatedBody(CreateOrderDto) dto: CreateOrderDto, @Req() req: Request) {
    return this.ordersService.create(req.authContext!, dto)
  }

  @Post(':id/items')
  @RequirePermission('orders:update_own')
  addItem(@Param('id') id: string, @ValidatedBody(AddOrderItemDto) dto: AddOrderItemDto, @Req() req: Request) {
    return this.ordersService.addItem(req.authContext!, id, dto)
  }

  // Handles quantity/course/note edits (draft only) and the void/comp
  // transitions (OrdersService.updateItem inspects dto.status) — see PRD 05's
  // API surface: "PATCH /orders/:id/items/:item_id (modify/void)".
  @Patch(':id/items/:itemId')
  @RequirePermission('orders:update_own')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @ValidatedBody(UpdateOrderItemDto) dto: UpdateOrderItemDto,
    @Req() req: Request,
  ) {
    return this.ordersService.updateItem(req.authContext!, id, itemId, dto, this.approvalRequestId(req))
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermission('orders:update_own')
  send(@Param('id') id: string, @ValidatedBody(FireOrderDto) dto: FireOrderDto, @Req() req: Request) {
    return this.ordersService.send(req.authContext!, id, dto)
  }

  @Post(':id/discounts')
  @RequirePermission('orders:update_own')
  applyDiscount(@Param('id') id: string, @ValidatedBody(ApplyDiscountDto) dto: ApplyDiscountDto, @Req() req: Request) {
    return this.ordersService.applyDiscount(req.authContext!, id, dto, this.approvalRequestId(req))
  }

  @Post(':id/split')
  @HttpCode(200)
  @RequirePermission('orders:update_own')
  split(@Param('id') id: string, @ValidatedBody(SplitOrderDto) dto: SplitOrderDto, @Req() req: Request) {
    return this.ordersService.split(req.authContext!, id, dto)
  }

  // Manager-tier only — no approval-override path (see OrdersService.voidOrder).
  @Post(':id/void')
  @HttpCode(200)
  @RequirePermission('orders:void_bill')
  voidOrder(@Param('id') id: string, @ValidatedBody(VoidOrderDto) dto: VoidOrderDto, @Req() req: Request) {
    return this.ordersService.voidOrder(req.authContext!, id, dto)
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('orders:update_own')
  close(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.close(req.authContext!, id)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  @Get('reports/daily-sales')
  dailySales(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ordersService.dailySalesReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('reports/top-products')
  topProducts(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string, @Query('limit') limit?: string) {
    return this.ordersService.topProductsReport(req.authContext!, locationId, new Date(from), new Date(to), limit ? Number(limit) : 20)
  }

  @Get('reports/void-discount')
  voidDiscount(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ordersService.voidDiscountSummary(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('reports/bill-revenue')
  billRevenue(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ordersService.billRevenueReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('reports/bill-payment-status')
  billPaymentStatus(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ordersService.billPaymentStatusBreakdown(req.authContext!, locationId, new Date(from), new Date(to))
  }
}
