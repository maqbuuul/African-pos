import { Module } from '@nestjs/common'

export const organizationModule = {
  name: 'organization',
  phase: 'foundation',
  owns: ['organizations', 'businesses', 'locations', 'devices'],
} as const

@Module({})
export class OrganizationModule {}
