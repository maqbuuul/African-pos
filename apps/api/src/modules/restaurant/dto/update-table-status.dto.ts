import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { TableStatusSchema } from '@hospitality-os/domain'

export class UpdateTableStatusDto {
  @IsIn(TableStatusSchema.options)
  status!: string

  // Required when transitioning into `seated` (PRD 04 "Seating a party" —
  // validated against capacity as a soft warning, not a hard block).
  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number

  // Required for the `bill_requested`/`payment_pending` -> `eating` reopen
  // transition (PRD 04 edge case: allowed, but must be manager-visible).
  @IsOptional()
  @IsString()
  reason?: string
}
