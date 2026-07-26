import { Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CreateOrganizationDto } from './dto/create-organization.dto.js'
import { UpdateOrganizationDto } from './dto/update-organization.dto.js'
import { OrganizationService } from './organization.service.js'

@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly organizationService: OrganizationService) {}

  @Get()
  @RequirePermission('organizations:view')
  list(@Req() req: Request) {
    return this.organizationService.list(req.authContext!)
  }

  @Get(':id')
  @RequirePermission('organizations:view')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.organizationService.getById(req.authContext!, id)
  }

  // No @RequirePermission: this is basic org membership info (which
  // locations exist), not a sensitive resource — same tier as GET /auth/me,
  // which every authenticated actor can already read. `organizations:view`
  // isn't in the seeded permission catalog at all (see
  // packages/database/src/seed/index.ts), so gating this the same way as
  // the sibling endpoints above would make it unreachable for every role.
  @Get(':id/locations')
  listLocations(@Param('id') id: string, @Req() req: Request) {
    return this.organizationService.listLocations(req.authContext!, id)
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('organizations:create')
  create(@ValidatedBody(CreateOrganizationDto) dto: CreateOrganizationDto, @Req() req: Request) {
    return this.organizationService.create(req.authContext!, dto)
  }

  @Patch(':id')
  @RequirePermission('organizations:update')
  update(@Param('id') id: string, @ValidatedBody(UpdateOrganizationDto) dto: UpdateOrganizationDto, @Req() req: Request) {
    return this.organizationService.update(req.authContext!, id, dto)
  }
}
