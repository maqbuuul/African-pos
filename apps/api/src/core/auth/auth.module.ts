import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module.js'
import { PermissionsModule } from '../permissions/permissions.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { SessionsService } from './sessions.service.js'

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [AuthController],
  providers: [AuthService, SessionsService],
})
export class AuthModule {}
