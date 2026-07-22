import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { paymentIntents, type Db } from '@hospitality-os/database'

// Returns the existing payment intent for this idempotency key if one exists,
// or null if this is a new request. The caller decides what to do with the
// existing intent (return its current state, or proceed if it failed/expired).
//
// Idempotency is enforced at the DB level by a UNIQUE constraint on
// (organization_id, idempotency_key) in payment_intents, so any two concurrent
// requests with the same key will serialize at the DB — only one will successfully
// insert, the other will find the existing row here.
@Injectable()
export class IdempotencyService {
  async findExistingIntent(db: Db, organizationId: string, idempotencyKey: string) {
    const [existing] = await db
      .select()
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.organizationId, organizationId),
          eq(paymentIntents.idempotencyKey, idempotencyKey),
        ),
      )
    return existing ?? null
  }
}
