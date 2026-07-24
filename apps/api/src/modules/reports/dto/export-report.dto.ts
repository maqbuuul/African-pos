import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator'

export class ExportReportDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number

  @IsOptional()
  @IsISO8601()
  startDate?: string

  @IsOptional()
  @IsISO8601()
  endDate?: string
}
