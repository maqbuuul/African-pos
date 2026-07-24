import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { AddCustomerTagDto } from './dto/add-customer-tag.dto.js'
import { ChargeCreditAccountDto } from './dto/charge-credit-account.dto.js'
import { CreateCreditAccountDto } from './dto/create-credit-account.dto.js'
import { CreateCustomerDto } from './dto/create-customer.dto.js'
import { CreateFeedbackDto } from './dto/create-feedback.dto.js'
import { CreateGiftCardDto } from './dto/create-gift-card.dto.js'
import { CreateLoyaltyAccountDto } from './dto/create-loyalty-account.dto.js'
import { EarnLoyaltyPointsDto } from './dto/earn-loyalty-points.dto.js'
import { FindOrCreateCustomerDto } from './dto/find-or-create-customer.dto.js'
import { MergeCustomersDto } from './dto/merge-customers.dto.js'
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto.js'
import { RedeemLoyaltyPointsDto } from './dto/redeem-loyalty-points.dto.js'
import { SettleCreditAccountDto } from './dto/settle-credit-account.dto.js'
import { SetupChamaRoutingDto } from './dto/setup-chama-routing.dto.js'
import { UpdateCustomerDto } from './dto/update-customer.dto.js'
import { CrmService } from './crm.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(@Inject(CrmService) private readonly crmService: CrmService) {}

  // ---- Customers ----
  @Post('customers')
  @HttpCode(201)
  @RequirePermission('customers:create')
  createCustomer(@Req() req: Request, @ValidatedBody(CreateCustomerDto) dto: CreateCustomerDto) {
    return this.crmService.createCustomer(req.authContext!, dto)
  }

  @Get('customers')
  @RequirePermission('customers:view')
  listCustomers(@Req() req: Request, @Query('search') search?: string, @Query('limit') limit?: string) {
    return this.crmService.listCustomers(req.authContext!, { search, limit: limit ? Number(limit) : undefined })
  }

  @Get('customers/:id')
  @RequirePermission('customers:view')
  getCustomer(@Req() req: Request, @Param('id') id: string) {
    return this.crmService.getCustomer(req.authContext!, id)
  }

  @Patch('customers/:id')
  @HttpCode(200)
  @RequirePermission('customers:edit')
  updateCustomer(
    @Req() req: Request,
    @Param('id') id: string,
    @ValidatedBody(UpdateCustomerDto) data: UpdateCustomerDto,
  ) {
    return this.crmService.updateCustomer(req.authContext!, id, data)
  }

  @Post('customers/:id/tags')
  @HttpCode(201)
  @RequirePermission('customers:edit')
  addTag(@Req() req: Request, @Param('id') id: string, @ValidatedBody(AddCustomerTagDto) dto: AddCustomerTagDto) {
    return this.crmService.addTag(req.authContext!, id, dto.tag)
  }

  @Post('customers/merge')
  @HttpCode(200)
  @RequirePermission('customers:merge')
  mergeCustomers(@Req() req: Request, @ValidatedBody(MergeCustomersDto) dto: MergeCustomersDto) {
    return this.crmService.mergeCustomers(req.authContext!, dto.targetId, dto.sourceId)
  }

  @Post('customers/find-or-create')
  @HttpCode(200)
  @RequirePermission('customers:view')
  findOrCreateCustomer(@Req() req: Request, @ValidatedBody(FindOrCreateCustomerDto) data: FindOrCreateCustomerDto) {
    return this.crmService.findOrCreateByPhone(req.authContext!, data)
  }

  // ---- Loyalty ----
  @Post('loyalty/accounts')
  @HttpCode(201)
  @RequirePermission('loyalty:manage')
  createLoyaltyAccount(@Req() req: Request, @ValidatedBody(CreateLoyaltyAccountDto) dto: CreateLoyaltyAccountDto) {
    return this.crmService.createLoyaltyAccount(req.authContext!, dto)
  }

  @Get('loyalty/accounts/:id')
  @RequirePermission('customers:view')
  getLoyaltyAccount(@Req() req: Request, @Param('id') id: string) {
    return this.crmService.getLoyaltyAccount(req.authContext!, id)
  }

  @Post('loyalty/accounts/:id/redeem')
  @HttpCode(200)
  @RequirePermission('loyalty:redeem')
  redeemLoyaltyPoints(@Req() req: Request, @Param('id') id: string, @ValidatedBody(RedeemLoyaltyPointsDto) dto: RedeemLoyaltyPointsDto) {
    return this.crmService.redeemLoyaltyPoints(req.authContext!, id, dto.points)
  }

  @Post('loyalty/accounts/:accountId/earn')
  @RequirePermission('loyalty:earn')
  earnLoyaltyPoints(@Param('accountId') accountId: string, @ValidatedBody(EarnLoyaltyPointsDto) body: EarnLoyaltyPointsDto, @Req() req: Request) {
    return this.crmService.earnLoyaltyPoints(req.authContext!, accountId, body.points, body.description)
  }

  // ---- Gift cards ----
  @Post('gift-cards')
  @HttpCode(201)
  @RequirePermission('gift_cards:manage')
  createGiftCard(@Req() req: Request, @ValidatedBody(CreateGiftCardDto) data: CreateGiftCardDto) {
    return this.crmService.createGiftCard(req.authContext!, data)
  }

  @Get('gift-cards/:code')
  @RequirePermission('gift_cards:view')
  getGiftCard(@Req() req: Request, @Param('code') code: string) {
    return this.crmService.getGiftCard(req.authContext!, code)
  }

  @Get('gift-cards')
  @RequirePermission('gift_cards:view')
  listGiftCards(@Req() req: Request) {
    return this.crmService.listGiftCards(req.authContext!)
  }

  @Post('gift-cards/:code/redeem')
  @HttpCode(200)
  @RequirePermission('gift_cards:redeem')
  redeemGiftCard(@Req() req: Request, @Param('code') code: string, @ValidatedBody(RedeemGiftCardDto) dto: RedeemGiftCardDto) {
    return this.crmService.redeemGiftCard(req.authContext!, code, dto.amount)
  }

  // ---- Customer credit ----
  @Post('customer-credit-accounts')
  @HttpCode(201)
  @RequirePermission('credit_accounts:manage')
  createCreditAccount(@Req() req: Request, @ValidatedBody(CreateCreditAccountDto) dto: CreateCreditAccountDto) {
    return this.crmService.createCreditAccount(req.authContext!, dto)
  }

  @Get('customer-credit-accounts/:customerId')
  @RequirePermission('customers:view')
  getCreditAccount(@Req() req: Request, @Param('customerId') customerId: string) {
    return this.crmService.getCreditAccount(req.authContext!, customerId)
  }

  @Post('customer-credit-accounts/:customerId/charge')
  @HttpCode(200)
  @RequirePermission('credit_accounts:charge')
  chargeCreditAccount(@Req() req: Request, @Param('customerId') customerId: string, @ValidatedBody(ChargeCreditAccountDto) dto: ChargeCreditAccountDto) {
    return this.crmService.chargeCreditAccount(req.authContext!, customerId, dto.amount)
  }

  @Post('customer-credit-accounts/:customerId/settle')
  @HttpCode(200)
  @RequirePermission('credit_accounts:settle')
  settleCreditAccount(@Req() req: Request, @Param('customerId') customerId: string, @ValidatedBody(SettleCreditAccountDto) dto: SettleCreditAccountDto) {
    return this.crmService.settleCreditAccount(req.authContext!, customerId, dto.amount)
  }

  // ---- Feedback / Reviews ----
  @Get('reviews')
  @RequirePermission('reviews:view')
  listFeedback(@Req() req: Request, @Query('locationId') locationId?: string, @Query('isNegative') isNegative?: string, @Query('limit') limit?: string) {
    return this.crmService.listFeedback(req.authContext!, {
      locationId,
      isNegative: isNegative ? isNegative === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('reviews')
  @RequirePermission('reviews:create')
  createFeedback(@ValidatedBody(CreateFeedbackDto) body: CreateFeedbackDto, @Req() req: Request) {
    return this.crmService.createFeedback(req.authContext!, body)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  @Get('customers/reports/summary')
  @RequirePermission('customers:view')
  customerSummary(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.crmService.customerSummaryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('loyalty/reports/summary')
  @RequirePermission('customers:view')
  loyaltySummary(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.crmService.loyaltySummaryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  @Get('reviews/reports/summary')
  @RequirePermission('reviews:view')
  feedbackSummary(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.crmService.feedbackSummaryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }

  // ---- Chama / SACCO auto-routing ----
  @Post('chama/routing')
  @HttpCode(200)
  @RequirePermission('customers:edit')
  setupChamaRouting(@Req() req: Request, @ValidatedBody(SetupChamaRoutingDto) dto: SetupChamaRoutingDto) {
    return this.crmService.setupChamaRouting(req.authContext!, dto.percentage, dto.linkedAccountRef)
  }

  @Post('chama/routing/process/:locationId')
  @HttpCode(200)
  @RequirePermission('customers:view')
  processChamaRouting(@Req() req: Request, @Param('locationId') locationId: string) {
    return this.crmService.processChamaRouting(req.authContext!, locationId)
  }

  // ---- Sentiment alerts ----
  @Get('reviews/sentiment-alerts/:locationId')
  @RequirePermission('reviews:view')
  getSentimentAlerts(@Req() req: Request, @Param('locationId') locationId: string) {
    return this.crmService.getSentimentAlerts(req.authContext!, locationId)
  }
}
