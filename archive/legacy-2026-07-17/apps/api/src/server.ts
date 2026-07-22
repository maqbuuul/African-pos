import Fastify from 'fastify'

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport:
      process.env['NODE_ENV'] === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  genReqId: () => crypto.randomUUID(),
})

server.get('/health', async () => {
  return {
    data: { status: 'ok' },
    meta: { timestamp: new Date().toISOString() },
  }
})

const start = async () => {
  try {
    const port = Number(process.env['PORT'] ?? 3000)
    await server.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
