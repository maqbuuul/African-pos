import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator'

export class AddOrderItemDto {
  @IsUUID()
  productId!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  modifierIds?: string[]

  @IsOptional()
  @IsInt()
  @Min(1)
  seatNumber?: number

  @IsOptional()
  @IsString()
  course?: string

  @IsOptional()
  @IsString()
  kitchenNote?: string

  // Required once the order already has an active bill (PRD 05 edge case: an
  // item added after the bill has been split must be explicitly assigned to
  // one of the existing bills, never silently defaulted onto "bill 1").
  @IsOptional()
  @IsUUID()
  billId?: string
}
