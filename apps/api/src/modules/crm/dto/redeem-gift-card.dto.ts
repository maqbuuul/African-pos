import { IsInt, Min } from 'class-validator'

export class RedeemGiftCardDto {
  @IsInt()
  @Min(1)
  amount!: number
}
