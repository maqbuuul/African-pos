import { IsUUID } from 'class-validator'

export class MergeCustomersDto {
  @IsUUID()
  targetId!: string

  @IsUUID()
  sourceId!: string
}
