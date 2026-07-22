import { IsIn, IsOptional, IsString, Length } from 'class-validator'
import { EntityStatusSchema } from '@hospitality-os/domain'

export class UpdateFloorPlanDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string

  @IsOptional()
  @IsIn(EntityStatusSchema.options)
  status?: string
}
