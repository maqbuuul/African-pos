import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator'
import type { SyncEntityType, SyncOperationType } from '@hospitality-os/domain'
import { SyncEntityTypeSchema, SyncOperationTypeSchema } from '@hospitality-os/domain'

class PushOperationItem {
  @IsString()
  opId!: string

  @IsUUID()
  organizationId!: string

  @IsUUID()
  locationId!: string

  @IsUUID()
  deviceId!: string

  @IsUUID()
  actorId!: string

  @IsIn(SyncEntityTypeSchema.options)
  entityType!: SyncEntityType

  @IsString()
  entityId!: string

  @IsIn(SyncOperationTypeSchema.options)
  operation!: SyncOperationType

  @IsObject()
  payload!: Record<string, unknown>

  @IsString()
  createdAt!: string

  @IsOptional()
  @Min(0)
  baseVersion?: number

  @IsOptional()
  @IsString()
  idempotencyKey?: string
}

export class PushOperationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  operations!: PushOperationItem[]
}
