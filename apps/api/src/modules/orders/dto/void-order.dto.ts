import { IsString, Length } from 'class-validator'

export class VoidOrderDto {
  @IsString()
  @Length(1, 500)
  reason!: string
}
