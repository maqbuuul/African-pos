import { Module } from '@nestjs/common'

export const staffModule = {
  name: 'staff',
  phase: 'foundation',
  owns: ['staff', 'roles', 'permissions', 'staff_sessions', 'attendance'],
} as const

@Module({})
export class StaffModule {}
