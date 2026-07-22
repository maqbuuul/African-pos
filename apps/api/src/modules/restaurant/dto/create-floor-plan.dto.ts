import { IsString, IsUUID, Length } from 'class-validator'

export class CreateFloorPlanDto {
  @IsUUID()
  locationId!: string

  @IsString()
  @Length(1, 200)
  name!: string
}
