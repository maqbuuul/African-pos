import { IsUUID } from 'class-validator'

export class MatchMpesaC2bDto {
  @IsUUID()
  billId!: string
}
