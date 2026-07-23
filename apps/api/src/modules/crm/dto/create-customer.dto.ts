import { IsEmail, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator'

export class CreateCustomerDto {
  @IsOptional()
  @IsPhoneNumber()
  phone?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  allergyNotes?: string
}
