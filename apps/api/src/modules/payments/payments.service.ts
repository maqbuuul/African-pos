import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  bills,
  decryptCredentials,
  encryptCredentials,
  integrationConnections,
  orders,
  paymentIntents,
  payments,
  refunds,
  tips,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import { PAYMENT_INTENT_STATUS_TRANSITIONS, type PaymentIntentStatus } from '@hospitality-os/domain'
import { getPaymentAdapter } from '@hospitality-os/integrations'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { IdempotencyService } from '../../core/idempotency/idempotency.service.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { ReceiptsService } from '../notifications/receipts.service.js'
import type { TakeBankTransferPaymentDto } from './dto/take-bank-transfer-payment.dto.js'
import type { TakeCashPaymentDto } from './dto/take-cash-payment.dto.js'
import type { TakeCardPaymentDto } from './dto/take-card-payment.dto.js'
import type { TakeCardTerminalPaymentDto } from './dto/take-card-terminal-payment.dto.js'
import type { TakeMpesaPaymentDto } from './dto/take-mpesa-payment.dto.js'
import type { RequestRefundDto } from './dto/request-refund.dto.js'
import type { ConnectIntegrationDto } from './dto/connect-integration.dto.js'

// Per-module approval-request action key for refunds (ApprovalsController.resolve requires
// the resolver to hold a permission whose key equals the approval action literally —
// same pattern as orders:void_after_send). The key doubles as both the RBAC permission
// and the approval action key, matching the convention established in OrdersService.
// Exported so ApprovalsController.resolve can match it when resolving pending refund requests.
export const REFUND_ACTION = 'payments:refund'

// Each module defines its own constant (not imported cross-module — existing codebase
// convention). The value is the same across modules, kept local to avoid coupling.
export const APPROVAL_HEADER = 'x-approval-request-id'

// M-Pesa STK push expires after 5 minutes per Safaricom's specification.
const MPESA_INTENT_TTL_MS = 5 * 60 * 1000

// Paystack checkout sessions expire after 1 hour.
const PAYSTACK_INTENT_TTL_MS = 60 * 60 * 1000

