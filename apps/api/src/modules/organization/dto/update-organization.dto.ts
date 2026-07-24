import { IsOptional, IsString, Length } from 'class-validator'

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string

  @IsOptional()
  @IsString()
  legalName?: string

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string

  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrency?: string

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsString()
  taxId?: string

  @IsOptional()
  @IsString()
  taxSerial?: string

  @IsOptional()
  @IsString()
  status?: string
}
