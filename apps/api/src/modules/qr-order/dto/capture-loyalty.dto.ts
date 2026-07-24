import { IsPhoneNumber } from 'class-validator'

export class CaptureLoyaltyDto {
  @IsPhoneNumber()
  phone!: string
}
