import { IsInt, Min } from 'class-validator'

export class ChargeCreditAccountDto {
  @IsInt()
  @Min(1)
  amount!: number
}
