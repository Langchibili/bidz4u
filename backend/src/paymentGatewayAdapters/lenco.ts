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
    if (params.paymentType === 'card') return this.initiateCardPayment(params);

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

  private async encryptCardPayload(payload: Record<string, unknown>): Promise<string> {
    const keyResponse = await requestLenco('/encryption-key', 'GET');
    const jwk = keyResponse.data?.publicKey;
    if (!jwk) throw new Error('Lenco did not return a card encryption key');

    const protectedHeader = Buffer.from(JSON.stringify({
      alg: 'RSA-OAEP-256',
      enc: 'A256GCM',
      cty: 'application/json',
      kid: jwk.kid,
    })).toString('base64url');
    const contentKey = crypto.randomBytes(32);
    const encryptedKey = crypto.publicEncrypt({
      key: crypto.createPublicKey({ key: jwk, format: 'jwk' }),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, contentKey);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', contentKey, iv);
    cipher.setAAD(Buffer.from(protectedHeader));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);

    return [
      protectedHeader,
      encryptedKey.toString('base64url'),
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  private async initiateCardPayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (!params.card || !params.customer) {
      throw new Error('Card details and cardholder name are required');
    }
    const encryptedPayload = await this.encryptCardPayload({
      reference: params.reference,
      email: params.email,
      amount: params.amount.toFixed(2),
      currency: params.currency || 'ZMW',
      bearer: 'merchant',
      customer: {
        firstName: params.customer.firstName,
        lastName: params.customer.lastName,
      },
      billing: {
        streetAddress: params.billing?.streetAddress || '',
        city: params.billing?.city || '',
        state: params.billing?.state || '',
        postalCode: params.billing?.postalCode || '',
        country: params.billing?.country || (params.country || 'zm').toUpperCase(),
      },
      card: {
        number: params.card.number.replace(/\s/g, ''),
        expiryMonth: params.card.expiryMonth,
        expiryYear: params.card.expiryYear,
        cvv: params.card.cvv,
      },
      ...(params.redirectUrl ? { redirectUrl: params.redirectUrl } : {}),
    });
    const result = await requestLenco('/collections/card', 'POST', { encryptedPayload });
    const data = result.data || {};
    const redirectUrl = data.status === '3ds-auth-required'
      ? data.meta?.authorization?.redirect || ''
      : '';

    return {
      gatewayReference: data.id || data.lencoReference || params.reference,
      status: data.status || 'pending',
      redirectUrl,
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