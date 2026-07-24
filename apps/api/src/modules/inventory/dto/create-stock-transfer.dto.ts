import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator'

export class StockTransferItemDto {
  @IsUUID() inventoryItemId!: string
  @IsNumber() quantity!: number
  @IsString() @MinLength(1) unit!: string
}

export class CreateStockTransferDto {
  @IsUUID() sourceLocationId!: string
  @IsUUID() destLocationId!: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => StockTransferItemDto) items!: StockTransferItemDto[]
}
