import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class TakeCardPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsUUID()
  idempotencyKey!: string

  // Customer email for Paystack receipt — required for the Paystack card flow.
  @IsEmail()
  customerEmail!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number

  @IsOptional()
  @IsUUID()
  tipStaffId?: string
}
