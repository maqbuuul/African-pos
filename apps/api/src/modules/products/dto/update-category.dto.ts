import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator'
import { EntityStatusSchema } from '@hospitality-os/domain'

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string

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

  @IsOptional()
  @IsIn(EntityStatusSchema.options)
  status?: string
}
