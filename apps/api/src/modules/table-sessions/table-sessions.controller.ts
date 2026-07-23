import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { TableSessionGuard } from '../../core/auth/table-session.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateTableSessionDto } from './dto/create-table-session.dto.js'
import { TableSessionsService } from './table-sessions.service.js'

@Controller()
export class TableSessionsController {
  constructor(@Inject(TableSessionsService) private readonly tableSessionsService: TableSessionsService) {}

  @Post('api/v1/table-sessions')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tables:manage')
  create(@Body() body: CreateTableSessionDto, _req: Request) {
    return this.tableSessionsService.createSession(body.qrSlug)
  }

  @Post('public/table-sessions')
  createPublic(@Body() body: CreateTableSessionDto) {
    return this.tableSessionsService.createSession(body.qrSlug)
  }

  @Get('public/table-sessions/:token/menu')
  @UseGuards(TableSessionGuard)
  getMenu(@Req() req: Request) {
    return this.tableSessionsService.getPublicMenu(req.tableSession!)
  }

  @Get('public/table-sessions/:token/order')
  @UseGuards(TableSessionGuard)
  getOrder(@Req() req: Request) {
    return req.tableSession
  }
}
