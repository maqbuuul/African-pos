import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class TakeCashPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number // bill amount to settle

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsUUID()
  idempotencyKey!: string

  @IsInt()
  @Min(0)
  amountTendered!: number // cash handed over — must be >= amount; change = amountTendered - amount

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number

  @IsOptional()
  @IsUUID()
  tipStaffId?: string
}
