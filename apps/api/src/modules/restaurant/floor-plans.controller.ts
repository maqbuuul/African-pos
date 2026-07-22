import { Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateFloorPlanDto } from './dto/create-floor-plan.dto.js'
import { UpdateFloorPlanDto } from './dto/update-floor-plan.dto.js'
import { FloorPlansService } from './floor-plans.service.js'

@Controller('api/v1/floor-plans')
@UseGuards(JwtAuthGuard)
export class FloorPlansController {
  constructor(@Inject(FloorPlansService) private readonly floorPlansService: FloorPlansService) {}

  @Get()
  list(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.floorPlansService.list(req.authContext!, locationId)
  }

  @Post()
  @RequirePermission('tables:edit_layout')
  create(@ValidatedBody(CreateFloorPlanDto) dto: CreateFloorPlanDto, @Req() req: Request) {
    return this.floorPlansService.create(req.authContext!, dto)
  }

  @Patch(':id')
  @RequirePermission('tables:edit_layout')
  update(@Param('id') id: string, @ValidatedBody(UpdateFloorPlanDto) dto: UpdateFloorPlanDto, @Req() req: Request) {
    return this.floorPlansService.update(req.authContext!, id, dto)
  }
}
