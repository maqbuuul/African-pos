import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { ValidationPipe } from '@nestjs/common'

import { AppModule } from './app.module.js'
import { ApprovalRequiredFilter } from './core/errors/approval-required.filter.js'

const start = async () => {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.use(helmet())
  app.enableCors()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalFilters(new ApprovalRequiredFilter())

  const port = Number(process.env['API_PORT'] ?? 3000)
  await app.listen(port, '0.0.0.0')
}

await start().catch((error) => {
  console.error(error)
  process.exit(1)
})
