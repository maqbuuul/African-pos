import { IsBoolean, IsOptional, IsString, Length } from 'class-validator'

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}
