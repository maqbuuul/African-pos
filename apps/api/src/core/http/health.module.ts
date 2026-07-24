import { Controller, Get, Module } from '@nestjs/common'

import { SkipEnvelope } from '../response-envelope/skip-envelope.decorator.js'

@Controller('health')
@SkipEnvelope()
class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() }
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
