import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateNested } from 'class-validator'

class OrderItemInputDto {
  @IsUUID()
  productId!: string

  @IsInt()
  @Min(1)
  quantity!: number

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  modifierIds?: string[]

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  @Length(1, 50)
  sessionLabel?: string
}

export class SubmitOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[]
}
