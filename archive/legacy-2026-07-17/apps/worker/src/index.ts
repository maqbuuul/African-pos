import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'
import pino from 'pino'

const log = pino({ level: process.env['LOG_LEVEL'] ?? 'info' })

const connection = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const QUEUES = [
  'whatsapp',
  'pdf',
  'morning-briefing',
  'sync-queue',
  'etims',
  'mpesa-reconcile',
  'win-back',
  'ml-dispatch',
]

for (const queueName of QUEUES) {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      log.info({ queue: queueName, jobId: job.id, name: job.name }, 'job received — handler not implemented yet')
    },
    { connection, concurrency: 5 },
  )

  worker.on('completed', (job) => {
    log.info({ queue: queueName, jobId: job.id }, 'job completed')
  })

  worker.on('failed', (job, err) => {
    log.error({ queue: queueName, jobId: job?.id, err: err.message }, 'job failed')
  })
}

log.info({ queues: QUEUES }, 'worker process started')
