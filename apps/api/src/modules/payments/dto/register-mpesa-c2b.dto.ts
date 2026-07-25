import { IsIn, IsOptional, IsUUID } from 'class-validator'

export class RegisterMpesaC2bDto {
  // null/omitted = org-wide connection, matching ConnectIntegrationDto's convention.
  @IsOptional()
  @IsUUID()
  locationId?: string

  @IsOptional()
  @IsIn(['Completed', 'Cancelled'])
  responseType?: 'Completed' | 'Cancelled'
}
