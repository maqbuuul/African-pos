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

export class ManualAdapter implements PaymentAdapter {
  readonly provider = 'manual'

  async initiatePayment(
    _input: PaymentInitiateInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentInitiateResult> {
    // The cashier/manager already has confirmation from the physical terminal
    // or bank — they are recording it after the fact. Immediate confirm.
    return {
      requiresWebhook: false,
      message: 'Manual payment recorded',
    }
  }

  async verifyWebhook(
    _input: PaymentWebhookInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentWebhookResult> {
    throw new Error('Manual payments do not use webhooks')
  }

  async initiateRefund(
    _input: PaymentRefundInput,
    _credentials: ConnectionCredentials,
  ): Promise<PaymentRefundResult> {
    return {
      requiresManualSettlement: true,
      message:
        'Manual refund requires out-of-band reversal through the original terminal or bank',
    }
  }
}
