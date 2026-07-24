import { IsInt, IsString, IsUUID, Length, Min } from 'class-validator'

export class ChargeBarTabDto {
  @IsUUID()
  orderId!: string

  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string
}
