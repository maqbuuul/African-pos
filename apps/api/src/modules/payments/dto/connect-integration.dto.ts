import { IsIn, IsObject, IsOptional, IsUUID } from 'class-validator'
import { IntegrationCategorySchema } from '@hospitality-os/domain'

export class ConnectIntegrationDto {
  @IsIn(IntegrationCategorySchema.options)
  category!: string

  // Supported payment providers for this endpoint. Additional providers are
  // added here as integrations are built out (BUILD_WORKFLOW.md P7).
  @IsIn(['mpesa_daraja', 'paystack', 'airtel_money_api', 'flutterwave', 'pesapal', 'manual'])
  provider!: string

  // Raw credentials — encrypted with AES-256-GCM before storage (encrypt.ts).
  // Never logged, never returned in any API response after this call.
  @IsObject()
  credentials!: Record<string, string>

  // Non-sensitive metadata stored unencrypted for fraud detection / display.
  // For M-Pesa: { registeredNumbers: ['600000', '174379'] } — used by Module 18
  // fraud detection to validate incoming webhook paybill/till numbers.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  // null = org-wide connection; non-null = location-specific override.
  @IsOptional()
  @IsUUID()
  locationId?: string
}
