import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator'

export class CreateModifierDto {
  @IsString()
  @Length(1, 200)
  name!: string

  // Minor-currency-unit delta applied to the product's base price when this
  // option is chosen (can be negative, e.g. a "no rice" discount) — see
  // MoneySchema (@hospitality-os/domain): money is always an integer.
  @IsInt()
  priceDelta!: number

  @IsString()
  @Length(3, 3)
  currency!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class CreateModifierGroupDto {
  @IsUUID()
  locationId!: string

  @IsString()
  @Length(1, 200)
  name!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSelect?: number

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateModifierDto)
  modifiers!: CreateModifierDto[]
}
