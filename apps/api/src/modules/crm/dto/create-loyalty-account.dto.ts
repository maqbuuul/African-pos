import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator'

export class CreateLoyaltyAccountDto {
  @IsUUID()
  customerId!: string

  @IsOptional()
  @IsString()
  tier?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number
}
