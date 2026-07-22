import { Controller, Get, Module } from '@nestjs/common'

@Controller('health')
class HealthController {
  @Get()
  check() {
    return {
      data: { status: 'ok', service: 'api' },
      meta: { timestamp: new Date().toISOString() },
    }
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
