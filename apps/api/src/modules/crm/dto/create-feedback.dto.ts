import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class CreateFeedbackDto {
  @IsUUID()
  locationId!: string

  @IsOptional()
  @IsUUID()
  customerId?: string

  @IsOptional()
  @IsUUID()
  orderId?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number

  @IsOptional()
  @IsString()
  comment?: string

  @IsOptional()
  @IsString()
  source?: string
}
