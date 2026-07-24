import { IsInt, IsISO8601, IsOptional, IsString, Length, Min } from 'class-validator'

export class CreateGiftCardDto {
  @IsString()
  @Length(4, 32)
  code!: string

  @IsInt()
  @Min(1)
  initialBalance!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsOptional()
  @IsISO8601()
  expiresAt?: string
}
