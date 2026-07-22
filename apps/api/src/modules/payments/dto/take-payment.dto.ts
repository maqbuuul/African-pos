import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'
import { PaymentMethodSchema } from '@hospitality-os/domain'

// Base DTO — not used directly by any endpoint. Each concrete payment method
// has its own DTO (take-cash-payment.dto.ts, take-mpesa-payment.dto.ts, etc.)
// that includes only the fields that method actually requires. This base class
// documents the shared shape and is kept for reference, not for @ValidatedBody use.
export class TakePaymentDto {
  @IsIn(PaymentMethodSchema.options)
  method!: string

  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  // Client-generated idempotency key — UUID format enforced so it's
  // guaranteed to be unique-enough without trusting client content.
  @IsUUID()
  idempotencyKey!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number

  @IsOptional()
  @IsUUID()
  tipStaffId?: string
}
