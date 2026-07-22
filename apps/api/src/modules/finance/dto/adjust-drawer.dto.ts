import { IsIn, IsInt, IsString, Length, Min } from 'class-validator'

export class AdjustDrawerDto {
  @IsIn(['in', 'out'])
  direction!: 'in' | 'out'

  @IsInt()
  @Min(1)
  amount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsString()
  reason!: string
}
