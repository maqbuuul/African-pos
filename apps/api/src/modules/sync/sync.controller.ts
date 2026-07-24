import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { PushOperationsDto } from './dto/push-operations.dto.js'
import { QueueEtimsDto } from './dto/queue-etims.dto.js'
import { ResolveConflictDto } from './dto/resolve-conflict.dto.js'
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto.js'
import { SyncService } from './sync.service.js'

@Controller('api/v1/sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Post('push')
  pushOperations(
    @Req() req: Request,
    @ValidatedBody(PushOperationsDto) dto: PushOperationsDto,
  ) {
    return this.syncService.pushOperations(req.authContext!, dto)
  }

  @Get('device-health')
  @RequirePermission('sync:view_device_health')
  getDeviceHealth(
    @Req() req: Request,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.syncService.getDeviceHealth(req.authContext!, deviceId)
  }

  @Get('device-sync-health/:deviceId')
  @RequirePermission('sync:view_device_health')
  getDeviceSyncHealth(
    @Req() req: Request,
    @Param('deviceId') deviceId: string,
  ) {
    return this.syncService.getDeviceSyncHealth(req.authContext!, deviceId)
  }

  @Get('conflicts')
  @RequirePermission('sync:view_conflicts')
  listConflicts(
    @Req() req: Request,
    @Query('resolution') resolution?: string,
  ) {
    return this.syncService.listConflicts(req.authContext!, resolution)
  }

  @Patch('conflicts/:id/resolve')
  @RequirePermission('sync:resolve_conflicts')
  resolveConflict(
    @Req() req: Request,
    @Param('id') id: string,
    @ValidatedBody(ResolveConflictDto) dto: ResolveConflictDto,
  ) {
    return this.syncService.resolveConflict(req.authContext!, { ...dto, conflictId: id })
  }

  @Post('queue-etims')
  @RequirePermission('sync:push')
  queueEtims(
    @Req() req: Request,
    @ValidatedBody(QueueEtimsDto) body: QueueEtimsDto,
  ) {
    return this.syncService.queueOfflineETimsSubmission(req.authContext!, body.receiptId, body.billId)
  }

  @Post('device-status')
  updateDeviceStatus(
    @Req() req: Request,
    @ValidatedBody(UpdateDeviceStatusDto) body: UpdateDeviceStatusDto,
  ) {
    return this.syncService.updateDeviceStatus(
      req.authContext!,
      body.deviceId,
      body.status,
      body.batteryLevel,
      body.onBattery,
    )
  }
}
