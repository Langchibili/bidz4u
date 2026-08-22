// backend/src/paymentGatewayAdapters/pawapay.ts

import { IPaymentGateway, InitiatePaymentParams, InitiatePaymentResult, InitiatePayoutParams, InitiatePayoutResult, VerifyWebhookResult } from './IPaymentGateway';
import crypto from 'crypto';

const BASE = process.env.PAWAPAY_BASE_URL || 'https://api.pawapay.io';

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN || ''}` };
}

export class PawapayAdapter implements IPaymentGateway {
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const res = await fetch(`${BASE}/deposits`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        depositId: params.reference,
        amount: params.amount.toFixed(2),
        currency: params.currency,
        payer: { type: 'MSISDN', address: { value: params.phone } },
        statementDescription: params.narration || 'bidz4u deposit',
      }),
    });
    const json: any = await res.json();
    return { gatewayReference: json.depositId || params.reference, status: json.status || 'ACCEPTED', raw: json };
  }

  async initiatePayout(params: InitiatePayoutParams): Promise<InitiatePayoutResult> {
    const res = await fetch(`${BASE}/payouts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        payoutId: params.reference,
        amount: params.amount.toFixed(2),
        currency: params.currency,
        recipient: { type: 'MSISDN', address: { value: params.phone } },
        statementDescription: params.narration || 'bidz4u payout',
      }),
    });
    const json: any = await res.json();
    return {
      gatewayReference: json.payoutId || params.reference,
      status: json.status === 'COMPLETED' ? 'completed' : 'processing',
      raw: json,
    };
  }

  verifyWebhook(headersIn: Record<string, string>, rawBody: string): VerifyWebhookResult {
    const signature = headersIn['x-pawapay-signature'];
    const expected = crypto.createHmac('sha256', process.env.PAWAPAY_WEBHOOK_SECRET || '').update(rawBody).digest('hex');
    if (!signature || signature !== expected) return { valid: false, event: '', data: {} };
    const parsed = JSON.parse(rawBody);
    return { valid: true, event: parsed.status || '', data: parsed };
  }

  isCollectionSuccess(event: string) { return event === 'COMPLETED'; }
  isCollectionFailed(event: string) { return event === 'FAILED' || event === 'REJECTED'; }
  isPayoutCompleted(event: string) { return event === 'COMPLETED'; }
  isPayoutFailed(event: string) { return event === 'FAILED' || event === 'REJECTED'; }
  extractReference(data: Record<string, unknown>) {
    return (data.depositId as string) || (data.payoutId as string) || null;
  }
}

export default new PawapayAdapter();