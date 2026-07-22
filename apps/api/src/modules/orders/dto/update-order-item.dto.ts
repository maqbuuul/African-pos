import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

// Only 'voided'/'comped' — every other item-status transition is driven by a
// dedicated action (POST /orders/:id/send fires draft->sent; P6/KDS will own
// accepted/in_progress/ready/served), not this generic patch.
const TARGET_STATUSES = ['voided', 'comped'] as const

export class UpdateOrderItemDto {
  // Field edits — only legal while the item is still draft (OrdersService
  // enforces this; PRD 05 "modify" scope).
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number

  @IsOptional()
  @IsString()
  course?: string

  @IsOptional()
  @IsString()
  kitchenNote?: string

  // Void/comp path — mutually exclusive with the field edits above.
  @IsOptional()
  @IsIn(TARGET_STATUSES)
  status?: string

  @IsOptional()
  @IsString()
  reason?: string
}
