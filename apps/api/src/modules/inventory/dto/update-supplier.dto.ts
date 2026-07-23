import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator'

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() contactPerson?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() paymentTerms?: string
  @IsOptional() @IsInt() creditLimit?: number
  @IsOptional() @IsString() currency?: string
}
