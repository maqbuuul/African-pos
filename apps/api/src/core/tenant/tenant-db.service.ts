import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { Request } from 'express'
import type { Pool } from 'pg'
import { withTenantContext, type Db } from '@hospitality-os/database'

import { APP_POOL } from './tenant.constants.js'

// Request-scoped: one instance per HTTP request, so `organizationId` always
// reflects that request's own authContext, never a previous request's.
@Injectable({ scope: Scope.REQUEST })
export class TenantDbService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  get organizationId(): string | null {
    return this.request.authContext?.organizationId ?? null
  }

  // Runs `fn` inside a transaction scoped to the request's tenant (or
  // unscoped, if the request isn't authenticated — most tables reject that
  // via RLS regardless; see the users table's relaxed pre-auth SELECT
  // policy for the one deliberate exception).
  run<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return withTenantContext(this.pool, this.organizationId, fn)
  }
}
