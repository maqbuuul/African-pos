import type {
  ConnectionCredentials,
  PaymentAdapter,
  PaymentInitiateInput,
  PaymentInitiateResult,
  PaymentRefundInput,
  PaymentRefundResult,
  PaymentWebhookInput,
  PaymentWebhookResult,
} from '../payment-adapter.interface.js'

export class CashAdapter implements PaymentAdapter {
  readonly provider = 'none'

  async initiatePayment(
    _input: PaymentInitiateInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    return {
      requiresWebhook: false,
      message: 'Cash payment recorded',
    }
  }

  async verifyWebhook(
    _input: PaymentWebhookInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    // Cash never goes through a webhook — this should never be called.
    throw new Error('Cash payments do not use webhooks')
  }

  async initiateRefund(
    _input: PaymentRefundInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    // Cash refund = cash-out event at shift close (PRD 08). Record intent
    // here, handled at drawer reconciliation. No external provider to call.
    return {
      requiresManualSettlement: true,
      message: 'Cash refund recorded — disburse physical cash and reconcile at shift close',
    }
  }
}
