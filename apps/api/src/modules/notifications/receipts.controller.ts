import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js'
import { SendReceiptDto } from './dto/send-receipt.dto.js'
import { ReceiptsService } from './receipts.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly receiptsService: ReceiptsService) {}

  @Post('receipts/:billId/generate')
  @RequirePermission('receipts:generate')
  generate(
    @Req() req: Request,
    @Param('billId') billId: string,
    @Query('phone') phone?: string,
    @Query('email') email?: string,
  ) {
    return this.receiptsService.generate(req.authContext!, billId, phone, email)
  }

  @Post('receipts/:id/send')
  @RequirePermission('receipts:send')
  send(
    @Req() req: Request,
    @Param('id') id: string,
    @ValidatedBody(SendReceiptDto) dto: SendReceiptDto,
  ) {
    return this.receiptsService.send(req.authContext!, id, dto)
  }

  @Get('receipts/:id/status')
  @RequirePermission('receipts:view_status')
  getStatus(@Req() req: Request, @Param('id') id: string) {
    return this.receiptsService.getStatus(req.authContext!, id)
  }

  @Post('receipts/:id/submit-tax')
  @RequirePermission('receipts:send')
  submitTax(@Req() req: Request, @Param('id') id: string) {
    return this.receiptsService.submitToTaxAuthority(req.authContext!, id)
  }

  @Post('notifications/preferences')
  @RequirePermission('receipts:configure_preferences')
  updatePreferences(
    @Req() req: Request,
    @ValidatedBody(UpdatePreferencesDto) dto: UpdatePreferencesDto,
    @Query('subjectType') subjectType: 'staff' | 'customer',
    @Query('subjectId') subjectId: string,
  ) {
    return this.receiptsService.updatePreferences(req.authContext!, dto, subjectType, subjectId)
  }

  @Get('notifications/preferences')
  @RequirePermission('receipts:configure_preferences')
  getPreferences(
    @Req() req: Request,
    @Query('subjectType') subjectType: 'staff' | 'customer',
    @Query('subjectId') subjectId: string,
  ) {
    return this.receiptsService.getPreferences(req.authContext!, subjectType, subjectId)
  }
}
