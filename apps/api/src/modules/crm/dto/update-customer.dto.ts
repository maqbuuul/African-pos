import { IsEmail, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator'

export class UpdateCustomerDto {
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

  @IsOptional()
  @IsPhoneNumber()
  phone?: string

  @IsOptional()
  @IsEmail()
  email?: string
}
