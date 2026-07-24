import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator'

export class CloseShiftDto {
  @IsInt()
  @Min(0)
  countedAmount!: number

  @IsOptional()
  @IsObject()
  denominationCount?: Record<string, number>

  @IsOptional()
  @IsString()
  varianceReason?: string

  @IsOptional()
  @IsBoolean()
  force?: boolean
}
