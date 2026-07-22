import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

// Requires only that the request carry a valid, verified auth context — for
// routes that need "someone is logged in" without a specific permission
// (PermissionsGuard handles the latter). TenantContextMiddleware has already
// verified the token by the time this runs; this guard just enforces that it
// was present and valid.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (!request.authContext) throw new UnauthorizedException()
    return true
  }
}
