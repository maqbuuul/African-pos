import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { AuditService } from './audit.service.js'

@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('audit:view')
  list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.auditService.list(req.authContext!, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
    })
  }

  @Get(':id')
  @RequirePermission('audit:view')
  getById(@Param('id') id: string, @Req() req: Request) {
    return this.auditService.getById(req.authContext!, id)
  }
}
