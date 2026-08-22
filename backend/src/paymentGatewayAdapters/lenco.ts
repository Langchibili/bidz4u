// backend/src/paymentGatewayAdapters/lenco.ts

// Same structural shape as the reference LencoPayAdapter (mobile-money collection/transfer
// endpoints, JWE-encrypted card collection, HMAC-SHA512 webhook verification).
// See project reference implementation — port verbatim, only IPaymentGateway import path changes.
import { IPaymentGateway, InitiatePaymentParams, InitiatePaymentResult, InitiatePayoutParams, InitiatePayoutResult, VerifyWebhookResult } from './IPaymentGateway';

export class LencoAdapter implements IPaymentGateway {
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> { /* port from reference */ throw new Error('implement'); }
  async initiatePayout(params: InitiatePayoutParams): Promise<InitiatePayoutResult> { /* port from reference */ throw new Error('implement'); }
  verifyWebhook(headers: Record<string, string>, rawBody: string): VerifyWebhookResult { throw new Error('implement'); }
  isCollectionSuccess(event: string) { return event === 'collection.successful' || event === 'collection.settled'; }
  isCollectionFailed(event: string) { return event === 'collection.failed'; }
  isPayoutCompleted(event: string) { return event === 'transfer.successful'; }
  isPayoutFailed(event: string) { return event === 'transfer.failed'; }
  extractReference(data: Record<string, unknown>) { return (data.reference as string) || null; }
}
export default new LencoAdapter();