import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class CreateKdsStationDto {
  @IsUUID()
  locationId!: string

  @IsString()
  @Length(1, 100)
  code!: string

  @IsString()
  @Length(1, 120)
  name!: string

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
}
