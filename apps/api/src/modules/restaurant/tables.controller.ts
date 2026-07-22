import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateTableDto } from './dto/create-table.dto.js'
import { MergeTablesDto } from './dto/merge-tables.dto.js'
import { TransferTableDto } from './dto/transfer-table.dto.js'
import { UpdateTableDto } from './dto/update-table.dto.js'
import { UpdateTableStatusDto } from './dto/update-table-status.dto.js'
import { TablesService } from './tables.service.js'

@Controller('api/v1/tables')
@UseGuards(JwtAuthGuard)
export class TablesController {
  constructor(@Inject(TablesService) private readonly tablesService: TablesService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('locationId') locationId?: string,
    @Query('floorPlanId') floorPlanId?: string,
    @Query('section') section?: string,
    @Query('status') status?: string,
  ) {
    return this.tablesService.list(req.authContext!, { locationId, floorPlanId, section, status })
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.tablesService.getById(req.authContext!, id)
  }

  @Post()
  @RequirePermission('tables:edit_layout')
  create(@ValidatedBody(CreateTableDto) dto: CreateTableDto, @Req() req: Request) {
    return this.tablesService.create(req.authContext!, dto)
  }

  @Patch(':id')
  @RequirePermission('tables:edit_layout')
  update(@Param('id') id: string, @ValidatedBody(UpdateTableDto) dto: UpdateTableDto, @Req() req: Request) {
    return this.tablesService.update(req.authContext!, id, dto)
  }

  @Patch(':id/status')
  @RequirePermission('tables:manage')
  setStatus(@Param('id') id: string, @ValidatedBody(UpdateTableStatusDto) dto: UpdateTableStatusDto, @Req() req: Request) {
    return this.tablesService.setStatus(req.authContext!, id, dto)
  }

  @Post('merge')
  @HttpCode(200)
  @RequirePermission('tables:manage')
  merge(@ValidatedBody(MergeTablesDto) dto: MergeTablesDto, @Req() req: Request) {
    return this.tablesService.merge(req.authContext!, dto)
  }

  @Post(':id/unmerge')
  @HttpCode(200)
  @RequirePermission('tables:manage')
  unmerge(@Param('id') id: string, @Req() req: Request) {
    return this.tablesService.unmerge(req.authContext!, id)
  }

  @Post(':id/transfer')
  @HttpCode(200)
  @RequirePermission('tables:manage')
  transfer(@Param('id') id: string, @ValidatedBody(TransferTableDto) dto: TransferTableDto, @Req() req: Request) {
    return this.tablesService.transfer(req.authContext!, id, dto)
  }
}
