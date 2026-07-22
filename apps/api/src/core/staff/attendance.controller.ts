import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { RequirePermission } from '../permissions/require-permission.decorator.js'
import { AttendanceService } from './attendance.service.js'

@Controller('api/v1/staff/attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  @HttpCode(200)
  @RequirePermission('attendance:clock_inout')
  clockIn(@Req() req: Request, @Body('locationId') locationId: string) {
    return this.attendanceService.clockIn(req.authContext!, req.authContext!.actorId, locationId)
  }

  @Post('clock-out')
  @HttpCode(200)
  @RequirePermission('attendance:clock_inout')
  clockOut(@Req() req: Request) {
    return this.attendanceService.clockOut(req.authContext!, req.authContext!.actorId)
  }

  @Get()
  @RequirePermission('attendance:manage')
  listByLocation(
    @Req() req: Request,
    @Query('locationId') locationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendanceService.findByLocation(
      req.authContext!,
      locationId,
      limit ? Number(limit) : undefined,
    )
  }

  @Get('staff/:staffId')
  @RequirePermission('attendance:manage')
  listByStaff(
    @Req() req: Request,
    @Param('staffId') staffId: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendanceService.findByStaff(
      req.authContext!,
      staffId,
      limit ? Number(limit) : undefined,
    )
  }

  @Get('reports/summary')
  @RequirePermission('attendance:manage')
  summary(@Req() req: Request, @Query('locationId') locationId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.attendanceService.attendanceSummaryReport(req.authContext!, locationId, new Date(from), new Date(to))
  }
}
