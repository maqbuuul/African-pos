import { IsString, IsUUID, Length } from 'class-validator'

export class FireCourseDto {
  @IsUUID()
  orderId!: string

  @IsString()
  @Length(1, 100)
  courseName!: string
}
