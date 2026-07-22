import { IsInt, IsString, IsUUID, Length, Matches, Min } from 'class-validator'

export class TakeMpesaPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsUUID()
  idempotencyKey!: string

  // Kenyan mobile number: 07XXXXXXXX or +2547XXXXXXXX or 2547XXXXXXXX.
  // M-Pesa STK push is sent to this number — the customer completes on their handset.
  @IsString()
  @Matches(/^(\+?254|0)7\d{8}$/, { message: 'customerPhone must be a valid Kenyan M-Pesa number' })
  customerPhone!: string
}
