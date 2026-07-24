import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class EarnLoyaltyPointsDto {
  @IsInt()
  @Min(1)
  points!: number

  @IsOptional()
  @IsString()
  description?: string
}
