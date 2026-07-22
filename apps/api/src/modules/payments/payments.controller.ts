import { Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { ConnectIntegrationDto } from './dto/connect-integration.dto.js'
import { RequestRefundDto } from './dto/request-refund.dto.js'
import { TakeBankTransferPaymentDto } from './dto/take-bank-transfer-payment.dto.js'
import { TakeCashPaymentDto } from './dto/take-cash-payment.dto.js'
import { TakeCardPaymentDto } from './dto/take-card-payment.dto.js'
import { TakeCardTerminalPaymentDto } from './dto/take-card-terminal-payment.dto.js'
import { TakeMpesaPaymentDto } from './dto/take-mpesa-payment.dto.js'
import { APPROVAL_HEADER, PaymentsService } from './payments.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  private approvalRequestId(req: Request): string | undefined {
    const header = req.headers[APPROVAL_HEADER]
    return Array.isArray(header) ? header[0] : header
  }

  // POST /api/v1/bills/:billId/payments/cash
  @Post('bills/:billId/payments/cash')
  @RequirePermission('payments:take_cash')
  takeCash(
    @Param('billId') billId: string,
    @ValidatedBody(TakeCashPaymentDto) dto: TakeCashPaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.takeCash(req.authContext!, billId, dto)
  }

  // POST /api/v1/bills/:billId/payments/mpesa
  @Post('bills/:billId/payments/mpesa')
  @RequirePermission('payments:take_mobile_money')
  takeMpesa(
    @Param('billId') billId: string,
    @ValidatedBody(TakeMpesaPaymentDto) dto: TakeMpesaPaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.takeMpesa(req.authContext!, billId, dto)
  }

  // POST /api/v1/bills/:billId/payments/card
  @Post('bills/:billId/payments/card')
  @RequirePermission('payments:take_card')
  takeCard(
    @Param('billId') billId: string,
    @ValidatedBody(TakeCardPaymentDto) dto: TakeCardPaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.takeCard(req.authContext!, billId, dto)
  }

  // POST /api/v1/bills/:billId/payments/card-terminal
  @Post('bills/:billId/payments/card-terminal')
  @RequirePermission('payments:take_card')
  takeCardTerminal(
    @Param('billId') billId: string,
    @ValidatedBody(TakeCardTerminalPaymentDto) dto: TakeCardTerminalPaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.takeCardTerminal(req.authContext!, billId, dto)
  }

  // POST /api/v1/bills/:billId/payments/bank-transfer
  @Post('bills/:billId/payments/bank-transfer')
  @RequirePermission('payments:take_bank_transfer')
  takeBankTransfer(
    @Param('billId') billId: string,
    @ValidatedBody(TakeBankTransferPaymentDto) dto: TakeBankTransferPaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.takeBankTransfer(req.authContext!, billId, dto)
  }

  // GET /api/v1/bills/:billId/payments
  @Get('bills/:billId/payments')
  getPaymentsForBill(@Param('billId') billId: string, @Req() req: Request) {
    return this.paymentsService.getPaymentsForBill(req.authContext!, billId)
  }

  // GET /api/v1/payment-intents/:id
  @Get('payment-intents/:id')
  getPaymentIntent(@Param('id') id: string, @Req() req: Request) {
    return this.paymentsService.getPaymentIntent(req.authContext!, id)
  }

  // POST /api/v1/payment-intents/:id/cancel
  @Post('payment-intents/:id/cancel')
  @HttpCode(200)
  @RequirePermission('payments:cancel')
  cancelIntent(@Param('id') id: string, @Req() req: Request) {
    return this.paymentsService.cancelIntent(req.authContext!, id)
  }

  // POST /api/v1/payments/:id/refund
  // allowOverride: true — a staff member without payments:refund triggers the
  // manager-approval flow (PermissionsGuard creates an approval_requests row and
  // returns 202; the holder retries with the x-approval-request-id header once
  // a manager resolves it). Mirrors the pattern used for orders:void_after_send.
  @Post('payments/:id/refund')
  @HttpCode(200)
  @RequirePermission('payments:refund', { allowOverride: true, entityType: 'payment' })
  requestRefund(
    @Param('id') id: string,
    @ValidatedBody(RequestRefundDto) dto: RequestRefundDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.requestRefund(req.authContext!, id, dto, this.approvalRequestId(req))
  }

  // POST /api/v1/integrations/payments/connect
  @Post('integrations/payments/connect')
  @RequirePermission('payments:connect_integration')
  connectIntegration(
    @ValidatedBody(ConnectIntegrationDto) dto: ConnectIntegrationDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.connectIntegration(req.authContext!, dto)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  @Get('payments/reports/method-mix')
  paymentMethodMix(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.paymentsService.paymentMethodMixReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('payments/reports/refund-summary')
  refundSummary(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.paymentsService.refundSummaryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }
}

// ---------------------------------------------------------------------------
// Webhook controller — no JwtAuthGuard, no RequirePermission.
// These endpoints are unauthenticated provider callbacks. Security comes from:
// 1. URL scoping (/webhooks/:provider/:orgId)
// 2. Provider-specific signature verification inside the service
// 3. IP whitelisting at the load balancer (infra concern)
// ---------------------------------------------------------------------------
@Controller('api/v1/webhooks')
export class PaymentsWebhookController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  // POST /api/v1/webhooks/mpesa/:orgId
  // M-Pesa STK push result callback. M-Pesa does not HMAC-sign payloads;
  // the service verifies via CheckoutRequestID lookup against known intents.
  @Post('mpesa/:orgId')
  @HttpCode(200)
  handleMpesaWebhook(
    @Param('orgId') orgId: string,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ) {
    const rawPayload = JSON.stringify(req.body)
    const signature = req.headers['x-mpesa-signature'] as string | undefined
    return this.paymentsService.handleMpesaWebhook(orgId, rawPayload, signature, headers)
  }

  // POST /api/v1/webhooks/paystack/:orgId
  // Paystack event callback. Verified via HMAC-SHA512 of the raw payload
  // using the Paystack secret key stored in integration_connections.
  @Post('paystack/:orgId')
  @HttpCode(200)
  handlePaystackWebhook(
    @Param('orgId') orgId: string,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ) {
    const rawPayload = JSON.stringify(req.body)
    const signature = req.headers['x-paystack-signature'] as string | undefined
    return this.paymentsService.handlePaystackWebhook(orgId, rawPayload, signature, headers)
  }
}
