import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { verifyTableSessionToken } from './table-session-jwt.js'

const TOKEN_HEADER = 'x-table-session-token'

declare module 'express-serve-static-core' {
  interface Request {
    tableSession?: {
      organizationId: string
      locationId: string
      tableId: string
      qrSlug: string
    }
  }
}

@Injectable()
export class TableSessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('missing table session token')
    try {
      const session = await verifyTableSessionToken(token)
      request.tableSession = session
      return true
    } catch {
      throw new UnauthorizedException('invalid or expired table session token')
    }
  }

  private extractToken(request: Request): string | undefined {
    const urlToken: string | undefined = (request.params as Record<string, string>)['token']
    if (urlToken) return urlToken
    const header = request.headers[TOKEN_HEADER]
    if (typeof header === 'string') return header
    if (Array.isArray(header)) return header[0]
    return undefined
  }
}
