import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { AuditModule } from './core/audit/audit.module.js'
import { AuthModule } from './core/auth/auth.module.js'
import { EventsModule } from './core/events/events.module.js'
import { HealthModule } from './core/http/health.module.js'
import { PermissionsModule } from './core/permissions/permissions.module.js'
import { ResponseEnvelopeInterceptor } from './core/response-envelope/response-envelope.interceptor.js'
import { StaffModule } from './core/staff/staff.module.js'
import { TenantContextMiddleware } from './core/tenant/tenant-context.middleware.js'
import { TenantModule } from './core/tenant/tenant.module.js'
import { DomainModulesModule } from './modules/index.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    TenantModule,
    AuditModule,
    AuthModule,
    EventsModule,
    PermissionsModule,
    StaffModule,
    HealthModule,
    DomainModulesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*')
  }
}
