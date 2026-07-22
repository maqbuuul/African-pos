import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class TakeBankTransferPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsUUID()
  idempotencyKey!: string

  // Bank reference/narration from the transfer — required for reconciliation (PRD 07 Business Rules).
  @IsString()
  bankReference!: string

  @IsOptional()
  @IsString()
  bankName?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number

  @IsOptional()
  @IsUUID()
  tipStaffId?: string
}
