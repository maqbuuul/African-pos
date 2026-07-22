import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator'
import { TableShapeSchema } from '@hospitality-os/domain'

// Floor-plan-editor layout fields only (PRD 04 "Floor plan editor: drag-and-drop
// table placement, capacity, shape, section assignment"). Status and
// assignedStaffId are deliberately not editable here — they go through
// TablesController's dedicated status/transfer endpoints, which carry their
// own business rules (state machine, section ownership) that a plain PATCH
// would bypass.
export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  label?: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  section?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number

  @IsOptional()
  @IsIn(TableShapeSchema.options)
  shape?: string

  @IsOptional()
  @IsInt()
  positionX?: number

  @IsOptional()
  @IsInt()
  positionY?: number
}
