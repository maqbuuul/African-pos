import { Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateMenuDto } from './dto/create-menu.dto.js'
import { MenusService } from './menus.service.js'

@Controller('api/v1/menus')
@UseGuards(JwtAuthGuard)
export class MenusController {
  constructor(@Inject(MenusService) private readonly menusService: MenusService) {}

  @Get()
  list(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.menusService.list(req.authContext!, locationId)
  }

  @Post()
  @RequirePermission('products:manage')
  create(@ValidatedBody(CreateMenuDto) dto: CreateMenuDto, @Req() req: Request) {
    return this.menusService.create(req.authContext!, dto)
  }
}
