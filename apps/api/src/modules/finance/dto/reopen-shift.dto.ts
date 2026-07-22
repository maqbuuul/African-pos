import { IsString } from 'class-validator'

export class ReopenShiftDto {
  @IsString()
  reason!: string
}
