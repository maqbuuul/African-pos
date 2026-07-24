import { IsNumber, IsUUID } from 'class-validator'

export class SellByWeightDto {
  @IsUUID() itemId!: string
  @IsNumber() weightGrams!: number
  @IsNumber() pricePerKg!: number
}
