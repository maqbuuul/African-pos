import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator'

export class FireOrderDto {
  // Omit to fire every currently-draft item; include specific ids for a
  // partial fire (PRD 05 "hold" items — e.g. dessert held until mains are
  // cleared — fired explicitly later, a first-class action not a workaround).
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  itemIds?: string[]
}
