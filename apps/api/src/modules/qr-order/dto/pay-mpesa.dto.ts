import { IsPhoneNumber, IsString, IsUUID, Length } from 'class-validator'

export class PayMpesaDto {
  @IsUUID()
  orderId!: string

  @IsPhoneNumber()
  phone!: string

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string
}
