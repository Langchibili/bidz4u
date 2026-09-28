import crypto from 'crypto';
import {
  IPaymentGateway,
  InitiatePaymentParams,
  InitiatePaymentResult,
  InitiatePayoutParams,
  InitiatePayoutResult,
  VerifyWebhookResult,
} from './IPaymentGateway';

const BASE = process.env.LENCO_BASE_URL || 'https://api.lenco.co/access/v2';

function authHeaders(): Record<string, string> {
  if (!process.env.LENCO_SECRET_KEY) throw new Error('LENCO_SECRET_KEY is not configured');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LENCO_SECRET_KEY}`,
  };
}

async function requestLenco(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<any> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as any;
  if (!response.ok || result?.status === false) {
    throw new Error(`Lenco request failed: ${result?.message || response.statusText}`);
  }
  return result;
}

export class LencoAdapter implements IPaymentGateway {
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const result = await requestLenco('/collections/mobile-money', 'POST', {
      amount: params.amount.toFixed(2),
      reference: params.reference,
      phone: params.phone,
      operator: params.operator || 'mtn',
      country: (params.country || 'zm').toLowerCase(),
      bearer: 'merchant',
    });
    const data = result.data || {};
    return {
      gatewayReference: data.id || data.lencoReference || params.reference,
      status: data.status || 'pending',
      raw: data,
    };
  }

  async initiatePayout(params: InitiatePayoutParams): Promise<InitiatePayoutResult> {
    const accountId = process.env.LENCO_ACCOUNT_ID;
    if (!accountId) throw new Error('LENCO_ACCOUNT_ID is not configured');

    const mobileMoney = params.method !== 'bank_account';
    const path = mobileMoney ? '/transfers/mobile-money' : '/transfers/bank-account';
    const body: Record<string, unknown> = {
      accountId,
      amount: params.amount.toFixed(2),
      reference: params.reference,
      narration: params.narration || `Withdrawal ${params.reference}`,
      country: (params.country || 'zm').toLowerCase(),
    };
    if (mobileMoney) {
      body.phone = params.phone;
      body.operator = params.operator || 'mtn';
    } else {
      body.accountNumber = params.accountNumber || '';
      body.bankId = params.bankId || '';
    }

    const result = await requestLenco(path, 'POST', body);
    const data = result.data || {};
    return {
      gatewayReference: data.id || data.lencoReference || params.reference,
      status: data.status === 'successful' ? 'completed' : 'processing',
      raw: data,
    };
  }

  async getCollectionStatus(reference: string): Promise<{ status: string; data: Record<string, unknown> }> {
    const result = await requestLenco(`/collections/status/${encodeURIComponent(reference)}`, 'GET');
    return { status: result.data?.status || 'pending', data: result.data || {} };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: string): VerifyWebhookResult {
    const signature = headers['x-lenco-signature'];
    if (!signature || !process.env.LENCO_SECRET_KEY) return { valid: false, event: '', data: {} };

    const webhookHashKey = crypto.createHash('sha256').update(process.env.LENCO_SECRET_KEY).digest('hex');
    const expected = crypto.createHmac('sha512', webhookHashKey).update(rawBody).digest('hex');
    if (expected !== signature) return { valid: false, event: '', data: {} };

    try {
      const parsed = JSON.parse(rawBody);
      return { valid: true, event: parsed.event || '', data: parsed.data || {} };
    } catch {
      return { valid: false, event: '', data: {} };
    }
  }

  isCollectionSuccess(event: string): boolean {
    return event === 'collection.successful' || event === 'collection.settled';
  }

  isCollectionFailed(event: string): boolean {
    return event === 'collection.failed';
  }

  isPayoutCompleted(event: string): boolean {
    return event === 'transfer.successful';
  }

  isPayoutFailed(event: string): boolean {
    return event === 'transfer.failed';
  }

  extractReference(data: Record<string, unknown>): string | null {
    return (data.reference as string) || (data.clientReference as string) || (data.transactionReference as string) || null;
  }
}

export default new LencoAdapter();