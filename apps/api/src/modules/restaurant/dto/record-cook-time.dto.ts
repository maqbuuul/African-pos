import { IsInt, IsUUID, Min } from 'class-validator'

export class RecordCookTimeDto {
  @IsUUID()
  orderItemId!: string

  @IsInt()
  @Min(1)
  actualPrepSeconds!: number
}
