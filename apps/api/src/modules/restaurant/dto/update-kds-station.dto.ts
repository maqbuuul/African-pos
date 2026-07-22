import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

const STATION_STATUSES = ['active', 'suspended', 'inactive'] as const

export class UpdateKdsStationDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  code?: string

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string

  @IsOptional()
  @IsString()
  @Length(1, 300)
  description?: string

  @IsOptional()
  @IsUUID()
  assignedStaffId?: string

  @IsOptional()
  @IsBoolean()
  isExpo?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedPrepTimeSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  recallGraceSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsString()
  @IsIn(STATION_STATUSES)
  status?: (typeof STATION_STATUSES)[number]
}
