import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator'

export class CreateCreditAccountDto {
  @IsUUID()
  customerId!: string

  @IsNumber()
  @Min(0)
  creditLimit!: number

  @IsOptional()
  @IsString()
  currency?: string
}
