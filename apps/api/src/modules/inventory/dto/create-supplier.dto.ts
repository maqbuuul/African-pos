import { IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateSupplierDto {
  @IsString() @MinLength(1) name!: string
  @IsOptional() @IsString() contactPerson?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() paymentTerms?: string
  @IsOptional() @IsInt() creditLimit?: number
  @IsOptional() @IsString() currency?: string
}
