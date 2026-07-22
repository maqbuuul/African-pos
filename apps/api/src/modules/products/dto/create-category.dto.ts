import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'

export class CreateCategoryDto {
  @IsUUID()
  menuId!: string

  @IsUUID()
  locationId!: string

  @IsString()
  @Length(1, 200)
  name!: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  localName?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  defaultKdsStation?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
