// Tax compliance adapter interface — pluggable per country.
// Same ChannelAdapter-style pattern as BUILD_WORKFLOW.md section 6.
// Each country's tax authority implements this interface.

export interface TaxSubmitInput {
  organizationId: string
  locationId: string
  receiptId: string
  // The rendered receipt content (JSON snapshot of items, totals, tax info)
  receiptContent: Record<string, unknown>
  // Business's tax registration info (KRA PIN, ETR serial, etc.)
  taxRegistration: Record<string, unknown>
}

export interface TaxSubmitResult {
  providerReference?: string
  status: 'confirmed' | 'failed'
  responsePayload?: Record<string, unknown>
  errorMessage?: string
}

export interface TaxHealthResult {
  healthy: boolean
  message?: string
}

export interface TaxAdapter {
  readonly provider: string

  submitInvoice(input: TaxSubmitInput): Promise<TaxSubmitResult>

  healthCheck(): Promise<TaxHealthResult>
}
