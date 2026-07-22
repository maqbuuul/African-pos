import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator'

export class SendReceiptDto {
  @IsOptional()
  @IsString()
  customerPhone?: string

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: ('whatsapp' | 'sms' | 'email' | 'print')[]
}
