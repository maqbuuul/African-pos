import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator'

export class CreateMenuDto {
  @IsUUID()
  locationId!: string

  @IsString()
  @Length(1, 200)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
