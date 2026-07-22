import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Length, Min } from 'class-validator'
import { ProductStatusSchema } from '@hospitality-os/domain'

// Deliberately excludes price/currency — changing price is
// ProductsService.changePrice (POST /products/:id/price), which must open a
// new productPrices row rather than a plain column update (PRD 03: prices
// are never overwritten in place).
export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string

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

  // When present, replaces the product's full modifier-group attachment set
  // (order in the array becomes sortOrder) — not a partial add/remove.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  modifierGroupIds?: string[]
}
