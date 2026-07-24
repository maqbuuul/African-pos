import { IsBoolean, IsInt, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateInventoryItemDto {
  @IsString() name!: string
  @IsOptional() @IsString() itemType?: string
  @IsOptional() @IsString() sku?: string
  @IsOptional() @IsString() barcode?: string
  @IsOptional() @IsString() photoUrl?: string
  @IsString() unit!: string
  @IsOptional() @IsString() category?: string
  @IsOptional() @IsUUID() preferredSupplierId?: string
  @IsOptional() @IsInt() reorderPoint?: number
  @IsOptional() @IsInt() reorderQuantity?: number
  @IsOptional() @IsInt() unitCost?: number
  @IsOptional() @IsString() currency?: string
  @IsOptional() @IsBoolean() trackStock?: boolean
}
