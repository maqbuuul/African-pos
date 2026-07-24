import { IsInt, IsString, Length, Max, Min } from 'class-validator'

export class SetupChamaRoutingDto {
  @IsInt()
  @Min(1)
  @Max(100)
  percentage!: number

  @IsString()
  @Length(1, 100)
  linkedAccountRef!: string
}
