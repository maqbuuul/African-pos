import { IsNumber, Min } from 'class-validator'

export class RecordPourCostDto {
  @IsNumber()
  @Min(0)
  actualPouredMl!: number

  @IsNumber()
  @Min(0)
  theoreticalMl!: number
}
