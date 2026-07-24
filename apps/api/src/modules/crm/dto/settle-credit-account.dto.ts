import { IsInt, Min } from 'class-validator'

export class SettleCreditAccountDto {
  @IsInt()
  @Min(1)
  amount!: number
}
