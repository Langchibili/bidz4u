
// backend/src/api/user-registration/controllers/user-registration.ts

import type { Context } from 'koa';

interface RegistrationRequestBody {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | number;
  email?: string;
  countryId?: string | number;
}

interface RegistrationContext extends Context {
  request: Context['request'] & { body: RegistrationRequestBody };
}

interface Country {
  id: string | number;
  phoneNumberDigitLenth: number;
  savedPhoneCode: string;
}

interface Role {
  id: string | number;
}

interface User {
  id: string | number;
}

export default {
  async register(ctx: RegistrationContext): Promise<unknown> {
    const { firstName, lastName, phoneNumber, email, countryId } = ctx.request.body;

    if (!firstName || !lastName || !phoneNumber || !countryId) {
      return ctx.badRequest('firstName, lastName, phoneNumber and countryId are required');
    }

    const country: Country | null = await strapi.db.query('api::country.country').findOne({ where: { id: countryId } });
    if (!country) return ctx.badRequest('Invalid country');

    const digits = String(phoneNumber).replace(/\D/g, '').slice(-country.phoneNumberDigitLenth);
    const username = `${country.savedPhoneCode}${digits}`;

    const existing: User | null = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { username } });
    if (existing) return ctx.badRequest('Account already exists for this number');

    const role: Role | null = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });

    const user: User = await strapi.db.query('plugin::users-permissions.user').create({
      data: {
        username,
        usrFullName: `${firstName} ${lastName}`,
        usrPhoneNormalized: username,
        usrEmailOptional: email || null,
        email: email || `unset_${username}@bidz4u.com`,
        password: require('crypto').randomBytes(16).toString('hex'), // unused — OTP-only login
        confirmed: true,
        provider: 'local',
        role: role?.id,
        country: country.id,
      },
    });

    ctx.body = { status: true, userId: user.id, username };
  },
};

// > Actual OTP dispatch/verification for this new user happens via `/auth-otp/send` and
// > `/auth-otp/verify` right after this call, same as the login flow.
