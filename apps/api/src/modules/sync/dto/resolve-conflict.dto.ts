import { IsIn, IsString, IsUUID } from 'class-validator'
import { ConflictResolutionSchema, type ConflictResolution } from '@hospitality-os/domain'

export class ResolveConflictDto {
  @IsUUID()
  conflictId!: string

  @IsIn(ConflictResolutionSchema.options)
  resolution!: ConflictResolution

  @IsString()
  reason!: string
}
