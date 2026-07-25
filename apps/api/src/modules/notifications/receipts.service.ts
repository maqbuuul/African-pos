import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { Pool } from 'pg'

import {
  bills,
  locations,
  notificationPreferences,
  orders,
  organizations,
  payments,
  receipts,
  taxComplianceSubmissions,
  withTenantContext,
  type Db,
} from '@hospitality-os/database'
import {
  getMessagingAdapter,
  getTaxAdapter,
  type ReceiptRenderInput,
} from '@hospitality-os/integrations'

import { AuditLogService } from '../../core/audit/audit-log.service.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import type { AuthContext } from '../../core/tenant/tenant.types.js'
import { OrganizationService } from '../organization/organization.service.js'
import { OrdersService } from '../orders/orders.service.js'
import { PaymentsService } from '../payments/payments.service.js'
import type { SendReceiptDto } from './dto/send-receipt.dto.js'
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js'

@Injectable()
export class ReceiptsService {
  constructor(
    @Inject(APP_POOL) private readonly pool: Pool,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(OrganizationService) private readonly organizationService: OrganizationService,
    // PaymentsModule already imports NotificationsModule (for post-payment
    // receipt generation) — this is the reverse edge of that same genuine
    // two-way dependency, so both sides need forwardRef, same pattern as
    // Orders<->Restaurant's KdsService/OrdersService cycle.
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
  ) {}

