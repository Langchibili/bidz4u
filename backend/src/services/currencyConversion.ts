// backend/src/services/currencyConversion.ts

/**
 * Converts amounts between currencies using v6.exchangerate-api.com.
 * Caches per (base->target) pair in-memory for a short TTL to avoid hammering the API.
 */

const EXCHANGE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1hr
const cache = new Map<string, { rate: number; expiresAt: number }>();

export async function getConversionRate(fromCode: string, toCode: string): Promise<number> {
  if (fromCode === toCode) return 1;

  const cacheKey = `${fromCode}_${toCode}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  const url = `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/pair/${fromCode}/${toCode}`;
  const res = await fetch(url);
  const json: any = await res.json();

  if (json.result !== 'success') {
    strapi?.log?.error(`[currencyConversion] Failed ${fromCode}->${toCode}: ${json['error-type']}`);
    return cached?.rate ?? 1; // stale-if-error, else assume parity
  }

  const rate = json.conversion_rate as number;
  cache.set(cacheKey, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
  return rate;
}

export async function convertAmount(amount: number, fromCode: string, toCode: string): Promise<number> {
  const rate = await getConversionRate(fromCode, toCode);
  return Math.round(amount * rate * 100) / 100;
}
