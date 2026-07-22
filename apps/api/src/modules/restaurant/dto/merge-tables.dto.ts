import { IsUUID } from 'class-validator'

export class MergeTablesDto {
  @IsUUID()
  primaryTableId!: string

  @IsUUID()
  mergedTableId!: string
}
