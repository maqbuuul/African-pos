import { Module } from '@nestjs/common'

export const notificationsModule = {
  name: 'notifications',
  phase: 'restaurant-operations',
  owns: ['notification_templates', 'notification_deliveries'],
} as const

@Module({})
export class NotificationsModule {}
