import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator'
import { ModifierStatusSchema } from '@hospitality-os/domain'

export class UpdateModifierGroupDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSelect?: number

  @IsOptional()
  @IsIn(ModifierStatusSchema.options)
  status?: string
}
