import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator'
import { OrderChannelSchema } from '@hospitality-os/domain'

export class CreateOrderDto {
  @IsUUID()
  locationId!: string

  // Omitted for a counter sale (PRD 05: "the engine must not assume every
  // order has a table").
  @IsOptional()
  @IsUUID()
  tableId?: string

  @IsOptional()
  @IsUUID()
  customerId?: string

  @IsIn(OrderChannelSchema.options)
  channel!: string

  @IsString()
  @Length(3, 3)
  currency!: string
}
