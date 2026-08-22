// backend/src/services/otpService.ts

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function saveOtp(strapi: any, phoneNumber: string, code: string, purpose: string) {
  const existing = await strapi.db.query('api::otp-verification.otp-verification').findOne({
    where: { otpPhoneNumber: phoneNumber },
  });

  const data = {
    otpPhoneNumber: phoneNumber,
    otpCode: code,
    otpPurpose: purpose,
    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    otpAttempts: 0,
  };

  if (existing) {
    return strapi.db.query('api::otp-verification.otp-verification').update({ where: { id: existing.id }, data });
  }
  return strapi.db.query('api::otp-verification.otp-verification').create({ data });
}

export async function verifyOtp(strapi: any, phoneNumber: string, code: string): Promise<boolean> {
  const entry = await strapi.db.query('api::otp-verification.otp-verification').findOne({
    where: { otpPhoneNumber: phoneNumber },
  });
  if (!entry) return false;
  if (new Date(entry.otpExpiresAt) < new Date()) return false;
  if (String(entry.otpCode) !== String(code)) {
    await strapi.db.query('api::otp-verification.otp-verification').update({
      where: { id: entry.id },
      data: { otpAttempts: (entry.otpAttempts || 0) + 1 },
    });
    return false;
  }
  await strapi.db.query('api::otp-verification.otp-verification').delete({ where: { id: entry.id } });
  return true;
}
