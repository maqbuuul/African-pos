import { Inject, Injectable } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import type { Pool } from 'pg'

import {
  receipts as receiptsTable,
  withTenantContext,
} from '@hospitality-os/database'
import { getMessagingAdapter, getTaxAdapter } from '@hospitality-os/integrations'

import { APP_POOL } from '../core/tenant/tenant.constants.js'

const RECEIPT_QUEUE_NAME = 'receipt-delivery'

interface ReceiptDeliveryJob {
  organizationId: string
  locationId: string
  receiptId: string
  channels: string[]
  customerPhone?: string
  customerEmail?: string
  country: string
}

@Injectable()
export class ReceiptQueueService {
  private queue: Queue<ReceiptDeliveryJob>

  constructor(@Inject(APP_POOL) private readonly pool: Pool) {
    const connection = { host: process.env['REDIS_HOST'] ?? 'localhost', port: Number(process.env['REDIS_PORT'] ?? 6379) }
    this.queue = new Queue(RECEIPT_QUEUE_NAME, { connection })
  }

  async enqueue(job: ReceiptDeliveryJob) {
    await this.queue.add(
      `receipt-${job.receiptId}`,
      job,
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    )
  }
}

@Injectable()
export class ReceiptWorker {
  private worker: Worker<ReceiptDeliveryJob>

  constructor(@Inject(APP_POOL) private readonly pool: Pool) {
    const connection = { host: process.env['REDIS_HOST'] ?? 'localhost', port: Number(process.env['REDIS_PORT'] ?? 6379) }
    this.worker = new Worker(RECEIPT_QUEUE_NAME, async (job: Job<ReceiptDeliveryJob>) => {
      await this.processReceiptDelivery(job)
    }, { connection })
  }

  private async processReceiptDelivery(job: Job<ReceiptDeliveryJob>) {
    const { organizationId, receiptId, channels, customerPhone, customerEmail, country } = job.data

    return withTenantContext(this.pool, organizationId, async (db) => {
      const [receipt] = await db
        .select()
        .from(receiptsTable)
        .where(
          (() => {
            const { and, eq } = require('drizzle-orm')
            return and(eq(receiptsTable.id, receiptId), eq(receiptsTable.organizationId, organizationId))
          })(),
        )

      if (!receipt) {
        throw new Error(`Receipt ${receiptId} not found`)
      }

      const deliveryResults: Record<string, string> = {}
      let isDelivered = false

      for (const channel of channels) {
        try {
          const adapter = getMessagingAdapter(channel)

          const target =
            channel === 'email'
              ? (customerEmail ?? '')
              : channel === 'print'
                ? 'local_printer'
                : (customerPhone ?? '')

          if (!target) {
            deliveryResults[channel] = 'failed'
            continue
          }

          const result = await adapter.send({ to: target, body: 'Receipt from your business' }, {})
          deliveryResults[channel] = result.status

          if (result.status === 'sent' || result.status === 'delivered') {
            isDelivered = true
          }
        } catch {
          deliveryResults[channel] = 'failed'
        }
      }

      await db
        .update(receiptsTable)
        .set({
          deliveryStatus: deliveryResults as Record<string, unknown>,
          isDelivered,
          ...(isDelivered ? { deliveredAt: new Date() } : {}),
        })
        .where(
          (() => {
            const { and, eq } = require('drizzle-orm')
            return and(eq(receiptsTable.id, receiptId), eq(receiptsTable.organizationId, organizationId))
          })(),
        )

      // Submit to tax authority if Kenya
      if (country === 'KE') {
        try {
          const adapter = getTaxAdapter('kra_etims')
          await adapter.submitInvoice({
            organizationId,
            locationId: job.data.locationId,
            receiptId,
            receiptContent: receipt.content as Record<string, unknown>,
            taxRegistration: { kraPin: 'PENDING', etrSerial: 'ETR-SIM-001' },
          })
        } catch {
          // Tax submission failure is non-blocking for delivery; retried by offline sync (P11)
        }
      }
    })
  }
}
