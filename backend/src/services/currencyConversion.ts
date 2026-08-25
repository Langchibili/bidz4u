/**
 * Converts amounts between currencies using v6.exchangerate-api.com.
 * Caches per (base->target) pair in-memory for a short TTL to avoid hammering the API.
 *
 * IMPORTANT: on API failure with no usable cache, this THROWS rather than silently
 * assuming a 1:1 rate. A bad/missing EXCHANGE_RATE_API_KEY must never result in a
 * ZMW amount being treated as USD — that's a silent financial bug, not a degraded UX.
 */

const EXCHANGE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1hr
const cache = new Map<string, { rate: number; expiresAt: number }>();

export async function getConversionRate(fromCode: string, toCode: string): Promise<number> {
  if (fromCode === toCode) return 1;

  const cacheKey = `${fromCode}_${toCode}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;
   if (!EXCHANGE_API_KEY) {
    strapi?.log?.error(`[currencyConversion] EXCHANGE_RATE_API_KEY is not set — cannot convert ${fromCode}->${toCode}`);
    if (cached) return cached.rate; // stale-but-real rate is acceptable
    throw new Error(`Currency conversion unavailable: missing API key (${fromCode}->${toCode})`);
  }

  const url = `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/pair/${fromCode}/${toCode}`;

  let json: any;
  try {
    const res = await fetch(url);
    json = await res.json();
  } catch (fetchErr: any) {
    strapi?.log?.error(`[currencyConversion] Network error ${fromCode}->${toCode}: ${fetchErr.message}`);
    if (cached) return cached.rate;
    throw new Error(`Currency conversion unavailable: network error (${fromCode}->${toCode})`);
  }

  if (json.result !== 'success') {
    strapi?.log?.error(`[currencyConversion] Failed ${fromCode}->${toCode}: ${json['error-type'] || 'unknown error'}`);
    if (cached) return cached.rate; // stale-but-real rate is fine
    // No silent 1:1 fallback — a failed conversion must surface as an error,
    // not quietly mis-price a bid or payment as if ZMW/USD/etc. were at parity.
    throw new Error(`Currency conversion unavailable for ${fromCode}->${toCode}: ${json['error-type'] || 'unknown error'}`);
  }

  const rate = json.conversion_rate as number;
  cache.set(cacheKey, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
  return rate;
}

export async function convertAmount(amount: number, fromCode: string, toCode: string): Promise<number> {
  const rate = await getConversionRate(fromCode, toCode);
  return Math.round(amount * rate * 100) / 100;
}