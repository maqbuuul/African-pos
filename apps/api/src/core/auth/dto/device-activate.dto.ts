import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator'

export class DeviceActivateDto {
  @IsUUID()
  locationId!: string

  @IsString()
  @Length(1, 200)
  name!: string

  // Text, not an enum, mirrors the `devices.device_type` column itself
  // (packages/database/src/schema/shared/index.ts) — new device classes
  // showing up shouldn't require a migration.
  @IsString()
  @Length(1, 50)
  deviceType!: string

  @IsOptional()
  @IsIn(['android', 'ios', 'web', 'windows', 'linux'])
  platform?: string
}
