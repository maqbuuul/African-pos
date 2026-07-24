import { Controller, Get, HttpCode, Inject, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CaptureLoyaltyDto } from './dto/capture-loyalty.dto.js'
import { CreateTableSessionDto } from './dto/create-table-session.dto.js'
import { FireCourseDto } from './dto/fire-course.dto.js'
import { OrderIdDto } from './dto/order-id.dto.js'
import { PayMpesaDto } from './dto/pay-mpesa.dto.js'
import { RateDishDto } from './dto/rate-dish.dto.js'
import { RequestWaiterDto } from './dto/request-waiter.dto.js'
import { SubmitFeedbackDto } from './dto/submit-feedback.dto.js'
import { SubmitOrderDto } from './dto/submit-order.dto.js'
import { TableSession, TableSessionGuard } from './table-session.guard.js'
import { TokenRateGuard } from './token-rate.guard.js'
import { QrOrderService } from './qr-order.service.js'
import type { TableSessionClaims } from './table-session.js'

@Controller('public')
export class QrOrderController {
  constructor(@Inject(QrOrderService) private readonly qrOrderService: QrOrderService) {}

  @Post('table-sessions')
  @HttpCode(200)
  @UseGuards(TokenRateGuard)
  createSession(@ValidatedBody(CreateTableSessionDto) dto: CreateTableSessionDto) {
    return this.qrOrderService.createSession(dto.qrSlug)
  }

  @Get('table-sessions/:token/menu')
  @UseGuards(TableSessionGuard)
  getMenu(@TableSession() session: TableSessionClaims) {
    return this.qrOrderService.getMenu(session)
  }

  @Post('table-sessions/:token/orders')
  @HttpCode(201)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  submitOrder(@TableSession() session: TableSessionClaims, @ValidatedBody(SubmitOrderDto) dto: SubmitOrderDto) {
    return this.qrOrderService.submitOrder(session, dto.items)
  }

  @Get('table-sessions/:token/order')
  @UseGuards(TableSessionGuard)
  getOrder(@TableSession() session: TableSessionClaims, @Query('orderId') orderId: string) {
    return this.qrOrderService.getOrder(session, orderId)
  }

  @Post('table-sessions/:token/request-waiter')
  @HttpCode(200)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  requestWaiter(@TableSession() session: TableSessionClaims, @ValidatedBody(RequestWaiterDto) dto: RequestWaiterDto) {
    return this.qrOrderService.requestWaiter(session, dto.reason)
  }

  @Post('table-sessions/:token/feedback')
  @HttpCode(201)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  submitFeedback(
    @TableSession() session: TableSessionClaims,
    @ValidatedBody(SubmitFeedbackDto) dto: SubmitFeedbackDto,
  ) {
    return this.qrOrderService.submitFeedback(session, dto.orderItemId, dto.rating, dto.comment)
  }

  @Post('table-sessions/:token/fire-course')
  @HttpCode(200)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  fireCourse(
    @TableSession() session: TableSessionClaims,
    @ValidatedBody(FireCourseDto) dto: FireCourseDto,
  ) {
    return this.qrOrderService.fireCourse(session, dto.orderId, dto.courseName)
  }

  @Post('table-sessions/:token/rate-dish')
  @HttpCode(201)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  rateDish(
    @TableSession() session: TableSessionClaims,
    @ValidatedBody(RateDishDto) dto: RateDishDto,
  ) {
    return this.qrOrderService.rateDish(session, dto.orderItemId, dto.rating, dto.comment)
  }

  @Post('table-sessions/:token/payments/mobile-money')
  @HttpCode(200)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  payMpesa(
    @TableSession() session: TableSessionClaims,
    @ValidatedBody(PayMpesaDto) dto: PayMpesaDto,
  ) {
    return this.qrOrderService.payMpesa(session, dto.orderId, dto.phone, dto.idempotencyKey)
  }

  @Post('table-sessions/:token/request-bill')
  @HttpCode(200)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  requestBill(@TableSession() session: TableSessionClaims, @ValidatedBody(OrderIdDto) dto: OrderIdDto) {
    return this.qrOrderService.requestBill(session, dto.orderId)
  }

  @Post('table-sessions/:token/pay-with-waiter')
  @HttpCode(200)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  payWithWaiter(@TableSession() session: TableSessionClaims, @ValidatedBody(OrderIdDto) dto: OrderIdDto) {
    return this.qrOrderService.payWithWaiter(session, dto.orderId)
  }

  @Get('table-sessions/:token/menu/refresh')
  @UseGuards(TableSessionGuard, TokenRateGuard)
  refreshMenu(@TableSession() session: TableSessionClaims) {
    return this.qrOrderService.refreshMenu(session)
  }

  @Post('table-sessions/:token/loyalty')
  @HttpCode(200)
  @UseGuards(TableSessionGuard, TokenRateGuard)
  captureLoyalty(@TableSession() session: TableSessionClaims, @ValidatedBody(CaptureLoyaltyDto) dto: CaptureLoyaltyDto) {
    return this.qrOrderService.captureLoyalty(session, dto.phone)
  }

  @Get('table-sessions/:token/order/status')
  @UseGuards(TableSessionGuard, TokenRateGuard)
  getOrderStatus(@TableSession() session: TableSessionClaims, @Query('orderId') orderId: string) {
    return this.qrOrderService.getOrderStatus(session, orderId)
  }

  // ---------------------------------------------------------------------------
  // Reports (staff-facing, not public)
  // ---------------------------------------------------------------------------
  @Get('api/v1/tables/reports/utilization')
  @UseGuards(JwtAuthGuard)
  tableUtilization(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.qrOrderService.tableUtilizationReport(req.authContext!, locationId)
  }
}
