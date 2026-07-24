import { IsBoolean, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator'

export class UpdateDeviceStatusDto {
  @IsString()
  deviceId!: string

  // No fixed enum exists in the schema (sync_cursors.sync_status is a plain
  // text column, default 'pending') — devices self-report this value, so we
  // only bound its shape, not guess a canonical value list.
  @IsString()
  @Length(1, 50)
  status!: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel?: number

  @IsOptional()
  @IsBoolean()
  onBattery?: boolean
}
