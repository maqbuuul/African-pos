import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { CreateCreditAccountDto } from './dto/create-credit-account.dto.js'
import { CreateCustomerDto } from './dto/create-customer.dto.js'
import { CreateLoyaltyAccountDto } from './dto/create-loyalty-account.dto.js'
import { CrmService } from './crm.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ---- Customers ----
  @Post('customers')
  @HttpCode(201)
  @RequirePermission('customers:create')
  createCustomer(@Req() req: Request, @Body() dto: CreateCustomerDto) {
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
    @Body() data: { firstName?: string; lastName?: string; notes?: string; allergyNotes?: string; phone?: string; email?: string },
  ) {
    return this.crmService.updateCustomer(req.authContext!, id, data)
  }

  @Post('customers/:id/tags')
  @HttpCode(201)
  @RequirePermission('customers:edit')
  addTag(@Req() req: Request, @Param('id') id: string, @Body('tag') tag: string) {
    return this.crmService.addTag(req.authContext!, id, tag)
  }

  @Post('customers/merge')
  @HttpCode(200)
  @RequirePermission('customers:merge')
  mergeCustomers(@Req() req: Request, @Body('targetId') targetId: string, @Body('sourceId') sourceId: string) {
    return this.crmService.mergeCustomers(req.authContext!, targetId, sourceId)
  }

  @Post('customers/find-or-create')
  @HttpCode(200)
  @RequirePermission('customers:view')
  findOrCreateCustomer(@Req() req: Request, @Body() data: { phone?: string; email?: string; firstName?: string; lastName?: string }) {
    return this.crmService.findOrCreateByPhone(req.authContext!, data)
  }

  // ---- Loyalty ----
  @Post('loyalty/accounts')
  @HttpCode(201)
  @RequirePermission('loyalty:manage')
  createLoyaltyAccount(@Req() req: Request, @Body() dto: CreateLoyaltyAccountDto) {
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
  redeemLoyaltyPoints(@Req() req: Request, @Param('id') id: string, @Body('points') points: number) {
    return this.crmService.redeemLoyaltyPoints(req.authContext!, id, points)
  }

  // ---- Gift cards ----
  @Post('gift-cards')
  @HttpCode(201)
  @RequirePermission('gift_cards:manage')
  createGiftCard(@Req() req: Request, @Body() data: { code: string; initialBalance: number; currency: string; expiresAt?: string }) {
    return this.crmService.createGiftCard(req.authContext!, data)
  }

  @Get('gift-cards/:code')
  @RequirePermission('gift_cards:view')
  getGiftCard(@Req() req: Request, @Param('code') code: string) {
    return this.crmService.getGiftCard(req.authContext!, code)
  }

  @Post('gift-cards/:code/redeem')
  @HttpCode(200)
  @RequirePermission('gift_cards:redeem')
  redeemGiftCard(@Req() req: Request, @Param('code') code: string, @Body('amount') amount: number) {
    return this.crmService.redeemGiftCard(req.authContext!, code, amount)
  }

  // ---- Customer credit ----
  @Post('customer-credit-accounts')
  @HttpCode(201)
  @RequirePermission('credit_accounts:manage')
  createCreditAccount(@Req() req: Request, @Body() dto: CreateCreditAccountDto) {
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
  chargeCreditAccount(@Req() req: Request, @Param('customerId') customerId: string, @Body('amount') amount: number) {
    return this.crmService.chargeCreditAccount(req.authContext!, customerId, amount)
  }

  @Post('customer-credit-accounts/:customerId/settle')
  @HttpCode(200)
  @RequirePermission('credit_accounts:settle')
  settleCreditAccount(@Req() req: Request, @Param('customerId') customerId: string, @Body('amount') amount: number) {
    return this.crmService.settleCreditAccount(req.authContext!, customerId, amount)
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
}