  async generate(
    authContext: AuthContext,
    billId: string,
    customerPhone?: string,
    customerEmail?: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const bill = await this.ordersService.getBillById(db, authContext.organizationId, billId)
      const orderData = await this.ordersService.getOrderById(db, authContext.organizationId, bill.orderId)
      const locationData = await this.organizationService.getLocationById(db, authContext.organizationId, bill.locationId)
      const orgData = await this.organizationService.getOrganizationForRead(db, authContext.organizationId)

      const receiptNumber = await this.generateReceiptNumber(db, authContext.organizationId)

      const paymentsList = await this.paymentsService.listConfirmedPaymentsForBill(db, authContext.organizationId, billId)

      const receiptContent = this.buildReceiptContent({
        organization: orgData,
        location: locationData,
        order: orderData,
        bill,
        payments: paymentsList,
        receiptNumber,
      }) as unknown as Record<string, unknown>

      const [receipt] = await db
        .insert(receipts)
        .values({
          organizationId: authContext.organizationId,
          locationId: bill.locationId,
          orderId: bill.orderId,
          billId,
          receiptNumber,
          content: receiptContent as Record<string, unknown>,
          preferredChannel: customerPhone ? 'whatsapp' : customerEmail ? 'email' : null,
        })
        .returning()
      if (!receipt) throw new Error('failed to create receipt')

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: bill.locationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'receipt.generated',
        entityType: 'receipt',
        entityId: receipt.id,
        newValue: { billId, receiptNumber },
      })

      return receipt
    })
  }

  async send(authContext: AuthContext, receiptId: string, dto?: SendReceiptDto) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const receipt = await this.loadReceipt(db, authContext.organizationId, receiptId)

      const channels = dto?.channels ?? this.resolveChannels(receipt.preferredChannel)

      const deliveryResults: Record<string, string> = {}
      let isDelivered = false

      for (const channel of channels) {
        try {
          const adapter = getMessagingAdapter(channel)

          const target =
            channel === 'email'
              ? (dto?.customerEmail ?? '')
              : channel === 'print'
                ? 'local_printer'
                : (dto?.customerPhone ?? '')

          if (!target) {
            deliveryResults[channel] = 'failed'
            continue
          }

          const body = this.renderReceiptText(receipt.content as unknown as ReceiptRenderInput)

          const result = await adapter.send({ to: target, body }, {})
          deliveryResults[channel] = result.status

          if (result.status === 'sent' || result.status === 'delivered') {
            isDelivered = true
          }
        } catch {
          deliveryResults[channel] = 'failed'
        }
      }

      await db
        .update(receipts)
        .set({
          deliveryStatus: deliveryResults as Record<string, unknown>,
          isDelivered,
          deliveredAt: isDelivered ? sql`now()` : null,
          updatedAt: sql`now()`,
        })
        .where(eq(receipts.id, receiptId))

      await this.auditLog.record({
        organizationId: authContext.organizationId,
        locationId: receipt.locationId,
        actorType: authContext.actorType,
        actorId: authContext.actorId,
        action: 'receipt.sent',
        entityType: 'receipt',
        entityId: receiptId,
        newValue: { channels, deliveryResults },
      })

      return { receiptId, deliveryResults, isDelivered }
    })
  }

  async getStatus(authContext: AuthContext, receiptId: string) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      return this.loadReceipt(db, authContext.organizationId, receiptId)
    })
  }

  async submitToTaxAuthority(
    authContext: AuthContext,
    receiptId: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const receipt = await this.loadReceipt(db, authContext.organizationId, receiptId)

      const locationData = await this.organizationService.getLocationById(db, authContext.organizationId, receipt.locationId)
      const orgData = await this.organizationService.getOrganizationForRead(db, authContext.organizationId)

      const taxProvider = locationData.country === 'KE' ? 'kra_etims' : null
      if (!taxProvider) return null

      const adapter = getTaxAdapter(taxProvider)

      const result = await adapter.submitInvoice({
        organizationId: authContext.organizationId,
        locationId: receipt.locationId,
        receiptId: receipt.id,
        receiptContent: receipt.content as Record<string, unknown>,
        taxRegistration: {
          kraPin: orgData.taxId ?? orgData.legalName ?? 'PENDING',
          etrSerial: orgData.taxSerial ?? 'PENDING',
        },
      })

      const [submission] = await db
        .insert(taxComplianceSubmissions)
        .values({
          organizationId: authContext.organizationId,
          locationId: receipt.locationId,
          receiptId: receipt.id,
          country: locationData.country,
          provider: taxProvider,
          submissionStatus: result.status === 'confirmed' ? 'confirmed' : 'failed',
          providerReference: result.providerReference,
          requestPayload: { receiptContent: receipt.content } as Record<string, unknown>,
          responsePayload: result.responsePayload ?? null,
          errorMessage: result.errorMessage ?? null,
          submittedAt: sql`now()`,
        })
        .returning()

      if (submission && result.status === 'confirmed') {
        await this.auditLog.record({
          organizationId: authContext.organizationId,
          locationId: receipt.locationId,
          actorType: authContext.actorType,
          actorId: authContext.actorId,
          action: 'tax_compliance.submitted',
          entityType: 'tax_compliance_submission',
          entityId: submission.id,
          newValue: { receiptId, provider: taxProvider, providerReference: result.providerReference },
        })
      }

      return submission ?? null
    })
  }

  async updatePreferences(
    authContext: AuthContext,
    dto: UpdatePreferencesDto,
    subjectType: 'staff' | 'customer',
    subjectId: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const existing = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.organizationId, authContext.organizationId),
            eq(notificationPreferences.subjectType, subjectType),
            eq(notificationPreferences.subjectId, subjectId),
          ),
        )

      if (existing[0]) {
        const [updated] = await db
          .update(notificationPreferences)
          .set({
            channelPreferences: dto.channelPreferences as Record<string, unknown> ?? existing[0].channelPreferences,
            quietHoursStart: dto.quietHoursStart ?? existing[0].quietHoursStart,
            quietHoursEnd: dto.quietHoursEnd ?? existing[0].quietHoursEnd,
            optedOut: dto.optedOut ?? existing[0].optedOut,
            updatedAt: sql`now()`,
          })
          .where(eq(notificationPreferences.id, existing[0].id))
          .returning()
        return updated
      }

      const [created] = await db
        .insert(notificationPreferences)
        .values({
          organizationId: authContext.organizationId,
          subjectType,
          subjectId,
          channelPreferences: dto.channelPreferences as Record<string, unknown> ?? {},
          quietHoursStart: dto.quietHoursStart ?? null,
          quietHoursEnd: dto.quietHoursEnd ?? null,
          optedOut: dto.optedOut ?? false,
        })
        .returning()
      return created
    })
  }

  async getPreferences(
    authContext: AuthContext,
    subjectType: 'staff' | 'customer',
    subjectId: string,
  ) {
    return withTenantContext(this.pool, authContext.organizationId, async (db) => {
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.organizationId, authContext.organizationId),
            eq(notificationPreferences.subjectType, subjectType),
            eq(notificationPreferences.subjectId, subjectId),
          ),
        )
      return prefs ?? null
    })
  }

  async generateForOrder(
    authContext: AuthContext,
    orderId: string,
    billId: string,
    customerPhone?: string,
    customerEmail?: string,
  ) {
    const receipt = await this.generate(authContext, billId, customerPhone, customerEmail)

    const dto: SendReceiptDto = {}
    if (customerPhone) dto.customerPhone = customerPhone
    if (customerEmail) dto.customerEmail = customerEmail

    await this.send(authContext, receipt.id, dto)

    await this.submitToTaxAuthority(authContext, receipt.id)

    return receipt
  }

  private resolveChannels(preferredChannel: string | null): string[] {
    if (preferredChannel) return [preferredChannel]
    return ['whatsapp', 'sms', 'email']
  }

  // db-first — used by SyncService.pushOperations for offline-submitted
  // receipts' tax-compliance queuing. Distinct from submitToTaxAuthority
  // (which does a real, synchronous 'confirmed'/'failed' submission via the
  // tax adapter): this just records a best-effort 'queued' row when the
  // client is offline. Returns null (rather than throwing) when the receipt
  // isn't found, matching the caller's existing best-effort semantics.
  async recordOfflineTaxSubmission(
    db: Db,
    organizationId: string,
    receiptId: string,
    requestPayload: Record<string, unknown>,
  ): Promise<{ submission: typeof taxComplianceSubmissions.$inferSelect; locationId: string } | null> {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.organizationId, organizationId)))
      .limit(1)
    if (!receipt) return null

    const [submission] = await db
      .insert(taxComplianceSubmissions)
      .values({
        organizationId,
        locationId: receipt.locationId,
        receiptId: receipt.id,
        country: 'KE',
        provider: 'kra_etims',
        submissionStatus: 'queued',
        requestPayload,
      })
      .returning()
    if (!submission) return null
    return { submission, locationId: receipt.locationId }
  }

  private async loadReceipt(db: Db, organizationId: string, receiptId: string) {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.organizationId, organizationId)))
    if (!receipt) throw new NotFoundException({ code: 'receipt_not_found', message: 'Receipt not found' })
    return receipt
  }

  private async generateReceiptNumber(db: Db, organizationId: string): Promise<string> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(receipts)
      .where(eq(receipts.organizationId, organizationId))
    const count = (result?.count ?? 0) + 1
    return `RCP-${String(count).padStart(4, '0')}`
  }

  private buildReceiptContent(data: {
    organization: typeof organizations.$inferSelect
    location: typeof locations.$inferSelect
    order: typeof orders.$inferSelect
    bill: typeof bills.$inferSelect
    payments: (typeof payments.$inferSelect)[]
    receiptNumber: string
  }): ReceiptRenderInput {
    return {
      businessName: data.organization.name,
      businessAddress: data.location.address ?? undefined,
      kraPin: data.organization.taxId ?? data.organization.legalName ?? undefined,
      etrSerial: data.organization.taxSerial ?? 'PENDING',
      receiptNumber: data.receiptNumber,
      orderNumber: data.order.id.slice(0, 8),
      staffName: undefined,
      items: [],
      subtotalAmount: data.bill.subtotalAmount,
      discountAmount: data.bill.discountAmount,
      taxAmount: data.bill.taxAmount,
      serviceChargeAmount: data.bill.serviceChargeAmount,
      tipAmount: data.bill.tipAmount,
      totalAmount: data.bill.totalAmount,
      currency: data.bill.currency,
      payments: data.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.providerReference ?? undefined,
      })),
      paidAt: data.bill.paidAt ?? new Date(),
    }
  }

  private renderReceiptText(input: ReceiptRenderInput): string {
    const lines: string[] = []
    lines.push('='.repeat(40))
    lines.push(`  ${input.businessName}`)
    if (input.businessAddress) lines.push(`  ${input.businessAddress}`)
    lines.push('='.repeat(40))
    lines.push(`Receipt: ${input.receiptNumber}`)
    if (input.kraPin) lines.push(`KRA PIN: ${input.kraPin}`)
    if (input.etrSerial) lines.push(`ETR: ${input.etrSerial}`)
    lines.push('-'.repeat(40))
    lines.push('')
    lines.push('---')
    lines.push(`Subtotal:    ${(input.subtotalAmount / 100).toFixed(2)} ${input.currency}`)
    if (input.discountAmount > 0) lines.push(`Discount:    -${(input.discountAmount / 100).toFixed(2)} ${input.currency}`)
    if (input.taxAmount > 0) lines.push(`Tax:         ${(input.taxAmount / 100).toFixed(2)} ${input.currency}`)
    if (input.serviceChargeAmount > 0) lines.push(`Service:     ${(input.serviceChargeAmount / 100).toFixed(2)} ${input.currency}`)
    if (input.tipAmount > 0) lines.push(`Tip:         ${(input.tipAmount / 100).toFixed(2)} ${input.currency}`)
    lines.push('---')
    lines.push(`TOTAL:       ${(input.totalAmount / 100).toFixed(2)} ${input.currency}`)
    lines.push('')
    lines.push('Payments:')
    for (const p of input.payments) {
      lines.push(`  ${p.method}: ${(p.amount / 100).toFixed(2)} ${input.currency}${p.reference ? ` (ref: ${p.reference})` : ''}`)
    }
    lines.push('')
    lines.push(`Paid at: ${new Date(input.paidAt).toLocaleString()}`)
    if (input.qrCodeData) lines.push(`QR: ${input.qrCodeData}`)
    lines.push('='.repeat(40))
    lines.push('  Thank you for your visit!')
    lines.push('='.repeat(40))
    return lines.join('\n')
  }
}
