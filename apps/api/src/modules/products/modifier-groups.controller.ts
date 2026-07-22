import { Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto.js'
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto.js'
import { ModifierGroupsService } from './modifier-groups.service.js'

@Controller('api/v1/modifier-groups')
@UseGuards(JwtAuthGuard)
export class ModifierGroupsController {
  constructor(@Inject(ModifierGroupsService) private readonly modifierGroupsService: ModifierGroupsService) {}

  @Get()
  list(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.modifierGroupsService.list(req.authContext!, locationId)
  }

  @Post()
  @RequirePermission('products:manage')
  create(@ValidatedBody(CreateModifierGroupDto) dto: CreateModifierGroupDto, @Req() req: Request) {
    return this.modifierGroupsService.create(req.authContext!, dto)
  }

  @Patch(':id')
  @RequirePermission('products:manage')
  update(@Param('id') id: string, @ValidatedBody(UpdateModifierGroupDto) dto: UpdateModifierGroupDto, @Req() req: Request) {
    return this.modifierGroupsService.update(req.authContext!, id, dto)
  }
}
