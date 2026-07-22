import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Length, Min } from 'class-validator'
import { ProductStatusSchema } from '@hospitality-os/domain'

export class CreateProductDto {
  @IsUUID()
  locationId!: string

  @IsUUID()
  categoryId!: string

  @IsString()
  @Length(1, 200)
  name!: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  localName?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string

  @IsOptional()
  @IsUrl()
  photoUrl?: string

  // Initial price — becomes the first productPrices row (ProductsService
  // opens price history atomically with product creation, never leaves a
  // product without an active price row).
  @IsInt()
  priceAmount!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsOptional()
  @IsUUID()
  taxCategoryId?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  kdsStationOverride?: string

  @IsOptional()
  @IsIn(ProductStatusSchema.options)
  status?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  modifierGroupIds?: string[]
}
