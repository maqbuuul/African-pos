import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class TakeCardTerminalPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsUUID()
  idempotencyKey!: string

  // Terminal receipt/slip reference number — required for reconciliation (PRD 07 Business Rules).
  @IsString()
  terminalReference!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  tipAmount?: number

  @IsOptional()
  @IsUUID()
  tipStaffId?: string
}
