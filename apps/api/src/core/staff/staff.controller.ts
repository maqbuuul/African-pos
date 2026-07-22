import { Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { RequirePermission } from '../permissions/require-permission.decorator.js'
import { StaffService } from './staff.service.js'

@Controller('api/v1/staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(@Inject(StaffService) private readonly staffService: StaffService) {}

  // "Delete or deactivate record" is explicitly one of the sensitive actions
  // requiring approval (master plan Module 2) — allowOverride lets a staff
  // member who lacks staff:deactivate trigger a manager-approvable request
  // instead of a flat 403 (see PermissionsGuard).
  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermission('staff:deactivate', { allowOverride: true, entityType: 'staff' })
  deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.staffService.deactivate(req.authContext!, id)
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermission('staff:deactivate', { entityType: 'staff' })
  reactivate(@Param('id') id: string, @Req() req: Request) {
    return this.staffService.reactivate(req.authContext!, id)
  }
}
