import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  channelPreferences?: Record<string, string>

  @IsOptional()
  @IsString()
  quietHoursStart?: string

  @IsOptional()
  @IsString()
  quietHoursEnd?: string

  @IsOptional()
  @IsBoolean()
  optedOut?: boolean
}
