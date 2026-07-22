import {
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { AdjustDrawerDto } from './dto/adjust-drawer.dto.js'
import { CloseShiftDto } from './dto/close-shift.dto.js'
import { OpenShiftDto } from './dto/open-shift.dto.js'
import { ReopenShiftDto } from './dto/reopen-shift.dto.js'
import { ShiftsService } from './shifts.service.js'

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(@Inject(ShiftsService) private readonly shiftsService: ShiftsService) {}

  @Post('shifts/open')
  @RequirePermission('shifts:open')
  open(@Req() req: Request, @ValidatedBody(OpenShiftDto) dto: OpenShiftDto) {
    return this.shiftsService.open(req.authContext!, dto)
  }

  @Post('shifts/:id/close')
  @RequirePermission('shifts:close')
  close(
    @Req() req: Request,
    @Param('id') id: string,
    @ValidatedBody(CloseShiftDto) dto: CloseShiftDto,
  ) {
    return this.shiftsService.close(req.authContext!, id, dto)
  }

  @Get('shifts/active')
  getActive(
    @Req() req: Request,
    @Query('locationId') locationId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.shiftsService.getActive(req.authContext!, locationId, deviceId)
  }

  @Get('shifts')
  list(
    @Req() req: Request,
    @Query('locationId') locationId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.shiftsService.list(req.authContext!, locationId, limit, offset)
  }

  @Get('shifts/:id')
  getById(@Req() req: Request, @Param('id') id: string) {
    return this.shiftsService.getById(req.authContext!, id)
  }

  @Get('shifts/:id/live-pnl')
  @RequirePermission('shifts:view_pnl')
  getLivePnl(@Req() req: Request, @Param('id') id: string) {
    return this.shiftsService.getLivePnl(req.authContext!, id)
  }

  @Get('shifts/:id/close-report')
  getCloseReport(@Req() req: Request, @Param('id') id: string) {
    return this.shiftsService.getCloseReport(req.authContext!, id)
  }

  @Post('shifts/:id/cash-drawer/adjust')
  @RequirePermission('shifts:adjust_cash', { allowOverride: true, entityType: 'shift' })
  adjustDrawer(
    @Req() req: Request,
    @Param('id') id: string,
    @ValidatedBody(AdjustDrawerDto) dto: AdjustDrawerDto,
  ) {
    return this.shiftsService.adjustDrawer(req.authContext!, id, dto)
  }

  @Post('shifts/:id/reopen')
  @RequirePermission('shifts:reopen')
  reopen(
    @Req() req: Request,
    @Param('id') id: string,
    @ValidatedBody(ReopenShiftDto) dto: ReopenShiftDto,
  ) {
    return this.shiftsService.reopen(req.authContext!, id, dto.reason)
  }
}
