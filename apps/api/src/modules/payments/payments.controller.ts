import { Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { ChargeBarTabDto } from './dto/charge-bar-tab.dto.js'
import { ConnectIntegrationDto } from './dto/connect-integration.dto.js'
import { MatchMpesaC2bDto } from './dto/match-mpesa-c2b.dto.js'
import { OpenBarTabDto } from './dto/open-bar-tab.dto.js'
import { RegisterMpesaC2bDto } from './dto/register-mpesa-c2b.dto.js'
import { RequestRefundDto } from './dto/request-refund.dto.js'
import { SettleBarTabDto } from './dto/settle-bar-tab.dto.js'
import { TakeBankTransferPaymentDto } from './dto/take-bank-transfer-payment.dto.js'
import { TakeCashPaymentDto } from './dto/take-cash-payment.dto.js'
import { TakeCardTerminalPaymentDto } from './dto/take-card-terminal-payment.dto.js'
import { TakePaymentDto } from './dto/take-payment.dto.js'
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

  // POST /api/v1/bills/:billId/payments/:provider
  // Generic route for every PaymentAdapter-based provider (mpesa_daraja,
  // paystack, airtel_money_api, flutterwave, pesapal) — one route, one DTO,
  // instead of a hand-written route per provider. Must stay registered
  // *after* the static /cash, /card-terminal, /bank-transfer routes above:
  // Express matches routes in registration order, so a static segment has to
  // come first or this dynamic :provider route would shadow them.
  // Permission: take_mobile_money is the floor (every online provider needs
  // at least that); card-shaped providers additionally require take_card,
  // enforced inside the service since a single decorator can't vary by the
  // :provider param's runtime value.
  @Post('bills/:billId/payments/:provider')
  @RequirePermission('payments:take_mobile_money')
  takePayment(
    @Param('billId') billId: string,
    @Param('provider') provider: string,
    @ValidatedBody(TakePaymentDto) dto: TakePaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.takePayment(req.authContext!, billId, provider, dto)
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

  // ---------------------------------------------------------------------------
  // Bar tabs (card pre-authorization / mobile-money deposit hold)
  // ---------------------------------------------------------------------------

  // POST /api/v1/bills/:billId/tabs/open
  @Post('bills/:billId/tabs/open')
  @RequirePermission('payments:take_card')
  openTab(
    @Param('billId') billId: string,
    @ValidatedBody(OpenBarTabDto) dto: OpenBarTabDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.openTab(req.authContext!, billId, dto)
  }

  // POST /api/v1/tabs/:tabId/charge
  @Post('tabs/:tabId/charge')
  @HttpCode(200)
  @RequirePermission('payments:take_card')
  chargeTab(
    @Param('tabId') tabId: string,
    @ValidatedBody(ChargeBarTabDto) dto: ChargeBarTabDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.chargeTab(req.authContext!, tabId, dto)
  }

  // POST /api/v1/tabs/:tabId/settle
  @Post('tabs/:tabId/settle')
  @HttpCode(200)
  @RequirePermission('payments:take_card')
  settleTab(
    @Param('tabId') tabId: string,
    @ValidatedBody(SettleBarTabDto) _dto: SettleBarTabDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.settleTab(req.authContext!, tabId)
  }

  // ---------------------------------------------------------------------------
  // Split-check WhatsApp payment link
  // ---------------------------------------------------------------------------

  // POST /api/v1/orders/:id/split/:splitId/payment-link
  // splitId is the bill ID for the split share.
  @Post('orders/:id/split/:splitId/payment-link')
  @RequirePermission('payments:take_mobile_money')
  generateSplitPaymentLink(
    @Param('id') orderId: string,
    @Param('splitId') billId: string,
    @Req() req: Request,
  ) {
    return this.paymentsService.generateSplitPaymentLink(req.authContext!, orderId, billId, billId)
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
  // M-Pesa C2B (Paybill/Till manual payment)
  // ---------------------------------------------------------------------------
  // POST /api/v1/payments/mpesa-c2b/register
  @Post('payments/mpesa-c2b/register')
  @RequirePermission('payments:connect_integration')
  registerMpesaC2b(@ValidatedBody(RegisterMpesaC2bDto) dto: RegisterMpesaC2bDto, @Req() req: Request) {
    return this.paymentsService.registerMpesaC2b(req.authContext!, dto)
  }

  // GET /api/v1/payments/mpesa-c2b/unmatched
  @Get('payments/mpesa-c2b/unmatched')
  @RequirePermission('payments:reconcile')
  listUnmatchedMpesaC2b(@Req() req: Request) {
    return this.paymentsService.listUnmatchedMpesaC2b(req.authContext!)
  }

  // POST /api/v1/payments/mpesa-c2b/:transactionId/match
  @Post('payments/mpesa-c2b/:transactionId/match')
  @RequirePermission('payments:reconcile')
  matchMpesaC2b(
    @Param('transactionId') transactionId: string,
    @ValidatedBody(MatchMpesaC2bDto) dto: MatchMpesaC2bDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.matchMpesaC2b(req.authContext!, transactionId, dto)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  // GET /api/v1/payments/unreconciled
  @Get('payments/unreconciled')
  @RequirePermission('payments:reconcile')
  listUnreconciled(@Req() req: Request, @Query('locationId') locationId: string) {
    return this.paymentsService.listUnreconciled(req.authContext!, locationId)
  }

  // POST /api/v1/payments/:id/reconcile
  @Post('payments/:id/reconcile')
  @HttpCode(200)
  @RequirePermission('payments:reconcile')
  reconcilePayment(@Param('id') id: string, @Req() req: Request) {
    return this.paymentsService.reconcilePayment(req.authContext!, id)
  }

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
// Each provider signs (or doesn't sign) its webhook payload differently —
// mpesa_daraja/airtel_money_api/pesapal don't sign at all (their adapters
// ignore the `signature` argument), paystack HMAC-signs via this header,
// flutterwave echoes back a static configured hash via this header. Kept in
// the controller (HTTP-layer concern) rather than the service, same as the
// header names the old per-provider handlers each hardcoded individually.
const WEBHOOK_SIGNATURE_HEADER: Partial<Record<string, string>> = {
  paystack: 'x-paystack-signature',
  flutterwave: 'verif-hash',
}

@Controller('api/v1/webhooks')
export class PaymentsWebhookController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  // POST /api/v1/webhooks/:provider/:orgId
  // One route for every PaymentAdapter-based provider (mpesa_daraja,
  // paystack, airtel_money_api, flutterwave, pesapal) — verification is
  // fully delegated to that provider's adapter via
  // PaymentsService.handleProviderWebhook, so this route needs no
  // provider-specific logic beyond picking the right signature header.
  @Post(':provider/:orgId')
  @HttpCode(200)
  handleProviderWebhook(
    @Param('provider') provider: string,
    @Param('orgId') orgId: string,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ) {
    const rawPayload = JSON.stringify(req.body)
    const signatureHeader = WEBHOOK_SIGNATURE_HEADER[provider]
    const signature = signatureHeader ? (req.headers[signatureHeader] as string | undefined) : undefined
    return this.paymentsService.handleProviderWebhook(orgId, provider, rawPayload, signature, headers)
  }

  // POST /api/v1/webhooks/mpesa/c2b/validation/:orgId
  // Called before a C2B (Paybill/Till) payment settles — only if Safaricom
  // has separately enabled Validation for the shortcode (disabled by
  // default). Must respond fast; no signature (M-Pesa doesn't sign C2B).
  @Post('mpesa/c2b/validation/:orgId')
  @HttpCode(200)
  handleMpesaC2bValidation(@Req() req: Request) {
    return this.paymentsService.handleMpesaC2bValidation(req.body)
  }

  // POST /api/v1/webhooks/mpesa/c2b/confirmation/:orgId
  // Called after a C2B payment has already settled. Always ACKs 200 — this
  // is a notice, not a request awaiting accept/reject.
  @Post('mpesa/c2b/confirmation/:orgId')
  @HttpCode(200)
  handleMpesaC2bConfirmation(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.paymentsService.handleMpesaC2bConfirmation(orgId, req.body)
  }

}
