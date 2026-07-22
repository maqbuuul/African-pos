import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'

import { TableSession, TableSessionGuard } from './table-session.guard.js'
import { QrOrderService, type OrderItemInput } from './qr-order.service.js'
import type { TableSessionClaims } from './table-session.js'

@Controller('public')
export class QrOrderController {
  constructor(private readonly qrOrderService: QrOrderService) {}

  @Post('table-sessions')
  @HttpCode(200)
  createSession(@Body('qrSlug') qrSlug: string) {
    return this.qrOrderService.createSession(qrSlug)
  }

  @Get('table-sessions/:token/menu')
  @UseGuards(TableSessionGuard)
  getMenu(@TableSession() session: TableSessionClaims) {
    return this.qrOrderService.getMenu(session)
  }

  @Post('table-sessions/:token/orders')
  @HttpCode(201)
  @UseGuards(TableSessionGuard)
  submitOrder(@TableSession() session: TableSessionClaims, @Body('items') items: OrderItemInput[]) {
    return this.qrOrderService.submitOrder(session, items)
  }

  @Get('table-sessions/:token/order')
  @UseGuards(TableSessionGuard)
  getOrder(@TableSession() session: TableSessionClaims, @Query('orderId') orderId: string) {
    return this.qrOrderService.getOrder(session, orderId)
  }

  @Post('table-sessions/:token/request-waiter')
  @HttpCode(200)
  @UseGuards(TableSessionGuard)
  requestWaiter(@TableSession() session: TableSessionClaims, @Body('reason') reason?: string) {
    return this.qrOrderService.requestWaiter(session, reason)
  }

  @Post('table-sessions/:token/feedback')
  @HttpCode(201)
  @UseGuards(TableSessionGuard)
  submitFeedback(
    @TableSession() session: TableSessionClaims,
    @Body('orderItemId') orderItemId: string,
    @Body('rating') rating: number,
    @Body('comment') comment?: string,
  ) {
    return this.qrOrderService.submitFeedback(session, orderItemId, rating, comment)
  }

  @Post('table-sessions/:token/payments/mobile-money')
  @HttpCode(200)
  @UseGuards(TableSessionGuard)
  payMpesa(
    @TableSession() session: TableSessionClaims,
    @Body('orderId') orderId: string,
    @Body('phone') phone: string,
    @Body('idempotencyKey') idempotencyKey: string,
  ) {
    return this.qrOrderService.payMpesa(session, orderId, phone, idempotencyKey)
  }
}
