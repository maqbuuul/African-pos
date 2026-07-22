import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator'
import { TableShapeSchema } from '@hospitality-os/domain'

export class CreateTableDto {
  @IsUUID()
  locationId!: string

  @IsUUID()
  floorPlanId!: string

  @IsString()
  @Length(1, 50)
  label!: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  section?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number

  @IsOptional()
  @IsIn(TableShapeSchema.options)
  shape?: string

  @IsOptional()
  @IsInt()
  positionX?: number

  @IsOptional()
  @IsInt()
  positionY?: number
}
