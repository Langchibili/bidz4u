// backend/src/paymentGatewayAdapters/index.ts

import { IPaymentGateway } from './IPaymentGateway';
import pawapayAdapter from './pawapay';
import lencoAdapter from './lenco';

const adapters: Record<string, IPaymentGateway> = {
  pawapay: pawapayAdapter,
  lenco: lencoAdapter,
};

export function getPaymentGateway(gatewayName?: string | null): IPaymentGateway {
  const key = (gatewayName || 'pawapay').toLowerCase();
  const adapter = adapters[key];
  if (!adapter) {
    strapi?.log?.warn(`[PaymentGatewayFactory] Unknown gateway '${key}', falling back to pawapay`);
    return pawapayAdapter;
  }
  return adapter;
}
export type { IPaymentGateway };