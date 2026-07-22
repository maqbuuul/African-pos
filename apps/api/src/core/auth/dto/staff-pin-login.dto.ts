import { IsOptional, IsString, IsUUID, Length } from 'class-validator'

export class StaffPinLoginDto {
  // The client (a provisioned POS device) always knows which business and
  // branch it belongs to, so the login request itself carries tenant scope —
  // see core/auth/auth.service.ts for why that's what lets this query run
  // under strict (non-relaxed) Row-Level Security, unlike owner email login.
  @IsUUID()
  organizationId!: string

  @IsUUID()
  locationId!: string

  @IsString()
  @Length(4, 8)
  pin!: string

  @IsUUID()
  @IsOptional()
  deviceId?: string
}
