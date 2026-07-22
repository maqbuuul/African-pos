import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateKdsStationDto } from './dto/create-kds-station.dto.js'
import { UpdateKdsStationDto } from './dto/update-kds-station.dto.js'
import { KdsService } from './kds.service.js'

@Controller('api/v1/kds')
@UseGuards(JwtAuthGuard)
export class KdsController {
  constructor(@Inject(KdsService) private readonly kdsService: KdsService) {}

  @Get('stations')
  listStations(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.kdsService.listStations(req.authContext!, locationId)
  }

  @Post('stations')
  @RequirePermission('kds:manage_stations')
  createStation(@ValidatedBody(CreateKdsStationDto) dto: CreateKdsStationDto, @Req() req: Request) {
    return this.kdsService.createStation(req.authContext!, dto)
  }

  @Patch('stations/:stationId')
  @RequirePermission('kds:manage_stations')
  updateStation(
    @Param('stationId') stationId: string,
    @ValidatedBody(UpdateKdsStationDto) dto: UpdateKdsStationDto,
    @Req() req: Request,
  ) {
    return this.kdsService.updateStation(req.authContext!, stationId, dto)
  }

  @Get('stations/:stationId/tickets')
  listStationTickets(@Param('stationId') stationId: string, @Req() req: Request) {
    return this.kdsService.listStationTickets(req.authContext!, stationId)
  }

  @Get('stations/:stationId/printable-tickets')
  printableTickets(@Param('stationId') stationId: string, @Req() req: Request) {
    return this.kdsService.getPrintableTickets(req.authContext!, stationId)
  }

  @Get('expo')
  expo(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.kdsService.getExpoView(req.authContext!, locationId)
  }

  @Get('cook-time-analytics')
  cookTimeAnalytics(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.kdsService.getCookTimeAnalytics(req.authContext!, locationId)
  }

  @Post('tickets/:ticketItemId/accept')
  @HttpCode(200)
  accept(@Param('ticketItemId') ticketItemId: string, @Req() req: Request) {
    return this.kdsService.acceptTicketItem(req.authContext!, ticketItemId)
  }

  @Post('tickets/:ticketItemId/start')
  @HttpCode(200)
  start(@Param('ticketItemId') ticketItemId: string, @Req() req: Request) {
    return this.kdsService.startTicketItem(req.authContext!, ticketItemId)
  }

  @Post('tickets/:ticketItemId/bump')
  @HttpCode(200)
  bump(@Param('ticketItemId') ticketItemId: string, @Req() req: Request) {
    return this.kdsService.bumpTicketItem(req.authContext!, ticketItemId)
  }

  @Post('tickets/:ticketItemId/recall')
  @HttpCode(200)
  recall(@Param('ticketItemId') ticketItemId: string, @Req() req: Request) {
    return this.kdsService.recallTicketItem(req.authContext!, ticketItemId)
  }

  @Post('tickets/:ticketId/bump-all')
  @HttpCode(200)
  bumpAll(@Param('ticketId') ticketId: string, @Req() req: Request) {
    return this.kdsService.bumpTicket(req.authContext!, ticketId)
  }

  @Post('tickets/:ticketItemId/acknowledge-void')
  @HttpCode(200)
  acknowledgeVoid(@Param('ticketItemId') ticketItemId: string, @Req() req: Request) {
    return this.kdsService.acknowledgeVoid(req.authContext!, ticketItemId)
  }
}
