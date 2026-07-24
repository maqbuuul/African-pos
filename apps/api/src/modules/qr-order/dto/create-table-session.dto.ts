import { IsString, Length } from 'class-validator'

export class CreateTableSessionDto {
  @IsString()
  @Length(1, 100)
  qrSlug!: string
}
