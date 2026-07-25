import { randomUUID } from 'node:crypto'
import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  decryptCredentials,
  integrationConnections,
  payments as paymentsTable,
  refunds as refundsTable,
} from '@hospitality-os/database'

import { AppModule } from '../../app.module.js'
import { PaymentsService } from './payments.service.js'
import {
  closeFixturePool,
  createBillFixture,
  deleteBillFixture,
  systemDb,
  testActorContext,
  type BillFixture,
} from '../../test/fixtures.js'

// Runs against the real local Postgres (docker compose) — see
// ENGINEERING_HANDBOOK.md's Testing Strategy: "mocked-dependency unit tests
// alone don't satisfy a phase's acceptance gate." Only the payment provider
// adapters (real third-party HTTP calls) are mocked at the adapter level —
// see the *.adapter.spec.ts files in packages/integrations.
describe('PaymentsService (integration)', () => {
  let paymentsService: PaymentsService
  let moduleRef: TestingModule
  let fixture: BillFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    paymentsService = moduleRef.get(PaymentsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    fixture = await createBillFixture({ totalAmount: 1000 })
  })

  describe('takeCash', () => {
    it('computes change as amountTendered - amount and records it on the payment', async () => {
      const authContext = testActorContext(fixture)
      const payment = await paymentsService.takeCash(authContext, fixture.billId, {
        amount: 1000,
        currency: 'KES',
        idempotencyKey: randomUUID(),
        amountTendered: 1500,
      })
      expect(payment.amount).toBe(1000)
      expect(payment.changeGivenAmount).toBe(500)
      expect(payment.status).toBe('confirmed')
    })

    it('rejects a tender less than the amount owed', async () => {
      const authContext = testActorContext(fixture)
      await expect(
        paymentsService.takeCash(authContext, fixture.billId, {
          amount: 1000,
          currency: 'KES',
          idempotencyKey: randomUUID(),
          amountTendered: 500,
        }),
      ).rejects.toMatchObject({ response: { code: 'insufficient_tender' } })
    })

    it('is idempotent: retrying with the same idempotencyKey never creates a second payment row (PRD 07)', async () => {
      const authContext = testActorContext(fixture)
      const idempotencyKey = randomUUID()
      const dto = { amount: 1000, currency: 'KES', idempotencyKey, amountTendered: 1000 }

      const first = await paymentsService.takeCash(authContext, fixture.billId, dto)
      const second = await paymentsService.takeCash(authContext, fixture.billId, dto)

      expect(second.id).toBe(first.id)

      const rows = await systemDb
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.idempotencyKey, idempotencyKey))
      expect(rows).toHaveLength(1)
    })
  })

  describe('requestRefund', () => {
    it('is always traceable to its original payment via refunds.payment_id', async () => {
      const authContext = testActorContext(fixture)
      const payment = await paymentsService.takeCash(authContext, fixture.billId, {
        amount: 1000,
        currency: 'KES',
        idempotencyKey: randomUUID(),
        amountTendered: 1000,
      })

      const refund = await paymentsService.requestRefund(authContext, payment.id, {
        amount: 400,
        reason: 'customer changed order',
      })

      expect(refund.paymentId).toBe(payment.id)
      const refundRows = await systemDb.select().from(refundsTable).where(eq(refundsTable.paymentId, payment.id))
      expect(refundRows).toHaveLength(1)
      expect(refundRows[0]?.amount).toBe(400)
    })

    it('leaves every financial field on the original payment row unchanged after a refund', async () => {
      const authContext = testActorContext(fixture)
      const payment = await paymentsService.takeCash(authContext, fixture.billId, {
        amount: 1000,
        currency: 'KES',
        idempotencyKey: randomUUID(),
        amountTendered: 1000,
      })

      await paymentsService.requestRefund(authContext, payment.id, {
        amount: 400,
        reason: 'customer changed order',
      })

      const [afterRefund] = await systemDb.select().from(paymentsTable).where(eq(paymentsTable.id, payment.id))
      expect(afterRefund).toBeDefined()
      // Core financial/ledger fields — the ones a reconciliation report or
      // audit trail would rely on — must never move under a refund.
      expect(afterRefund?.amount).toBe(payment.amount)
      expect(afterRefund?.currency).toBe(payment.currency)
      expect(afterRefund?.method).toBe(payment.method)
      expect(afterRefund?.provider).toBe(payment.provider)
      expect(afterRefund?.providerReference).toBe(payment.providerReference)
      expect(afterRefund?.changeGivenAmount).toBe(payment.changeGivenAmount)
      expect(afterRefund?.idempotencyKey).toBe(payment.idempotencyKey)
      expect(afterRefund?.billId).toBe(payment.billId)
      expect(afterRefund?.orderId).toBe(payment.orderId)
      expect(afterRefund?.paymentIntentId).toBe(payment.paymentIntentId)
    })

    it('rejects refunding more than what remains refundable on the payment', async () => {
      const authContext = testActorContext(fixture)
      const payment = await paymentsService.takeCash(authContext, fixture.billId, {
        amount: 1000,
        currency: 'KES',
        idempotencyKey: randomUUID(),
        amountTendered: 1000,
      })

      await expect(
        paymentsService.requestRefund(authContext, payment.id, { amount: 1500, reason: 'too much' }),
      ).rejects.toMatchObject({ response: { code: 'refund_exceeds_payment' } })
    })
  })

  describe('connectIntegration', () => {
    it('encrypts credentials at rest and never returns them in the response', async () => {
      const authContext = testActorContext(fixture)
      const credentials = { secretKey: 'sk_test_should_never_leak' }

      const result = await paymentsService.connectIntegration(authContext, {
        category: 'payments',
        provider: 'paystack',
        credentials,
      })

      expect(result).not.toHaveProperty('credentialsEncrypted')

      const [row] = await systemDb
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.id, result.id))
      expect(row).toBeDefined()
      expect(row?.credentialsEncrypted).not.toContain('sk_test_should_never_leak')
      const decrypted = JSON.parse(decryptCredentials(row!.credentialsEncrypted)) as typeof credentials
      expect(decrypted).toEqual(credentials)
    })
  })

  afterEach(async () => {
    await deleteBillFixture(fixture)
  })
})
