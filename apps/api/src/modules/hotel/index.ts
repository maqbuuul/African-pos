import { Module } from '@nestjs/common'

export const hotelModule = {
  name: 'hotel',
  phase: 'later-vertical',
  owns: ['rooms', 'room_types', 'hotel_reservations', 'folios', 'housekeeping_tasks'],
} as const

@Module({})
export class HotelModule {}
