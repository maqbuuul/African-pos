import { IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class CreateStockAdjustmentDto {
  @IsUUID() inventoryItemId!: string
  @IsUUID() stockLocationId!: string
  @IsNumber() newQuantity!: number
  @IsString() @MinLength(1) reason!: string
  @IsOptional() @IsString() notes?: string
}
