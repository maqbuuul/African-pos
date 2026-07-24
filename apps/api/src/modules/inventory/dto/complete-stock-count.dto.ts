import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsUUID, ValidateNested } from 'class-validator'

export class StockCountItemDto {
  @IsUUID() inventoryItemId!: string
  @IsNumber() countedQuantity!: number
}

export class CompleteStockCountDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => StockCountItemDto) items!: StockCountItemDto[]
  @IsOptional() @IsNumber() threshold?: number
}
