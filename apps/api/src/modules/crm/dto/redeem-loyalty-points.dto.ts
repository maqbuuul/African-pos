import { IsInt, Min } from 'class-validator'

export class RedeemLoyaltyPointsDto {
  @IsInt()
  @Min(1)
  points!: number
}
