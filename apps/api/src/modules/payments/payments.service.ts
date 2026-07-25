import { randomUUID } from 'node:crypto'

import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import {
  decryptCredentials,
  encryptCredentials,
  integrationConnections,
  mpesaC2bTransactions,
  paymentIntents,
  payments,
  refunds,
  tips,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import { PAYMENT_INTENT_STATUS_TRANSITIONS, type PaymentIntentStatus, type PaymentMethod } from '@hospitality-os/domain'
import {
  getPaymentAdapter,
  registerMpesaC2BUrls,
  validateC2BPayload,
  type C2BValidationPayload,
  type MpesaCredentials,
} from '@hospitality-os/integrations'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { OutboxService } from '../../core/events/outbox.service.js'
import { IdempotencyService } from '../../core/idempotency/idempotency.service.js'
import { ApprovalsService } from '../../core/permissions/approvals.service.js'
import { PermissionsService } from '../../core/permissions/permissions.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { StaffNotificationsService } from '../notifications/staff-notifications.service.js'
import { ReceiptsService } from '../notifications/receipts.service.js'
import { OrdersService } from '../orders/orders.service.js'
import { ProductsService } from '../products/products.service.js'
import type { TakeBankTransferPaymentDto } from './dto/take-bank-transfer-payment.dto.js'
import type { TakeCashPaymentDto } from './dto/take-cash-payment.dto.js'
import type { TakeCardTerminalPaymentDto } from './dto/take-card-terminal-payment.dto.js'
import type { TakePaymentDto } from './dto/take-payment.dto.js'
import type { RequestRefundDto } from './dto/request-refund.dto.js'
import type { ConnectIntegrationDto } from './dto/connect-integration.dto.js'
import type { OpenBarTabDto } from './dto/open-bar-tab.dto.js'
import type { ChargeBarTabDto } from './dto/charge-bar-tab.dto.js'
import type { RegisterMpesaC2bDto } from './dto/register-mpesa-c2b.dto.js'
import type { MatchMpesaC2bDto } from './dto/match-mpesa-c2b.dto.js'

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

// Every provider reachable through the generic POST /bills/:billId/payments/:provider
// and POST /webhooks/:provider/:orgId routes — i.e. every provider that
// implements the PaymentAdapter interface (initiatePayment + verifyWebhook).
// Cash, card-terminal, and bank-transfer are NOT here: no external
// round-trip, no webhook, immediate confirmation — they keep their own
// dedicated methods/routes/DTOs. Adding a new adapter-based provider is
// "add one line here (+ the permission map below), write the adapter,
// register it in payment-provider.factory.ts" — nothing else.
const ONLINE_PROVIDER_METHOD: Record<string, PaymentMethod> = {
  mpesa_daraja: 'mpesa',
  airtel_money_api: 'airtel_money',
  paystack: 'card',
  flutterwave: 'card',
  pesapal: 'card',
}

// STK-push-style providers push a prompt to the customer's phone and expire
// quickly; hosted-checkout providers give the customer a page/link to
// complete at their own pace and last much longer.
const ONLINE_PROVIDER_INTENT_TTL_MS: Record<string, number> = {
  mpesa_daraja: MPESA_INTENT_TTL_MS,
  airtel_money_api: MPESA_INTENT_TTL_MS,
  paystack: PAYSTACK_INTENT_TTL_MS,
  flutterwave: PAYSTACK_INTENT_TTL_MS,
  pesapal: PAYSTACK_INTENT_TTL_MS,
}

// Mirrors the pre-generalization split between `payments:take_mobile_money`
// (mpesa/airtel — granted to waiters too) and `payments:take_card`
// (paystack/flutterwave/pesapal — cashier/manager only) permissions.
// Preserved exactly: the route itself only requires take_mobile_money (the
// broadest population who can call it at all); takePayment additionally
// requires take_card at runtime when the resolved method needs it, since a
// single route can't statically declare "the permission depends on the
// :provider param" via @RequirePermission.
const ONLINE_PROVIDER_EXTRA_PERMISSION: Partial<Record<PaymentMethod, string>> = {
  card: 'payments:take_card',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Safaricom C2B TransTime format: YYYYMMDDHHmmss (local time), same as the
// STK Push callback's TransactionDate — see mpesa.adapter.ts's getTimestamp.
function parseC2bTransTime(raw: string | undefined): Date {
  if (!raw || raw.length !== 14) return new Date()
  return new Date(
    parseInt(raw.slice(0, 4), 10),
    parseInt(raw.slice(4, 6), 10) - 1,
    parseInt(raw.slice(6, 8), 10),
    parseInt(raw.slice(8, 10), 10),
    parseInt(raw.slice(10, 12), 10),
    parseInt(raw.slice(12, 14), 10),
  )
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(ApprovalsService) private readonly approvalsService: ApprovalsService,
    @Inject(PermissionsService) private readonly permissionsService: PermissionsService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    // forwardRef: ReceiptsService now injects PaymentsService back (reading
    // confirmed payments for a bill) — genuine two-way dependency, same
    // pattern as Orders<->Restaurant (see notifications/index.ts).
    @Inject(forwardRef(() => ReceiptsService)) private readonly receiptsService: ReceiptsService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(ProductsService) private readonly productsService: ProductsService,
    @Inject(StaffNotificationsService) private readonly staffNotifications: StaffNotificationsService,
  ) {}

  // Idempotency short-circuit shared by every payment-taking method. Must run
  // before loadBill: a retry (client timeout, network blip after the first
  // attempt actually succeeded) can arrive after the bill it paid off has
  // already moved to 'paid', and loadBill's status guard would otherwise
  // reject the retry with bill_already_paid instead of returning the prior
  // result — defeating the entire point of the idempotency key (PRD 07).
  private async resolveIdempotentRetry(
    db: Db,
    organizationId: string,
    idempotencyKey: string,
  ): Promise<typeof paymentIntents.$inferSelect | null> {
    const existing = await this.idempotency.findExistingIntent(db, organizationId, idempotencyKey)
    if (!existing || RETRYABLE_INTENT_STATUSES.has(existing.status)) return null
    return existing
  }

  // Same idempotency short-circuit, for the three methods (cash, card
  // terminal, bank transfer) that confirm synchronously in the same
  // transaction the intent is created in — for those, a non-retryable
  // existing intent is always 'confirmed' with a matching `payments` row
  // already inserted, so this returns that row (not the intent) to keep a
  // retry's response shape identical to the original call's.
  private async resolveConfirmedIdempotentRetry(
    db: Db,
    organizationId: string,
    idempotencyKey: string,
  ): Promise<typeof payments.$inferSelect | null> {
    const existing = await this.resolveIdempotentRetry(db, organizationId, idempotencyKey)
    if (!existing) return null
    const [confirmedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentIntentId, existing.id))
    if (!confirmedPayment) {
      throw new Error(
        `payment intent ${existing.id} (status=${existing.status}) has no matching payments row — data integrity violation`,
      )
    }
    return confirmedPayment
  }

  // Every payment-confirmation path (cash, card, mobile money, bank transfer)
  // calls this once its `payments` row is committed, inside the same
  // transaction, so PaymentConfirmed always reflects money genuinely captured.
  private async emitPaymentConfirmed(
    db: Db,
    payment: { id: string; organizationId: string; locationId: string; providerReference: string | null; amount: number },
  ): Promise<void> {
    await this.outbox.persistAndEmit(db, {
      eventType: 'PaymentConfirmed',
      organizationId: payment.organizationId,
      locationId: payment.locationId,
      entityType: 'payment',
      entityId: payment.id,
      data: { providerReference: payment.providerReference, amount: payment.amount },
      occurredAt: new Date(),
    })
  }

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
      const idempotent = await this.resolveConfirmedIdempotentRetry(db, authContext.organizationId, dto.idempotencyKey)
      if (idempotent) return idempotent

      const bill = await this.loadBill(db, authContext.organizationId, billId)

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
      await this.emitPaymentConfirmed(db, payment)
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
  // Generic online/hosted payment — every PaymentAdapter-based provider
  // (M-Pesa STK push, Paystack, Airtel Money, Flutterwave, PesaPal) goes
  // through this one method. Intent created (pending → processing), bill
  // stays payment_pending until handleProviderWebhook confirms. Adding a new
  // provider here means adding one line to ONLINE_PROVIDER_METHOD/
  // ONLINE_PROVIDER_INTENT_TTL_MS above and to payment-provider.factory.ts —
  // no new method, DTO, or route.
  // ---------------------------------------------------------------------------
  async takePayment(authContext: AuthContext, billId: string, provider: string, dto: TakePaymentDto) {
    const method = ONLINE_PROVIDER_METHOD[provider]
    if (!method) {
      throw new BadRequestException({
        code: 'unsupported_provider',
        message: `"${provider}" is not a supported online payment provider. Supported: ${Object.keys(ONLINE_PROVIDER_METHOD).join(', ')}`,
      })
    }

    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const extraPermission = ONLINE_PROVIDER_EXTRA_PERMISSION[method]
      if (extraPermission) {
        const granted = await this.permissionsService.listGrantedPermissions(db, authContext)
        if (!granted.includes(extraPermission)) {
          throw new ForbiddenException({
            code: 'permission_denied',
            message: `taking a "${method}" payment via ${provider} requires missing permission: ${extraPermission}`,
          })
        }
      }

      const idempotent = await this.resolveIdempotentRetry(db, authContext.organizationId, dto.idempotencyKey)
      if (idempotent) return idempotent

      const bill = await this.loadBill(db, authContext.organizationId, billId)

      const surchargeAmount = method === 'card' ? await this.computeCardSurcharge(db, authContext.organizationId, billId) : 0

      const { credentials } = await this.loadIntegrationCredentials(db, authContext.organizationId, bill.locationId, provider)

      // Tip is only realized once the payment actually confirms (see
      // handleProviderWebhook) — stashed on the intent's metadata until then,
      // same shape cash/card-terminal/bank-transfer apply immediately.
      const metadata = dto.tipAmount && dto.tipAmount > 0 ? { tipAmount: dto.tipAmount, tipStaffId: dto.tipStaffId ?? null } : null

      // Create intent before calling the provider so a DB failure after the
      // provider call doesn't leave a dangling external transaction.
      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method,
          provider,
          amount: dto.amount,
          currency: dto.currency,
          surchargeAmount: surchargeAmount > 0 ? surchargeAmount : null,
          idempotencyKey: dto.idempotencyKey,
          customerPhone: dto.customerPhone,
          customerEmail: dto.customerEmail,
          expiresAt: new Date(Date.now() + (ONLINE_PROVIDER_INTENT_TTL_MS[provider] ?? PAYSTACK_INTENT_TTL_MS)),
          processedByActorId: authContext.actorId,
          metadata,
        })
        .returning()
      if (!intent) throw new Error(`failed to create ${provider} payment intent`)

      const adapter = getPaymentAdapter(provider)
      const result = await adapter.initiatePayment(
        {
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          billId,
          paymentIntentId: intent.id,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
          ...(dto.customerPhone !== undefined && { customerPhone: dto.customerPhone }),
          ...(dto.customerEmail !== undefined && { customerEmail: dto.customerEmail }),
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
      if (!updated) throw new Error(`failed to update ${provider} intent to processing`)

      return { ...updated, surchargeAmount, cashAmount: bill.totalAmount }
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
      const idempotent = await this.resolveConfirmedIdempotentRetry(db, authContext.organizationId, dto.idempotencyKey)
      if (idempotent) return idempotent

      const bill = await this.loadBill(db, authContext.organizationId, billId)

      const surchargeAmount = await this.computeCardSurcharge(db, authContext.organizationId, billId)

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
          surchargeAmount: surchargeAmount > 0 ? surchargeAmount : null,
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
          surchargeAmount: surchargeAmount > 0 ? surchargeAmount : null,
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
      await this.emitPaymentConfirmed(db, payment)
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
      const idempotent = await this.resolveConfirmedIdempotentRetry(db, authContext.organizationId, dto.idempotencyKey)
      if (idempotent) return idempotent

      const bill = await this.loadBill(db, authContext.organizationId, billId)

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
      await this.emitPaymentConfirmed(db, payment)
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
  // Generic online-provider webhook — unauthenticated provider callback
  // (POST /webhooks/:provider/:orgId), one implementation for every
  // PaymentAdapter-based provider. 1. verify connection exists, 2. verify
  // signature/payload via that provider's adapter, 3. find intent by
  // providerReference, 4. create payment + settle bill + apply any stashed
  // tip, 5. provider-specific side effects (currently just M-Pesa's Module
  // 18 fraud check — alert only, never blocks).
  // ---------------------------------------------------------------------------
  async handleProviderWebhook(
    orgId: string,
    provider: string,
    rawPayload: string,
    signature: string | undefined,
    headers: Record<string, string>,
  ) {
    if (!(provider in ONLINE_PROVIDER_METHOD)) {
      return { status: 'ignored', reason: 'unknown_provider' }
    }

    return withTenantContext(this.pool, orgId, async (db) => {
      const conn = await this.findActiveConnection(db, orgId, provider)
      if (!conn) {
        return { status: 'ignored', reason: 'integration_not_configured' }
      }

      // Some providers (M-Pesa, Airtel) don't sign payloads at all — their
      // adapters ignore the credentials argument for verifyWebhook. Passing
      // real decrypted credentials uniformly (rather than special-casing
      // which providers need them) keeps this method provider-agnostic.
      const credentials = JSON.parse(decryptCredentials(conn.credentialsEncrypted)) as Record<string, string>

      const adapter = getPaymentAdapter(provider)
      const result = await adapter.verifyWebhook({ rawPayload, signature: signature ?? '', headers }, credentials)

      if (!result.providerReference || !result.paymentIntentId) {
        return { status: 'ignored', reason: 'no_provider_reference' }
      }

      // Lookup key is result.paymentIntentId, never result.providerReference:
      // on a successful M-Pesa/Airtel/PesaPal payment, providerReference
      // switches to the provider's final receipt/settlement reference, which
      // is *not* what was stored on the intent at creation time (that was
      // the provider's pre-payment tracking id — CheckoutRequestID,
      // transaction id, order tracking id). paymentIntentId is each
      // adapter's contract for "the value to look this intent up by" — for
      // Paystack/Flutterwave that's literally our own payment_intents.id
      // (echoed back via metadata we set), for the others it's their
      // tracking id, matching payment_intents.provider_reference. One OR
      // handles both shapes without the adapters needing to agree on which.
      // Postgres throws (not just "no match") comparing a non-UUID string
      // against a uuid column — only add the `id` branch when the value is
      // actually UUID-shaped (Paystack/Flutterwave); M-Pesa/Airtel/PesaPal's
      // tracking-id strings never are, so they rely on the providerReference
      // branch alone.
      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.organizationId, orgId),
            UUID_RE.test(result.paymentIntentId)
              ? or(eq(paymentIntents.id, result.paymentIntentId), eq(paymentIntents.providerReference, result.paymentIntentId))
              : eq(paymentIntents.providerReference, result.paymentIntentId),
          ),
        )

      if (!intent) {
        return { status: 'ignored', reason: 'intent_not_found' }
      }

      if (result.status !== 'confirmed') {
        // Declined, expired, or cancelled by the customer.
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
      if (!payment) throw new Error(`failed to create payment record from ${provider} webhook`)

      // Tip captured at takePayment time is only realized once the payment
      // actually confirms.
      const tipMeta = intent.metadata as { tipAmount?: number; tipStaffId?: string | null } | null
      if (tipMeta?.tipAmount && tipMeta.tipAmount > 0) {
        await db.insert(tips).values({
          organizationId: orgId,
          locationId: intent.locationId,
          paymentId: payment.id,
          billId: intent.billId,
          staffId: tipMeta.tipStaffId ?? null,
          amount: tipMeta.tipAmount,
          currency: intent.currency,
        })
      }

      await this.settleBillIfFullyPaid(db, intent.billId, orgId)

      // Module 18 fraud check: compare the incoming sender phone and paybill/
      // till number against the org's registered numbers stored in
      // integration_connections.metadata. M-Pesa-specific (STK push doesn't
      // reuse a merchant paybill/till the way other providers' checkout
      // flows do) — alert only, never blocks.
      if (provider === 'mpesa_daraja') {
        await this.checkMpesaFraud(db, orgId, intent.locationId, result, payment)
      }

      await this.auditLog.record({
        organizationId: orgId,
        locationId: intent.locationId,
        actorType: 'system',
        action: `payment.${provider}.confirmed`,
        entityType: 'payment',
        entityId: payment.id,
        newValue: { providerReference: result.providerReference, amount: intent.amount },
      })

      await this.emitPaymentConfirmed(db, payment)

      return { status: 'confirmed', paymentId: payment.id }
    })
  }

  // ---------------------------------------------------------------------------
  // M-Pesa C2B (Paybill/Till manual payment) — a structurally different flow
  // from STK Push above: the customer dials the M-Pesa menu themselves, so
  // there's no payment_intent to confirm against. One-time setup per
  // shortcode registers our Validation/Confirmation URLs with Safaricom.
  // ---------------------------------------------------------------------------
  async registerMpesaC2b(authContext: AuthContext, dto: RegisterMpesaC2bDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const { credentials } = await this.loadIntegrationCredentials(
        db,
        authContext.organizationId,
        dto.locationId ?? authContext.locationId ?? '',
        'mpesa_daraja',
      )

      const baseUrl = process.env['PUBLIC_URL'] ?? 'https://pay.hospitality-os.app'
      const validationUrl = `${baseUrl}/api/v1/webhooks/mpesa/c2b/validation/${authContext.organizationId}`
      const confirmationUrl = `${baseUrl}/api/v1/webhooks/mpesa/c2b/confirmation/${authContext.organizationId}`

      const result = await registerMpesaC2BUrls(
        credentials as unknown as MpesaCredentials,
        validationUrl,
        confirmationUrl,
        dto.responseType ?? 'Completed',
      )

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: dto.locationId ?? null,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'payment.mpesa_c2b.urls_registered',
        entityType: 'integration_connection',
        newValue: { validationUrl, confirmationUrl, responseType: dto.responseType ?? 'Completed' },
      })

      return result
    })
  }

  // Validation is disabled by default on most shortcodes — Safaricom only
  // calls this if the merchant separately requested it be enabled. Must
  // respond fast; by the time this fires, the customer has already entered
  // their M-Pesa PIN, so this only rejects structurally invalid payloads
  // (see validateC2BPayload's own comment), never "we don't recognize this."
  handleMpesaC2bValidation(payload: C2BValidationPayload) {
    const result = validateC2BPayload(payload)
    return { ResultCode: result.resultCode === '0' ? 0 : result.resultCode, ResultDesc: result.resultDesc }
  }

  // Called after the money has already settled — always ACK 200 regardless
  // of what we do with the payload; Safaricom does not retry based on our
  // response body here (unlike Validation). Lands in mpesa_c2b_transactions
  // as 'unmatched' unless billRefNumber happens to be an exact bill/order id
  // (e.g. a QR receipt that told the customer to use their order id as the
  // Paybill account reference) — the common case needs a human, since a Till
  // payment carries no reference at all and a Paybill one is free-text a
  // customer can mistype.
  async handleMpesaC2bConfirmation(orgId: string, payload: C2BValidationPayload) {
    return withTenantContext(this.pool, orgId, async (db) => {
      if (!payload.TransID || !payload.MSISDN || !payload.TransAmount || !payload.BusinessShortCode) {
        return { ResultCode: 0, ResultDesc: 'Confirmation received successfully' }
      }

      const amount = Math.round(Number(payload.TransAmount))
      const transTime = parseC2bTransTime(payload.TransTime)

      const [existing] = await db
        .select({ id: mpesaC2bTransactions.id })
        .from(mpesaC2bTransactions)
        .where(and(eq(mpesaC2bTransactions.organizationId, orgId), eq(mpesaC2bTransactions.transId, payload.TransID)))
      if (existing) {
        // Safaricom retries Confirmation delivery on timeout — already recorded, just re-ack.
        return { ResultCode: 0, ResultDesc: 'Confirmation received successfully' }
      }

      const [txn] = await db
        .insert(mpesaC2bTransactions)
        .values({
          organizationId: orgId,
          transType: payload.TransactionType ?? 'Pay Bill',
          transId: payload.TransID,
          transTime,
          transAmount: amount,
          businessShortCode: payload.BusinessShortCode,
          billRefNumber: payload.BillRefNumber ?? null,
          invoiceNumber: payload.InvoiceNumber ?? null,
          orgAccountBalance: payload.OrgAccountBalance ?? null,
          msisdn: payload.MSISDN,
          firstName: payload.FirstName ?? null,
          middleName: payload.MiddleName ?? null,
          lastName: payload.LastName ?? null,
          rawPayload: payload as unknown as Record<string, unknown>,
        })
        .returning()
      if (!txn) throw new Error('failed to record M-Pesa C2B transaction')

      const ref = payload.BillRefNumber?.trim()
      if (ref && UUID_RE.test(ref)) {
        let bill = await this.ordersService.getBillById(db, orgId, ref).catch(() => null)
        if (!bill) {
          const order = await this.ordersService.getOrderById(db, orgId, ref).catch(() => null)
          if (order) bill = await this.ordersService.getOpenBillForOrder(db, orgId, order.id)
        }
        if (bill && bill.status !== 'paid' && bill.status !== 'voided') {
          await this.recordC2bPaymentToBill(db, orgId, txn, bill, null)
        }
      }

      return { ResultCode: 0, ResultDesc: 'Confirmation received successfully' }
    })
  }

  // Staff-facing reconciliation: every unmatched C2B transaction for the org,
  // newest first, for a cashier/manager to eyeball against open bills (amount
  // + rough timing + customer name is usually enough to tell).
  async listUnmatchedMpesaC2b(authContext: AuthContext) {
    return withTenantContext(this.pool, authContext.organizationId, (db) =>
      db
        .select()
        .from(mpesaC2bTransactions)
        .where(and(eq(mpesaC2bTransactions.organizationId, authContext.organizationId), eq(mpesaC2bTransactions.status, 'unmatched')))
        .orderBy(desc(mpesaC2bTransactions.transTime)),
    )
  }

  async matchMpesaC2b(authContext: AuthContext, transactionId: string, dto: MatchMpesaC2bDto) {
    const result = await withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [txn] = await db
        .select()
        .from(mpesaC2bTransactions)
        .where(and(eq(mpesaC2bTransactions.id, transactionId), eq(mpesaC2bTransactions.organizationId, authContext.organizationId)))
      if (!txn) throw new NotFoundException('M-Pesa C2B transaction not found')
      if (txn.status !== 'unmatched') {
        throw new BadRequestException({ code: 'already_matched', message: `transaction is already ${txn.status}` })
      }

      const bill = await this.loadBill(db, authContext.organizationId, dto.billId)
      const payment = await this.recordC2bPaymentToBill(db, authContext.organizationId, txn, bill, authContext.actorId)
      return { transaction: txn, payment }
    })

    await this.auditLog.record({
      organizationId: authContext.organizationId,
      actorType: authContext.actorType,
      actorId: authContext.actorId,
      action: 'payment.mpesa_c2b.matched',
      entityType: 'payment',
      entityId: result.payment.id,
      newValue: { transactionId, billId: dto.billId, amount: result.transaction.transAmount },
    })

    return result
  }

  // Shared by both the auto-match attempt (confirmation webhook) and the
  // staff manual-match endpoint: records a real payments row (there was no
  // prior payment_intent, so one is created here, immediately confirmed —
  // same "retroactive intent" shape cash payments use) and marks the C2B
  // transaction row settled. actorId is null for an automatic match.
  private async recordC2bPaymentToBill(
    db: Db,
    organizationId: string,
    txn: typeof mpesaC2bTransactions.$inferSelect,
    bill: { id: string; locationId: string; orderId: string; currency: string },
    actorId: string | null,
  ) {
    const [intent] = await db
      .insert(paymentIntents)
      .values({
        organizationId,
        locationId: bill.locationId,
        orderId: bill.orderId,
        billId: bill.id,
        method: 'mpesa',
        provider: 'mpesa_daraja',
        amount: txn.transAmount,
        currency: txn.currency,
        status: 'confirmed',
        idempotencyKey: `c2b-${txn.transId}`,
        providerReference: txn.transId,
        customerPhone: txn.msisdn,
        processedByActorId: actorId,
      })
      .returning()
    if (!intent) throw new Error('failed to create payment intent for C2B transaction')

    const [payment] = await db
      .insert(payments)
      .values({
        organizationId,
        locationId: bill.locationId,
        orderId: bill.orderId,
        billId: bill.id,
        paymentIntentId: intent.id,
        method: 'mpesa',
        provider: 'mpesa_daraja',
        providerReference: txn.transId,
        amount: txn.transAmount,
        currency: txn.currency,
        idempotencyKey: `c2b-${txn.transId}`,
        processedByActorId: actorId,
      })
      .returning()
    if (!payment) throw new Error('failed to create payment record for C2B transaction')

    await db
      .update(mpesaC2bTransactions)
      .set({
        status: 'matched',
        locationId: bill.locationId,
        matchedBillId: bill.id,
        matchedPaymentId: payment.id,
        matchedByActorId: actorId,
        matchedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(mpesaC2bTransactions.id, txn.id))

    await this.settleBillIfFullyPaid(db, bill.id, organizationId)
    await this.emitPaymentConfirmed(db, payment)

    return payment
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
  // Bar tabs — card pre-authorization / mobile-money deposit hold (P7).
  // openTab creates a held intent; chargeTab records charges against it;
  // settleTab captures the full amount and transitions to confirmed.
  // ---------------------------------------------------------------------------

  // POST /api/v1/bills/:billId/tabs/open
  async openTab(authContext: AuthContext, billId: string, dto: OpenBarTabDto) {
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

      const tabId = randomUUID()

      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          method: 'card',
          provider: 'none',
          amount: dto.amount,
          currency: dto.currency,
          status: 'held',
          tabId,
          idempotencyKey: dto.idempotencyKey,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!intent) throw new Error('failed to create bar tab intent')

      return intent
    })
  }

  async chargeTab(authContext: AuthContext, tabId: string, dto: ChargeBarTabDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.tabId, tabId),
            eq(paymentIntents.organizationId, authContext.organizationId),
          ),
        )
      if (!intent) {
        throw new NotFoundException({
          code: 'bar_tab_not_found',
          message: 'bar tab not found',
        })
      }
      if (intent.status !== 'held') {
        throw new BadRequestException({
          code: 'bar_tab_not_held',
          message: `bar tab is in status "${intent.status}" — must be held to charge`,
        })
      }

      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: authContext.organizationId,
          locationId: intent.locationId,
          orderId: dto.orderId,
          billId: intent.billId,
          paymentIntentId: intent.id,
          method: 'card',
          provider: 'none',
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: `charge-${tabId}-${dto.orderId}-${dto.amount}`,
          processedByActorId: authContext.actorId,
        })
        .returning()
      if (!payment) throw new Error('failed to create bar tab charge payment')

      await this.emitPaymentConfirmed(db, payment)

      return payment
    })
  }

  async settleTab(authContext: AuthContext, tabId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [intent] = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.tabId, tabId),
            eq(paymentIntents.organizationId, authContext.organizationId),
          ),
        )
      if (!intent) {
        throw new NotFoundException({
          code: 'bar_tab_not_found',
          message: 'bar tab not found',
        })
      }
      if (intent.status !== 'held') {
        throw new BadRequestException({
          code: 'bar_tab_not_held',
          message: `bar tab is in status "${intent.status}" — must be held to settle`,
        })
      }

      const [updated] = await db
        .update(paymentIntents)
        .set({ status: 'confirmed', updatedAt: sql`now()` })
        .where(eq(paymentIntents.id, intent.id))
        .returning()
      if (!updated) throw new Error('failed to settle bar tab')

      const existingPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.paymentIntentId, intent.id),
            eq(payments.organizationId, authContext.organizationId),
          ),
        )

      if (!existingPayments.length) {
        const [payment] = await db.insert(payments).values({
          organizationId: authContext.organizationId,
          locationId: intent.locationId,
          orderId: intent.orderId,
          billId: intent.billId,
          paymentIntentId: intent.id,
          method: 'card',
          provider: 'none',
          amount: intent.amount,
          currency: intent.currency,
          idempotencyKey: `settle-${tabId}`,
          processedByActorId: authContext.actorId,
        }).returning()
        if (!payment) throw new Error('failed to create bar tab settlement payment')
        await this.emitPaymentConfirmed(db, payment)
      }

      return updated
    })
  }

  // ---------------------------------------------------------------------------
  // Split-check WhatsApp payment link — generates a signed JWT token that
  // allows a customer to pay their share via a self-service payment page.
  // ---------------------------------------------------------------------------
  async generateSplitPaymentLink(
    authContext: AuthContext,
    orderId: string,
    billId: string,
    splitId: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.ordersService.getBillById(db, authContext.organizationId, billId)

      const { signPaymentLinkToken } = await import('./payment-link-jwt.js')
      const token = await signPaymentLinkToken({
        organizationId: authContext.organizationId,
        orderId,
        billId,
        splitId,
        tokenType: 'payment_link',
      })

      const [intent] = await db
        .insert(paymentIntents)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId,
          billId,
          method: 'mpesa',
          provider: 'mpesa_daraja',
          amount: bill.totalAmount,
          currency: bill.currency,
          paymentLinkToken: token,
          idempotencyKey: `payment-link-${splitId}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .returning()
      if (!intent) throw new Error('failed to create payment link intent')

      const baseUrl = process.env['PUBLIC_URL'] ?? 'https://pay.hospitality-os.app'
      return {
        url: `${baseUrl}/pay/${token}`,
        token,
        intentId: intent.id,
        amount: bill.totalAmount,
        currency: bill.currency,
      }
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

  // Amount still owed on a bill — totalAmount minus everything already
  // confirmed. Callers charging a bill in full (e.g. QR self-checkout) must
  // derive the amount to charge from here, never accept it from the client.
  async getOutstandingBalance(authContext: AuthContext, billId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.loadBillForRead(db, authContext.organizationId, billId)
      const [paidRow] = await db
        .select({ paid: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(
          and(
            eq(payments.billId, billId),
            eq(payments.organizationId, authContext.organizationId),
            eq(payments.status, 'confirmed'),
          ),
        )
      const amountPaid = Number(paidRow?.paid ?? 0)
      const outstandingAmount = Math.max(bill.totalAmount - amountPaid, 0)
      return { billId, currency: bill.currency, totalAmount: bill.totalAmount, amountPaid, outstandingAmount }
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
  // db-first — cross-module read helpers for ShiftsService/ReceiptsService.
  // payments/refunds/payment_intents are payments-owned.
  // ---------------------------------------------------------------------------

  async hasPendingPaymentIntents(db: Db, organizationId: string, locationId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: paymentIntents.id })
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.locationId, locationId),
          eq(paymentIntents.organizationId, organizationId),
          inArray(paymentIntents.status, ['pending', 'processing']),
        ),
      )
      .limit(1)
    return row != null
  }

  async listConfirmedPaymentsForOrders(db: Db, organizationId: string, orderIds: string[]) {
    if (orderIds.length === 0) return []
    return db
      .select()
      .from(payments)
      .where(and(eq(payments.status, 'confirmed'), inArray(payments.orderId, orderIds), eq(payments.organizationId, organizationId)))
  }

  async listRefundsForPayments(db: Db, organizationId: string, paymentIds: string[], statuses: string[]) {
    if (paymentIds.length === 0) return []
    return db
      .select()
      .from(refunds)
      .where(and(eq(refunds.organizationId, organizationId), inArray(refunds.paymentId, paymentIds), inArray(refunds.status, statuses)))
  }

  async listConfirmedPaymentsForBill(db: Db, organizationId: string, billId: string) {
    return db
      .select()
      .from(payments)
      .where(and(eq(payments.billId, billId), eq(payments.organizationId, organizationId), eq(payments.status, 'confirmed')))
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  // Compute card surcharge from the bill's items' cardSurchargePct.
  // Returns 0 if no products on the bill have a surcharge configured.
  // billItems/orderItems are orders-owned, products is products-owned —
  // both foreign reads go through their owning service.
  private async computeCardSurcharge(db: Db, organizationId: string, billId: string): Promise<number> {
    try {
      const billItemsForBill = await this.ordersService.getProductIdsForBillItems(db, organizationId, billId)
      if (!billItemsForBill.length) return 0

      const productIds = [...new Set(billItemsForBill.map((bi) => bi.productId))]
      const productsForBill = await this.productsService.getProductsByIds(db, organizationId, productIds)
      const productMap = new Map(productsForBill.map((p) => [p.id, p]))

      let surcharge = 0
      for (const bi of billItemsForBill) {
        const product = productMap.get(bi.productId)
        if (!product?.cardSurchargePct) continue
        surcharge += Math.round(bi.allocatedAmount * product.cardSurchargePct / 100)
      }
      return surcharge
    } catch {
      return 0
    }
  }

  // Load bill, assert org ownership, and block payments on terminal states.
  private async loadBill(db: Db, organizationId: string, billId: string) {
    const bill = await this.ordersService.getBillById(db, organizationId, billId)
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
    return this.ordersService.getBillById(db, organizationId, billId)
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
  // If >= bill.totalAmount, mark bill paid via OrdersService (bills/orders
  // are orders-owned — see orders.module.ts's `owns` manifest — so the
  // status writes and their ORDER_STATUS_TRANSITIONS validation live there,
  // not duplicated here). Then, if every bill on the order is now paid,
  // close the order (P5 handoff PRD 07).
  private async settleBillIfFullyPaid(
    db: Db,
    billId: string,
    organizationId: string,
  ): Promise<void> {
    // Tolerates a missing bill (silent no-op) rather than throwing — matches
    // the original inline query's behavior; getBillById throws, so the
    // "not found" case is caught here instead.
    let bill
    try {
      bill = await this.ordersService.getBillById(db, organizationId, billId)
    } catch {
      return
    }
    if (bill.status === 'paid') return

    const confirmedPayments = await this.listConfirmedPaymentsForBill(db, organizationId, billId)

    const totalConfirmed = confirmedPayments.reduce((sum, p) => sum + p.amount, 0)
    if (totalConfirmed < bill.totalAmount) return

    const settlement = await this.ordersService.markBillFullyPaid(db, organizationId, billId)
    if (!settlement) return

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

    if (settlement.allBillsOnOrderPaid) {
      await this.ordersService.applyPaymentCompletion(db, organizationId, settlement.orderId)
    }
  }

  // Module 18 fraud check: compare the incoming sender phone and paybill/till
  // number against the org's registered numbers stored in
  // integration_connections.metadata. Sets fraudAlert on the payment row when a
  // mismatch is found and creates a staff notification for the manager.
  // The payment is NOT blocked — alert only.
  private async checkMpesaFraud(
    db: Db,
    orgId: string,
    locationId: string,
    result: { providerReference: string; metadata?: Record<string, unknown> },
    payment: Record<string, unknown>,
  ): Promise<void> {
    try {
      const conn = await this.findActiveConnection(db, orgId, 'mpesa_daraja')
      if (!conn?.metadata) return

      const meta = conn.metadata as { registeredNumbers?: unknown; registeredPhones?: unknown }
      const registeredNumbers = Array.isArray(meta.registeredNumbers)
        ? (meta.registeredNumbers as string[])
        : []
      const registeredPhones = Array.isArray(meta.registeredPhones)
        ? (meta.registeredPhones as string[])
        : []

      if (!registeredNumbers.length && !registeredPhones.length) return

      const incomingShortCode = result.metadata?.['BusinessShortCode'] as string | undefined
      const incomingPhone = (result.metadata?.['MSISDN'] ??
        result.metadata?.['customerPhone'] ??
        result.metadata?.['SenderPhone']) as string | undefined

      const shortCodeMismatch =
        incomingShortCode && registeredNumbers.length > 0
          ? !registeredNumbers.includes(incomingShortCode)
          : false
      const phoneMismatch =
        incomingPhone && registeredPhones.length > 0
          ? !registeredPhones.includes(incomingPhone)
          : false

      if (shortCodeMismatch || phoneMismatch) {
        await db
          .update(payments)
          .set({ fraudAlert: true, updatedAt: sql`now()` })
          .where(eq(payments.id, payment['id'] as string))

        await this.auditLog.record({
          organizationId: orgId,
          locationId,
          actorType: 'system',
          action: 'payment.mpesa.fraud_alert',
          entityType: 'payment',
          entityId: payment['id'] as string,
          newValue: {
            providerReference: result.providerReference,
            detectedShortCode: incomingShortCode ?? null,
            detectedPhone: incomingPhone ?? null,
            registeredNumbers,
            registeredPhones,
            billId: payment['billId'],
          },
        })

        await this.createFraudNotification(db, orgId, locationId, payment, incomingShortCode, incomingPhone)
      }
    } catch {
      // Fraud check is best-effort — a failure here must never block or roll back
      // a confirmed payment. Silently swallow and let the audit trail stand as-is.
    }
  }

  private async createFraudNotification(
    db: Db,
    orgId: string,
    locationId: string,
    payment: Record<string, unknown>,
    detectedShortCode: string | undefined,
    detectedPhone: string | undefined,
  ): Promise<void> {
    try {
      const messageParts: string[] = ['M-Pesa fraud alert']
      if (detectedShortCode) messageParts.push(`unrecognized till/paybill: ${detectedShortCode}`)
      if (detectedPhone) messageParts.push(`unrecognized sender phone: ${detectedPhone}`)
      messageParts.push(`payment: ${payment['id'] as string}`)

      await this.staffNotifications.create(db, {
        organizationId: orgId,
        locationId,
        notificationType: 'fraud_alert',
        message: messageParts.join(' — '),
        channel: 'in_app',
      })
    } catch {
      // Notification creation is best-effort — must not block payment processing.
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