// Statuses from which an intent is considered "terminal failure" and can be retried
// by creating a new intent (idempotency check bypasses these).
const RETRYABLE_INTENT_STATUSES = new Set(['failed', 'cancelled', 'expired'])

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(ReceiptsService) private readonly receiptsService: ReceiptsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cash payment — immediate confirmation, no external provider call.
  // PRD 07: change = amountTendered - amount; bill settled in same transaction.
  // ---------------------------------------------------------------------------
  async takeCash(authContext: AuthContext, billId: string, dto: TakeCashPaymentDto) {
    if (dto.amountTendered < dto.amount) {
      throw new BadRequestException({
        code: 'insufficient_tender',
        message: 'amountTendered must be greater than or equal to amount',
      })
    }

    const payment = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.loadBill(db, authContext.organizationId, billId)

      // Idempotency: return existing confirmed intent if this key was already processed.
      const existing = await this.idempotency.findExistingIntent(
        db,
        authContext.organizationId,
        dto.idempotencyKey,
      )
      if (existing && !RETRYABLE_INTENT_STATUSES.has(existing.status)) {
        return existing
      }

      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method: 'cash',
          provider: 'none',
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!intent) throw new Error('failed to create payment intent')

      // Cash is confirmed in the same DB transaction — no provider round-trip.
      await db
        .update(paymentIntents)
        .set({ status: 'confirmed', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intent.id))

      const changeGiven = dto.amountTendered - dto.amount

      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          paymentIntentId: intent.id,
          method: 'cash',
          provider: 'none',
          amount: dto.amount,
          currency: dto.currency,
          changeGivenAmount: changeGiven,
          idempotencyKey: dto.idempotencyKey,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!payment) throw new Error('failed to create payment record')

      if (dto.tipAmount && dto.tipAmount > 0) {
        await db.insert(tips).values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          paymentId: payment.id,
          billId,
          staffId: dto.tipStaffId ?? null,
          amount: dto.tipAmount,
          currency: dto.currency,
        })
      }

      await this.settleBillIfFullyPaid(db, billId, authContext.organizationId)
      return payment
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'payment.cash.confirmed',
      entityType: 'payment',
      entityId: payment.id,
      newValue: { billId, amount: dto.amount, method: 'cash' },
    })

    return payment
  }

  // ---------------------------------------------------------------------------
  // M-Pesa payment — STK push via Daraja API; bill confirmed via webhook.
  // PRD 07: intent created (pending → processing), bill stays payment_pending
  // until handleMpesaWebhook confirms. Returns intent for status polling.
  // ---------------------------------------------------------------------------
  async takeMpesa(authContext: AuthContext, billId: string, dto: TakeMpesaPaymentDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.loadBill(db, authContext.organizationId, billId)

      const existing = await this.idempotency.findExistingIntent(
        db,
        authContext.organizationId,
        dto.idempotencyKey,
      )
      if (existing && !RETRYABLE_INTENT_STATUSES.has(existing.status)) {
        return existing
      }

      const { credentials } = await this.loadIntegrationCredentials(
        db,
        authContext.organizationId,
        bill.locationId,
        'mpesa_daraja',
      )

      // Create intent before calling the provider so a DB failure after the
      // provider call doesn't leave a dangling external transaction.
      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method: 'mpesa',
          provider: 'mpesa_daraja',
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          customerPhone: dto.customerPhone,
          expiresAt: new Date(Date.now() + MPESA_INTENT_TTL_MS),
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!intent) throw new Error('failed to create M-Pesa payment intent')

      const adapter = getPaymentAdapter('mpesa_daraja')
      const result = await adapter.initiatePayment(
        {
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          billId,
          paymentIntentId: intent.id,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          customerPhone: dto.customerPhone,
        },
        credentials,
      )

      const [updated] = await db
        .update(paymentIntents)
        .set({
          status: 'processing',
          providerReference: result.providerReference,
          updatedAt: sql`now()`,
        })
        .where(eq(paymentIntents.id, intent.id))
        .returning()
      if (!updated) throw new Error('failed to update M-Pesa intent to processing')

      return updated
    })
  }

  // ---------------------------------------------------------------------------
  // Paystack card payment — initialize transaction, redirect customer to checkout URL.
  // PRD 07: intent created (pending → processing), confirmed via handlePaystackWebhook.
  // ---------------------------------------------------------------------------
  async takeCard(authContext: AuthContext, billId: string, dto: TakeCardPaymentDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.loadBill(db, authContext.organizationId, billId)

      const existing = await this.idempotency.findExistingIntent(
        db,
        authContext.organizationId,
        dto.idempotencyKey,
      )
      if (existing && !RETRYABLE_INTENT_STATUSES.has(existing.status)) {
        return existing
      }

      const { credentials } = await this.loadIntegrationCredentials(
        db,
        authContext.organizationId,
        bill.locationId,
        'paystack',
      )

      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method: 'card',
          provider: 'paystack',
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          customerEmail: dto.customerEmail,
          expiresAt: new Date(Date.now() + PAYSTACK_INTENT_TTL_MS),
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!intent) throw new Error('failed to create Paystack payment intent')

      const adapter = getPaymentAdapter('paystack')
      const result = await adapter.initiatePayment(
        {
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          billId,
          paymentIntentId: intent.id,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          customerEmail: dto.customerEmail,
        },
        credentials,
      )

      const [updated] = await db
        .update(paymentIntents)
        .set({
          status: 'processing',
          providerReference: result.providerReference,
          checkoutUrl: result.checkoutUrl ?? null,
          updatedAt: sql`now()`,
        })
        .where(eq(paymentIntents.id, intent.id))
        .returning()
      if (!updated) throw new Error('failed to update Paystack intent to processing')

      return updated
    })
  }

  // ---------------------------------------------------------------------------
  // Card terminal (physical POS terminal) — manual confirmation; terminal slip
  // reference recorded as providerReference for reconciliation.
  // PRD 07: immediate confirm, no webhook. Permission is manager-level
  // (payments:take_card) but the terminal-reference requirement is enforced here.
  // ---------------------------------------------------------------------------
  async takeCardTerminal(authContext: AuthContext, billId: string, dto: TakeCardTerminalPaymentDto) {
    const payment = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.loadBill(db, authContext.organizationId, billId)

      const existing = await this.idempotency.findExistingIntent(
        db,
        authContext.organizationId,
        dto.idempotencyKey,
      )
      if (existing && !RETRYABLE_INTENT_STATUSES.has(existing.status)) {
        return existing
      }

      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method: 'card_terminal',
          provider: 'manual',
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          providerReference: dto.terminalReference,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!intent) throw new Error('failed to create card terminal payment intent')

      await db
        .update(paymentIntents)
        .set({ status: 'confirmed', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intent.id))

      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          paymentIntentId: intent.id,
          method: 'card_terminal',
          provider: 'manual',
          providerReference: dto.terminalReference,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!payment) throw new Error('failed to create card terminal payment record')

      if (dto.tipAmount && dto.tipAmount > 0) {
        await db.insert(tips).values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          paymentId: payment.id,
          billId,
          staffId: dto.tipStaffId ?? null,
          amount: dto.tipAmount,
          currency: dto.currency,
        })
      }

      await this.settleBillIfFullyPaid(db, billId, authContext.organizationId)
      return payment
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'payment.card_terminal.confirmed',
      entityType: 'payment',
      entityId: payment.id,
      newValue: {
        billId,
        amount: dto.amount,
        method: 'card_terminal',
        terminalReference: dto.terminalReference,
      },
    })

    return payment
  }

  // ---------------------------------------------------------------------------
  // Bank transfer — manual confirmation; bank reference recorded for reconciliation.
  // PRD 07: manager-level (payments:take_bank_transfer) due to bank-transfer fraud
  // vector. Immediate confirm same as terminal.
  // ---------------------------------------------------------------------------
  async takeBankTransfer(authContext: AuthContext, billId: string, dto: TakeBankTransferPaymentDto) {
    const payment = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.loadBill(db, authContext.organizationId, billId)

      const existing = await this.idempotency.findExistingIntent(
        db,
        authContext.organizationId,
        dto.idempotencyKey,
      )
      if (existing && !RETRYABLE_INTENT_STATUSES.has(existing.status)) {
        return existing
      }

      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method: 'bank_transfer',
          provider: 'manual',
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          providerReference: dto.bankReference,
          metadata: dto.bankName ? { bankName: dto.bankName } : null,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!intent) throw new Error('failed to create bank transfer payment intent')

      await db
        .update(paymentIntents)
        .set({ status: 'confirmed', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intent.id))

      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          paymentIntentId: intent.id,
          method: 'bank_transfer',
          provider: 'manual',
          providerReference: dto.bankReference,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          metadata: dto.bankName ? { bankName: dto.bankName } : null,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!payment) throw new Error('failed to create bank transfer payment record')

      if (dto.tipAmount && dto.tipAmount > 0) {
        await db.insert(tips).values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          paymentId: payment.id,
          billId,
          staffId: dto.tipStaffId ?? null,
          amount: dto.tipAmount,
          currency: dto.currency,
        })
      }

      await this.settleBillIfFullyPaid(db, billId, authContext.organizationId)
      return payment
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'payment.bank_transfer.confirmed',
      entityType: 'payment',
      entityId: payment.id,
      newValue: {
        billId,
        amount: dto.amount,
        method: 'bank_transfer',
        bankReference: dto.bankReference,
      },
    })

    return payment
  }

  // ---------------------------------------------------------------------------
  // M-Pesa webhook — unauthenticated provider callback (POST /webhooks/mpesa/:orgId).
  // PRD 07: 1. verify connection exists, 2. parse ResultCode + CheckoutRequestID,
  // 3. find intent by providerReference, 4. create payment + settle bill,
  // 5. Module 18 fraud check (alert only, never block).
  // ---------------------------------------------------------------------------
  async handleMpesaWebhook(
    orgId: string,
    rawPayload: string,
    signature: string | undefined,
    headers: Record<string, string>,
  ) {
    return withTenantContext(this.pool, orgId, async (db) => {
      // Load credentials to verify the integration exists (and for potential IP checks).
      // M-Pesa doesn't HMAC-sign payloads, so we don't decrypt — just confirm the
      // connection is active for this org before trusting the payload.
      const conn = await this.findActiveConnection(db, orgId, 'mpesa_daraja')
      if (!conn) {
        return { status: 'ignored', reason: 'integration_not_configured' }
      }

      const adapter = getPaymentAdapter('mpesa_daraja')
      const result = await adapter.verifyWebhook(
        { rawPayload, signature: signature ?? '', headers },
        {},
      )

      if (!result.providerReference) {
        return { status: 'ignored', reason: 'no_provider_reference' }
      }

      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.organizationId, orgId),
            eq(paymentIntents.providerReference, result.providerReference),
          ),
        )

      if (!intent) {
        return { status: 'ignored', reason: 'intent_not_found' }
      }

      if (result.status !== 'confirmed') {
        // STK push declined or expired by the customer.
        await db
          .update(paymentIntents)
          .set({ status: 'failed', updatedAt: sql`now()` })
          .where(eq(paymentIntents.id, intent.id))
        return { status: 'failed', intentId: intent.id }
      }

      // Guard against duplicate webhook delivery.
      if (intent.status === 'confirmed') {
        return { status: 'already_confirmed', intentId: intent.id }
      }

      await db
        .update(paymentIntents)
        .set({ status: 'confirmed', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intent.id))

      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: orgId,
          locationId: intent.locationId,
          orderId: intent.orderId,
          billId: intent.billId,
          paymentIntentId: intent.id,
          method: intent.method,
          provider: intent.provider,
          providerReference: result.providerReference,
          amount: intent.amount,
          currency: intent.currency,
          idempotencyKey: intent.idempotencyKey,
          processedByActorId: intent.processedByActorId,
        })
        .returning()
      if (!payment) throw new Error('failed to create payment record from M-Pesa webhook')

      await this.settleBillIfFullyPaid(db, intent.billId, orgId)

      // Module 18 fraud check: compare the incoming paybill/till number against
      // the org's registered numbers stored in integration_connections.metadata.
      // Alert only — the payment is confirmed regardless of the outcome.
      await this.checkMpesaFraud(db, orgId, intent.locationId, result, payment.id, intent.billId)

      await this.auditLog.record({
        organizationId: orgId,
        locationId: intent.locationId,
        actorType: 'system',
        action: 'payment.mpesa.confirmed',
        entityType: 'payment',
        entityId: payment.id,
        newValue: { providerReference: result.providerReference, amount: intent.amount },
      })

      return { status: 'confirmed', paymentId: payment.id }
    })
  }

  // ---------------------------------------------------------------------------
  // Paystack webhook — unauthenticated provider callback (POST /webhooks/paystack/:orgId).
  // PRD 07: HMAC-SHA512 signature verification using stored Paystack secret key.
  // ---------------------------------------------------------------------------
  async handlePaystackWebhook(
    orgId: string,
    rawPayload: string,
    signature: string | undefined,
    headers: Record<string, string>,
  ) {
    return withTenantContext(this.pool, orgId, async (db) => {
      // Find the org-wide Paystack connection to get the secret key for HMAC verification.
      const [orgConn] = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.organizationId, orgId),
            isNull(integrationConnections.locationId),
            eq(integrationConnections.provider, 'paystack'),
            eq(integrationConnections.status, 'active'),
          ),
        )

      if (!orgConn) {
        return { status: 'ignored', reason: 'integration_not_configured' }
      }

      const credentials = JSON.parse(decryptCredentials(orgConn.credentialsEncrypted)) as Record<
        string,
        string
      >

      const adapter = getPaymentAdapter('paystack')
      const result = await adapter.verifyWebhook(
        { rawPayload, signature: signature ?? '', headers },
        credentials,
      )

      if (result.status !== 'confirmed' || !result.providerReference) {
        return { status: 'ignored', reason: 'verification_failed' }
      }

      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.organizationId, orgId),
            eq(paymentIntents.providerReference, result.providerReference),
          ),
        )

      if (!intent) {
        return { status: 'ignored', reason: 'intent_not_found' }
      }

      if (intent.status === 'confirmed') {
        return { status: 'already_confirmed', intentId: intent.id }
      }

      await db
        .update(paymentIntents)
        .set({ status: 'confirmed', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intent.id))

      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: orgId,
          locationId: intent.locationId,
          orderId: intent.orderId,
          billId: intent.billId,
          paymentIntentId: intent.id,
          method: intent.method,
          provider: intent.provider,
          providerReference: result.providerReference,
          amount: intent.amount,
          currency: intent.currency,
          idempotencyKey: intent.idempotencyKey,
          processedByActorId: intent.processedByActorId,
        })
        .returning()
      if (!payment) throw new Error('failed to create payment record from Paystack webhook')

      await this.settleBillIfFullyPaid(db, intent.billId, orgId)

      await this.auditLog.record({
        organizationId: orgId,
        locationId: intent.locationId,
        actorType: 'system',
        action: 'payment.paystack.confirmed',
        entityType: 'payment',
        entityId: payment.id,
        newValue: { providerReference: result.providerReference, amount: intent.amount },
      })

      return { status: 'confirmed', paymentId: payment.id }
    })
  }

  // ---------------------------------------------------------------------------
  // Refund — requires payments:refund permission (approval-gated via
  // @RequirePermission('payments:refund', { allowOverride: true }) on the controller).
  // Cash and manual-method refunds are always requires_manual_settlement.
  // PRD 07: the refunds table is the sole source of truth for refund history —
  // the original payments row's `status` is updated to reflect the net state
  // (partially_refunded / refunded) but is never overwritten otherwise.
  // ---------------------------------------------------------------------------
  async requestRefund(
    authContext: AuthContext,
    paymentId: string,
    dto: RequestRefundDto,
    _approvalRequestId?: string,
  ) {
    const refund = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, paymentId),
            eq(payments.organizationId, authContext.organizationId),
          ),
        )
      if (!payment) {
        throw new NotFoundException({ code: 'payment_not_found', message: 'payment not found' })
      }
      if (payment.status === 'refunded') {
        throw new BadRequestException({
          code: 'payment_already_refunded',
          message: 'payment has already been fully refunded',
        })
      }

      // Compute how much has already been refunded (excluding failed refund attempts).
      const existingRefunds = await db
        .select()
        .from(refunds)
        .where(
          and(
            eq(refunds.paymentId, paymentId),
            eq(refunds.organizationId, authContext.organizationId),
          ),
        )
      const totalAlreadyRefunded = existingRefunds.reduce(
        (sum, r) => sum + (r.status !== 'failed' ? r.amount : 0),
        0,
      )
      const refundable = payment.amount - totalAlreadyRefunded
      if (dto.amount > refundable) {
        throw new BadRequestException({
          code: 'refund_exceeds_payment',
          message: `cannot refund ${dto.amount} — only ${refundable} remains refundable on this payment`,
        })
      }

      // For cash/manual providers: always requires_manual_settlement (PRD 07 edge case).
      // For async providers (mpesa_daraja, paystack): call adapter to attempt reversal.
      const isCashOrManual = payment.provider === 'none' || payment.provider === 'manual'
      let refundStatus: 'pending' | 'confirmed' | 'requires_manual_settlement'
      let adapterRef: string | undefined

      if (isCashOrManual) {
        refundStatus = 'requires_manual_settlement'
      } else {
        const { credentials } = await this.loadIntegrationCredentials(
          db,
          authContext.organizationId,
          payment.locationId,
          payment.provider,
        )
        const adapter = getPaymentAdapter(payment.provider)
        const adapterResult = await adapter.initiateRefund(
          {
            paymentId: payment.id,
            providerReference: payment.providerReference ?? '',
            amount: dto.amount,
            currency: payment.currency,
            reason: dto.reason,
          },
          credentials,
        )
        refundStatus = adapterResult.requiresManualSettlement
          ? 'requires_manual_settlement'
          : 'pending'
        adapterRef = adapterResult.providerReference
      }

      const [refund] = await db
        .insert(refunds)
        .values({
          organizationId: authContext.organizationId,
          locationId: payment.locationId,
          paymentId: payment.id,
          method: payment.method,
          provider: payment.provider,
          providerReference: adapterRef ?? null,
          amount: dto.amount,
          currency: payment.currency,
          reason: dto.reason,
          status: refundStatus,
          processedByActorId: authContext.actorId,
          approvedByActorId: authContext.actorId,
        })
        .returning()
      if (!refund) throw new Error('failed to create refund record')

      // Update payment status to reflect net refund state.
      const netRefunded = totalAlreadyRefunded + dto.amount
      const newPaymentStatus = netRefunded >= payment.amount ? 'refunded' : 'partially_refunded'
      await db
        .update(payments)
        .set({ status: newPaymentStatus, updatedAt: sql`now()` })
        .where(eq(payments.id, payment.id))

      return refund
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'payment.refund.created',
      entityType: 'refund',
      entityId: refund.id,
      newValue: { paymentId, amount: dto.amount },
      reason: dto.reason,
    })

    return refund
  }

  // ---------------------------------------------------------------------------
  // Payment intent status polling — returns intent with current status.
  // Clients poll this after M-Pesa/Paystack intents to learn when confirmation
  // arrives (or to detect expiry for retry UX).
  // ---------------------------------------------------------------------------
  async getPaymentIntent(authContext: AuthContext, intentId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.id, intentId),
            eq(paymentIntents.organizationId, authContext.organizationId),
          ),
        )
      if (!intent) {
        throw new NotFoundException({
          code: 'payment_intent_not_found',
          message: 'payment intent not found',
        })
      }
      return intent
    })
  }

  // ---------------------------------------------------------------------------
  // Cancel a payment intent — only valid from pending/processing states
  // (PAYMENT_INTENT_STATUS_TRANSITIONS). Cancellation does NOT void an already-
  // confirmed payment; use requestRefund for that.
  // ---------------------------------------------------------------------------
  async cancelIntent(authContext: AuthContext, intentId: string) {
    const intent = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.id, intentId),
            eq(paymentIntents.organizationId, authContext.organizationId),
          ),
        )
      if (!intent) {
        throw new NotFoundException({
          code: 'payment_intent_not_found',
          message: 'payment intent not found',
        })
      }

      const allowed = PAYMENT_INTENT_STATUS_TRANSITIONS[intent.status as PaymentIntentStatus]
      if (!allowed.includes('cancelled')) {
        throw new BadRequestException({
          code: 'invalid_intent_transition',
          message: `cannot cancel a payment intent in status "${intent.status}"`,
        })
      }

      const [updated] = await db
        .update(paymentIntents)
        .set({ status: 'cancelled', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intentId))
        .returning()
      if (!updated) throw new Error('failed to cancel payment intent')
      return updated
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'payment.intent.cancelled',
      entityType: 'payment_intent',
      entityId: intentId,
    })

    return intent
  }

  // ---------------------------------------------------------------------------
  // List all confirmed payments for a bill — used by the cashier UI to show
  // payment history and remaining balance. No special permission required beyond
  // being authenticated to this org.
  // ---------------------------------------------------------------------------
  async getPaymentsForBill(authContext: AuthContext, billId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      // Verify bill ownership before listing payments.
      await this.loadBillForRead(db, authContext.organizationId, billId)
      return db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.billId, billId),
            eq(payments.organizationId, authContext.organizationId),
          ),
        )
    })
  }

  // ---------------------------------------------------------------------------
  // Connect (or update) a payment integration — stores AES-256-GCM encrypted
  // credentials in integration_connections. Upserts: calling again with new
  // credentials rotates them. Returns the connection row with credentials stripped.
  // PRD 07: payments:connect_integration is owner/branch_manager only (stores
  // credentials that control real money movement).
  // ---------------------------------------------------------------------------
  async connectIntegration(authContext: AuthContext, dto: ConnectIntegrationDto) {
    const conn = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const encrypted = encryptCredentials(JSON.stringify(dto.credentials))

      // Upsert: if a connection for this org+location+provider already exists, update it.
      const [existing] = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.organizationId, authContext.organizationId),
            dto.locationId
              ? eq(integrationConnections.locationId, dto.locationId)
              : isNull(integrationConnections.locationId),
            eq(integrationConnections.provider, dto.provider),
          ),
        )

      if (existing) {
        const [updated] = await db
          .update(integrationConnections)
          .set({
            credentialsEncrypted: encrypted,
            metadata: dto.metadata ?? null,
            category: dto.category,
            status: 'active',
            lastVerifiedAt: null,
            errorMessage: null,
            updatedAt: sql`now()`,
          })
          .where(eq(integrationConnections.id, existing.id))
          .returning()
        return updated!
      }

      const [created] = await db
        .insert(integrationConnections)
        .values({
          organizationId: authContext.organizationId,
          locationId: dto.locationId ?? null,
          category: dto.category,
          provider: dto.provider,
          credentialsEncrypted: encrypted,
          metadata: dto.metadata ?? null,
          status: 'active',
        })
        .returning()
      if (!created) throw new Error('failed to create integration connection')
      return created
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      locationId: dto.locationId ?? null,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'integration.connected',
      entityType: 'integration_connection',
      entityId: conn.id,
      // Never log credentials — only the non-sensitive connection identifiers.
      newValue: { category: dto.category, provider: dto.provider, locationId: dto.locationId ?? null },
    })

    // Strip encrypted credentials before returning — never surfaced post-save.
    const { credentialsEncrypted: _stripped, ...safe } = conn
    return safe
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  // Load bill, assert org ownership, and block payments on terminal states.
  private async loadBill(db: Db, organizationId: string, billId: string) {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.organizationId, organizationId)))
    if (!bill) {
      throw new NotFoundException({ code: 'bill_not_found', message: 'bill not found' })
    }
    if (bill.status === 'voided') {
      throw new BadRequestException({ code: 'bill_voided', message: 'bill has been voided' })
    }
    if (bill.status === 'paid') {
      throw new BadRequestException({ code: 'bill_already_paid', message: 'bill is already fully paid' })
    }
    return bill
  }

  // Read-only bill load (for getPaymentsForBill) — no status guard needed since
  // we only want to confirm ownership before listing historical payments.
  private async loadBillForRead(db: Db, organizationId: string, billId: string) {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.organizationId, organizationId)))
    if (!bill) {
      throw new NotFoundException({ code: 'bill_not_found', message: 'bill not found' })
    }
    return bill
  }

  // Load integration credentials, preferring location-specific over org-wide.
  // Throws if no active connection exists — prevents silent fallback to no-creds.
  private async loadIntegrationCredentials(
    db: Db,
    organizationId: string,
    locationId: string,
    provider: string,
  ) {
    const [locationConn] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.locationId, locationId),
          eq(integrationConnections.provider, provider),
          eq(integrationConnections.status, 'active'),
        ),
      )

    if (locationConn) {
      const credentials = JSON.parse(decryptCredentials(locationConn.credentialsEncrypted)) as Record<
        string,
        string
      >
      return { credentials, metadata: locationConn.metadata, connectionId: locationConn.id }
    }

    const [orgConn] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          isNull(integrationConnections.locationId),
          eq(integrationConnections.provider, provider),
          eq(integrationConnections.status, 'active'),
        ),
      )

    if (!orgConn) {
      throw new BadRequestException({
        code: 'integration_not_configured',
        message: `No active ${provider} integration configured for this location`,
      })
    }
    const credentials = JSON.parse(decryptCredentials(orgConn.credentialsEncrypted)) as Record<
      string,
      string
    >
    return { credentials, metadata: orgConn.metadata, connectionId: orgConn.id }
  }

  // Find the first active connection for a provider, org-wide or location-specific.
  // Used by webhook handlers where we don't have a locationId from the HTTP request.
  private async findActiveConnection(db: Db, organizationId: string, provider: string) {
    const [conn] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, provider),
          eq(integrationConnections.status, 'active'),
        ),
      )
    return conn ?? null
  }

  // After any payment confirmation: sum all confirmed payments for the bill.
  // If >= bill.totalAmount, mark bill paid. Then check if every bill on the
  // order is paid — if so, close the order (P5 handoff PRD 07).
  private async settleBillIfFullyPaid(
    db: Db,
    billId: string,
    organizationId: string,
  ): Promise<void> {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.organizationId, organizationId)))
    if (!bill || bill.status === 'paid') return

    const confirmedPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.billId, billId),
          eq(payments.organizationId, organizationId),
          eq(payments.status, 'confirmed'),
        ),
      )

    const totalConfirmed = confirmedPayments.reduce((sum, p) => sum + p.amount, 0)
    if (totalConfirmed < bill.totalAmount) return

    await db
      .update(bills)
      .set({ status: 'paid', paidAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(bills.id, billId))

    // P9 — Trigger receipt generation when a bill is fully paid.
    // Receipt generation is best-effort from the settlement flow; failures do
    // not block the settlement. The receipt worker queue provides retry.
    if (this.receiptsService) {
      try {
        const firstPayment = confirmedPayments[0]
        const [firstIntent] = firstPayment
          ? await db.select().from(paymentIntents).where(eq(paymentIntents.id, firstPayment.paymentIntentId))
          : []
        const customerPhone = firstIntent?.customerPhone ?? undefined
        const customerEmail = firstIntent?.customerEmail ?? undefined

        await this.receiptsService.generateForOrder(
          { actorType: 'staff', actorId: '', organizationId, locationId: bill.locationId },
          bill.orderId,
          billId,
          customerPhone,
          customerEmail,
        )
      } catch {
        // Settlement must not fail due to receipt generation
      }
    }

    // Check if every bill on the order is now paid.
    const allOrderBills = await db
      .select()
      .from(bills)
      .where(and(eq(bills.orderId, bill.orderId), eq(bills.organizationId, organizationId)))

    const allPaid = allOrderBills.every((b) => (b.id === billId ? true : b.status === 'paid'))
    if (allPaid) {
      await db
        .update(orders)
        .set({ status: 'paid', closedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(orders.id, bill.orderId))
    }
  }

  // Module 18 fraud check: compare the incoming paybill/till number against the
  // list of numbers registered on the org's M-Pesa integration. Logs a fraud alert
  // audit event when a mismatch is found — the payment is NOT blocked.
  private async checkMpesaFraud(
    db: Db,
    orgId: string,
    locationId: string,
    result: { providerReference: string; metadata?: Record<string, unknown> },
    paymentId: string,
    billId: string,
  ): Promise<void> {
    try {
      const conn = await this.findActiveConnection(db, orgId, 'mpesa_daraja')
      if (!conn?.metadata) return

      const meta = conn.metadata as { registeredNumbers?: unknown }
      if (!Array.isArray(meta.registeredNumbers)) return

      const registeredNumbers = meta.registeredNumbers as string[]
      const incomingShortCode = result.metadata?.['BusinessShortCode'] as string | undefined
      if (!incomingShortCode) return

      if (!registeredNumbers.includes(incomingShortCode)) {
        await this.auditLog.record({
          organizationId: orgId,
          locationId,
          actorType: 'system',
          action: 'payment.mpesa.fraud_alert',
          entityType: 'payment',
          entityId: paymentId,
          newValue: {
            providerReference: result.providerReference,
            detectedShortCode: incomingShortCode,
            registeredNumbers,
            billId,
          },
        })
      }
    } catch {
      // Fraud check is best-effort — a failure here must never block or roll back
      // a confirmed payment. Silently swallow and let the audit trail stand as-is.
    }
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------
  async paymentMethodMixReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          method: payments.method,
          totalAmount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
          count: sql<number>`COUNT(*)`,
          avgAmount: sql<number>`COALESCE(AVG(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(and(eq(payments.organizationId, authContext.organizationId), eq(payments.locationId, locationId), eq(payments.status, 'confirmed'), sql`${payments.paidAt} >= ${from}`, sql`${payments.paidAt} <= ${to}`))
        .groupBy(payments.method)
        .orderBy(sql`SUM(${payments.amount}) DESC`)
      return { from, to, rows }
    })
  }

  async refundSummaryReport(authContext: AuthContext, locationId: string, from: Date, to: Date) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select({
          method: refunds.method,
          totalRefunded: sql<number>`COALESCE(SUM(${refunds.amount}), 0)`,
          count: sql<number>`COUNT(*)`,
          avgRefund: sql<number>`COALESCE(AVG(${refunds.amount}), 0)`,
        })
        .from(refunds)
        .where(and(eq(refunds.organizationId, authContext.organizationId), eq(refunds.locationId, locationId), eq(refunds.status, 'settled'), sql`${refunds.createdAt} >= ${from}`, sql`${refunds.createdAt} <= ${to}`))
        .groupBy(refunds.method)
        .orderBy(sql`SUM(${refunds.amount}) DESC`)
      return { from, to, rows }
    })
  }

  async listUnreconciled(authContext: AuthContext, locationId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return db
        .select({
          id: payments.id,
          billId: payments.billId,
          method: payments.method,
          amount: payments.amount,
          provider: payments.provider,
          providerReference: payments.providerReference,
          paidAt: payments.paidAt,
        })
        .from(payments)
        .where(and(
          eq(payments.organizationId, authContext.organizationId),
          eq(payments.locationId, locationId),
          eq(payments.status, 'confirmed'),
          isNull(payments.reconciledAt),
        ))
        .orderBy(desc(payments.paidAt))
    })
  }

  async reconcilePayment(authContext: AuthContext, paymentId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const rows = await db
        .select()
        .from(payments)
        .where(and(eq(payments.id, paymentId), eq(payments.organizationId, authContext.organizationId)))
      if (!rows.length) throw new NotFoundException('payment not found')
      const payment = rows[0]!
      if (payment.status !== 'confirmed') throw new BadRequestException('only confirmed payments can be reconciled')
      if (payment.reconciledAt) throw new BadRequestException('payment already reconciled')
      await db.update(payments).set({ reconciledAt: new Date() }).where(eq(payments.id, paymentId))
      return { id: paymentId, reconciled: true }
    })
  }
}
