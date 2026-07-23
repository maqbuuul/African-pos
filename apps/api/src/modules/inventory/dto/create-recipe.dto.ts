import { Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator'

export class RecipeIngredientDto {
  @IsUUID() inventoryItemId!: string
  @IsInt() quantity!: number
  @IsString() @MinLength(1) unit!: string
  @IsOptional() @IsString() notes?: string
}

export class CreateRecipeDto {
  @IsUUID() productId!: string
  @IsOptional() @IsString() notes?: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => RecipeIngredientDto) ingredients?: RecipeIngredientDto[]
}
