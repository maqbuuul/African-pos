import { IsInt, IsString, Min } from 'class-validator'

export class RequestRefundDto {
  @IsInt()
  @Min(1)
  amount!: number

  // Reason is mandatory for every refund — immutable audit trail requirement (PRD 07).
  // Stored on the refunds row and in the audit_logs.reason so every refund is
  // reconstructable from the ledger without needing the actor's verbal explanation.
  @IsString()
  reason!: string
}
