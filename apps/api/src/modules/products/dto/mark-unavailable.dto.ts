import { IsDateString, IsOptional, IsString } from 'class-validator'

export class MarkUnavailableDto {
  // Optional auto-restore time (PRD 03: "back tomorrow"). Omit for
  // manual-restore only.
  @IsOptional()
  @IsDateString()
  autoRestoreAt?: string

  @IsOptional()
  @IsString()
  reason?: string
}
