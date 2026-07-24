import { IsUUID } from 'class-validator'

export class QueueEtimsDto {
  @IsUUID()
  receiptId!: string

  @IsUUID()
  billId!: string
}
