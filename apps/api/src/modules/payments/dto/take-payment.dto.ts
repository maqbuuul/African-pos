import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator'

// Generic "take an online/hosted payment" DTO — used by
// POST /bills/:billId/payments/:provider for every provider that goes
// through the PaymentAdapter interface (mpesa_daraja, paystack,
// airtel_money_api, flutterwave, pesapal). `method` and provider-specific
// requirements (e.g. Kenyan phone format) are no longer enforced at the DTO
// level — they're derived from `provider` and enforced by that provider's
// adapter at call time (see e.g. mpesa.adapter.ts's formatPhone, which
// throws a clear error on a malformed number). Cash, card-terminal, and
// bank-transfer are NOT adapter-based (no external round-trip, no webhook)
// and keep their own dedicated DTOs — see take-cash-payment.dto.ts etc.
export class TakePaymentDto {
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

  // Required for phone-push providers (mpesa_daraja, airtel_money_api),
  // optional for card/checkout-first providers — the service layer, not
  // this DTO, knows which providers need it.
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'customerPhone must be a valid phone number' })
  customerPhone?: string

  // Used for Paystack/Flutterwave/PesaPal receipts when the provider
  // requires an email on every transaction.
  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number

  @IsOptional()
  @IsUUID()
  tipStaffId?: string
}
