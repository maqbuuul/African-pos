import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator'
import { BillSplitMethodSchema } from '@hospitality-os/domain'

class SplitAssignmentDto {
  @IsUUID()
  orderItemId!: string

  // 1-indexed target bill within this split.
  @IsInt()
  @Min(1)
  billNumber!: number
}

export class SplitOrderDto {
  @IsIn(BillSplitMethodSchema.options)
  method!: string

  // Required for method='by_item' — every non-voided order item must appear
  // exactly once (OrdersService validates completeness).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitAssignmentDto)
  assignments?: SplitAssignmentDto[]

  // Required for method='evenly' — how many equal bills to generate.
  @IsOptional()
  @IsInt()
  @Min(2)
  evenCount?: number
}
