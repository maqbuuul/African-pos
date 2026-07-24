import { IsOptional, IsString, Length } from 'class-validator'

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 200)
  name!: string

  @IsOptional()
  @IsString()
  legalName?: string

  @IsString()
  @Length(2, 2)
  country!: string

  @IsString()
  @Length(3, 3)
  defaultCurrency!: string

  @IsString()
  timezone!: string

  @IsOptional()
  @IsString()
  taxId?: string

  @IsOptional()
  @IsString()
  taxSerial?: string
}
