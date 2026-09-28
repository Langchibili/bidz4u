export interface PhoneCountrySettings {
  savedPhoneCode?: string | number;
  phoneNumberDigitLenth?: number;
}

export function getAccountPhoneNumber(
  user: { username?: string; usrPhoneNormalized?: string; phoneNumber?: string },
  country?: PhoneCountrySettings | null,
): string {
  const phoneCode = String(country?.savedPhoneCode || '260').replace(/\D/g, '');
  const digitLength = Number(country?.phoneNumberDigitLenth) || 9;
  const username = String(user.username || '');
  const usernameDigits = username.replace(/\D/g, '');
  if (usernameDigits.startsWith(phoneCode) && usernameDigits.length >= phoneCode.length + digitLength) {
    return username;
  }
  return user.usrPhoneNormalized || user.phoneNumber || username;
}

export function normalizePhoneNumber(
  phone: string | number,
  country?: PhoneCountrySettings | null,
): { localDigits: string; internationalDigits: string; e164: string } {
  const phoneCode = String(country?.savedPhoneCode || '260').replace(/\D/g, '');
  const digitLength = Number(country?.phoneNumberDigitLenth) || 9;
  let digits = String(phone || '').replace(/\D/g, '');

  if (digits.length > digitLength && digits.startsWith(phoneCode)) {
    digits = digits.slice(phoneCode.length);
  }
  digits = digits.replace(/^0+/, '');
  if (digits.length < digitLength) {
    throw new Error(`Phone number must contain ${digitLength} local digits`);
  }

  const localDigits = digits.slice(-digitLength);
  const internationalDigits = `${phoneCode}${localDigits}`;
  return { localDigits, internationalDigits, e164: `+${internationalDigits}` };
}