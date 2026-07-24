import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator'

export class SubmitFeedbackDto {
  @IsUUID()
  orderItemId!: string

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  comment?: string
}
