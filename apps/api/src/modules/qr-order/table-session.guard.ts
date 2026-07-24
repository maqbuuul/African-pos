import { createParamDecorator, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { verifyTableSessionToken, type TableSessionClaims } from './table-session.js'

declare module 'express-serve-static-core' {
  interface Request {
    tableSession?: TableSessionClaims
  }
}

@Injectable()
export class TableSessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const header = request.headers['authorization']
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing table session token')
    }
    try {
      const claims = await verifyTableSessionToken(header.slice(7))
      request.tableSession = claims
      return true
    } catch {
      throw new UnauthorizedException('invalid or expired table session token')
    }
  }
}

export const TableSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): TableSessionClaims => {
  const request = ctx.switchToHttp().getRequest<Request>()
  if (!request.tableSession) throw new UnauthorizedException('no table session in request')
  return request.tableSession
})
