import { IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class RecordWastageDto {
  @IsUUID() inventoryItemId!: string
  @IsUUID() stockLocationId!: string
  @IsInt() quantity!: number
  @IsString() @MinLength(1) unit!: string
  @IsString() @MinLength(1) reason!: string
  @IsOptional() @IsInt() costImpact?: number
  @IsOptional() @IsString() notes?: string
}
