// backend/src/paymentGatewayAdapters/IPaymentGateway.ts

export interface InitiatePaymentParams {
  reference: string;
  amount: number;
  currency: string;
  phone: string;
  narration?: string;
  metadata?: Record<string, unknown>;
}
export interface InitiatePaymentResult {
  gatewayReference: string;
  status: string;
  raw: unknown;
}
export interface InitiatePayoutParams {
  reference: string;
  amount: number;
  currency: string;
  phone: string;
  narration?: string;
}
export interface InitiatePayoutResult {
  gatewayReference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  raw: unknown;
}
export interface VerifyWebhookResult {
  valid: boolean;
  event: string;
  data: Record<string, unknown>;
}
export interface IPaymentGateway {
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  initiatePayout(params: InitiatePayoutParams): Promise<InitiatePayoutResult>;
  verifyWebhook(headers: Record<string, string>, rawBody: string): VerifyWebhookResult;
  isCollectionSuccess(event: string, data: Record<string, unknown>): boolean;
  isCollectionFailed(event: string, data: Record<string, unknown>): boolean;
  isPayoutCompleted(event: string, data: Record<string, unknown>): boolean;
  isPayoutFailed(event: string, data: Record<string, unknown>): boolean;
  extractReference(data: Record<string, unknown>): string | null;
}
