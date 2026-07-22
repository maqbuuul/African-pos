import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator'

export class ApplyDiscountDto {
  // Omit for a bill/order-level discount; include to target one item.
  @IsOptional()
  @IsUUID()
  orderItemId?: string

  @IsIn(['percentage', 'fixed'])
  discountType!: string

  // Percentage: 0-100. Fixed: a money amount in the order's own currency
  // (same whole-currency-unit convention as products.priceAmount).
  @IsInt()
  @Min(1)
  discountValue!: number

  @IsOptional()
  @IsString()
  reason?: string
}
