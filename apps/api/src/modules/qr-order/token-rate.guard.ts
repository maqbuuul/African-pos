import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { Redis } from 'ioredis'
import type { Request } from 'express'

const WINDOW_MS = 5_000
const MAX_REQUESTS = 10

// Redis-backed so the limit is shared across every API instance behind the
// load balancer — an in-memory Map only rate-limits per-process, which is
// both an unbounded memory leak (never evicted) and no limit at all once the
// API runs more than one instance.
@Injectable()
export class TokenRateGuard implements CanActivate {
  private readonly redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? 6379),
    maxRetriesPerRequest: 1,
  })

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    // Routes gated by a table-session token bucket per token. Routes with no
    // :token param yet (createSession, the very first call) fall back to the
    // caller's IP so every client gets its own bucket instead of sharing one
    // global 'anonymous' bucket that any single abusive client could exhaust
    // for everyone else.
    const token = (request.params as Record<string, string>)['token'] ?? request.ip ?? 'anonymous'
    const key = `qr-order:rate:${token}`

    const count = await this.redis.incr(key)
    if (count === 1) {
      await this.redis.pexpire(key, WINDOW_MS)
    }
    if (count > MAX_REQUESTS) {
      throw new ThrottlerException('too many requests, please slow down')
    }
    return true
  }
}
