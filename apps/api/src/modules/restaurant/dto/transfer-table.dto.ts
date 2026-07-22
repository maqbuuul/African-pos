import { IsUUID } from 'class-validator'

export class TransferTableDto {
  @IsUUID()
  toStaffId!: string
}
