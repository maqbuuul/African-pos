import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class OpenShiftDto {
  @IsUUID()
  locationId!: string

  @IsOptional()
  @IsUUID()
  deviceId?: string

  @IsInt()
  @Min(0)
  startingCashAmount!: number

  @IsString()
  @Length(3, 3)
  currency!: string
}
