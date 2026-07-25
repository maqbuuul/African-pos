import { Module } from '@nestjs/common'

export const retailModule = {
  name: 'retail',
  phase: 'later-vertical',
  owns: ['retail_sales', 'returns', 'variants', 'barcodes'],
} as const

@Module({})
export class RetailModule {}
