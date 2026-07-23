import { IsString, MinLength } from 'class-validator'

export class CreateTableSessionDto {
  @IsString()
  @MinLength(1)
  qrSlug!: string
}
