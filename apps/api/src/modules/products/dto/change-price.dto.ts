import { IsInt, IsOptional, IsString, Length } from 'class-validator'

export class ChangePriceDto {
  @IsInt()
  priceAmount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsOptional()
  @IsString()
  reason?: string
}
