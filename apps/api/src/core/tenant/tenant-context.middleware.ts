import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

import { verifyAuthToken } from '../auth/jwt.js'

// Populates req.authContext from a bearer JWT when present and valid.
// Deliberately does not reject the request on a missing/invalid token —
// that's what guards (PermissionsGuard, and any future "must be
// authenticated" guard) are for. This middleware only ever establishes
// context; it never denies access.
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      try {
        req.authContext = await verifyAuthToken(header.slice('Bearer '.length))
      } catch {
        // invalid/expired token — leave authContext unset
      }
    }
    next()
  }
}
