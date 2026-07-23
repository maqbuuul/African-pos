import { Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator'

export class PurchaseOrderItemDto {
  @IsUUID() inventoryItemId!: string
  @IsInt() orderedQuantity!: number
  @IsString() @MinLength(1) unit!: string
  @IsOptional() @IsInt() expectedUnitCost?: number
}

export class CreatePurchaseOrderDto {
  @IsUUID() supplierId!: string
  @IsString() @MinLength(1) orderNumber!: string
  @IsOptional() @IsString() expectedDeliveryDate?: string
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsInt() totalAmount?: number
  @IsOptional() @IsString() currency?: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemDto) items?: PurchaseOrderItemDto[]
}
