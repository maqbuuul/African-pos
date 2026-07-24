import { IsString, Length } from 'class-validator'

export class AddCustomerTagDto {
  @IsString()
  @Length(1, 50)
  tag!: string
}
