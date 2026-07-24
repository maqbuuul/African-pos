import { IsIn, IsString, Length } from 'class-validator'

export class ScheduleReportDto {
  @IsString()
  @Length(1, 50)
  reportType!: string

  @IsIn(['daily', 'weekly', 'monthly'])
  cadence!: string
}
