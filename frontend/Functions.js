/**
 * bidz4u.com - Shared pure helper functions
 */

/** Strips non-digits and truncates to the country's expected digit length */
export function getPhoneDigits(phoneNumber, phoneNumberDigitLenth = 9) {
  if (!phoneNumber) return '';
  const digits = String(phoneNumber).replace(/\D/g, '');
  // Drop a single leading zero, as per the normalization rule
  const noLeadingZero = digits.replace(/^0+/, '');
  return noLeadingZero.slice(-phoneNumberDigitLenth);
}

export function validatePhoneNumber(rawDigits, phoneNumberDigitLenth = 9) {
  const digits = getPhoneDigits(rawDigits, phoneNumberDigitLenth);
  return digits.length === phoneNumberDigitLenth;
}

/** Builds the unified <savedPhoneCode><digits> identifier used as the username */
export function buildFullPhone(phoneCode, digits, phoneNumberDigitLenth = 9) {
  const code = String(phoneCode).replace(/\D/g, '');
  const clean = getPhoneDigits(digits, phoneNumberDigitLenth);
  return `${code}${clean}`;
}

export function formatCurrency(amount, symbol = 'ZK') {
  const n = Number(amount || 0);
  return `${symbol} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getCurrencySymbol(currencyCode) {
  if (!currencyCode) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value || currencyCode;
  } catch {
    return currencyCode;
  }
}

export function isDraftListing(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

/** mm:ss or hh:mm:ss countdown string from milliseconds remaining */
export function formatCountdown(msRemaining) {
  if (msRemaining <= 0) return '00:00';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Strapi serves uploaded media from the API root, not under /api — this
 *  strips a trailing /api from NEXT_PUBLIC_API_URL and prefixes relative
 *  media URLs Strapi returns (e.g. "/uploads/foo.jpg"). Absolute URLs (S3,
 *  CDN) are returned unchanged. */
export function getMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1343/api';
  const root = apiUrl.replace(/\/api\/?$/, '');
  return `${root}${path.startsWith('/') ? '' : '/'}${path}`;
}
