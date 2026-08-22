import { factories } from '@strapi/strapi';
import type { Context } from 'koa';

interface SendMessageRequest {
  phoneNumber: string;
  purpose?: 'login' | 'signup';
}

interface SendMessageResponse {
  status: boolean;
  message: string;
}

interface VerifyOtpRequest {
  phoneNumber: string;
  otp: string;
  purpose?: 'login' | 'signup';
}

interface VerifyOtpResponse {
  status: boolean;
  jwt: string;
  user: Record<string, unknown>;
}

const sendMessage = async (ctx: Context): Promise<void> => {
    try {
      const { phoneNumber, purpose = 'login' } = ctx.request.body as SendMessageRequest;
      if (!phoneNumber) return ctx.badRequest('phoneNumber is required');

      const { generateOtp, saveOtp } = await import('../../../services/otpService');
      const { SendSmsNotification } = await import('../../../services/messages');

      const code = generateOtp();
      await saveOtp(strapi, phoneNumber, code, purpose);
      await SendSmsNotification(phoneNumber, `Your bidz4u verification code is ${code}. It expires in 5 minutes.`);

      ctx.send({ status: true, message: 'OTP sent' } as SendMessageResponse);
    } catch (error) {
      console.error('Error sending OTP:', error);
      ctx.internalServerError('Failed to send OTP');
    }
  }

export default factories.createCoreController('api::otp-verification.otp-verification', ({ strapi }) => ({ 
 async create(ctx: Context): Promise<void> {
    return ctx.methodNotAllowed('Use POST /auth-otp/send instead');
  },
  async update(ctx: Context): Promise<void> {
    return ctx.methodNotAllowed('OTP records cannot be edited directly');
  },
  async send(ctx: Context): Promise<void> {
    return sendMessage(ctx);
  },
  async resend(ctx: Context): Promise<void> {
    return sendMessage(ctx);
  },

  async verify(ctx: Context): Promise<void> {
    try {
      const { phoneNumber, otp, purpose = 'login' } = ctx.request.body as VerifyOtpRequest;
      if (!phoneNumber || !otp) return ctx.badRequest('phoneNumber and otp are required');

      const { verifyOtp } = await import('../../../services/otpService');
      const valid = await verifyOtp(strapi, phoneNumber, otp);
      if (!valid) return ctx.badRequest('Invalid or expired OTP');

      let user = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { username: phoneNumber } });

      if (!user) {
        if (purpose === 'login') return ctx.badRequest('No account found for this number');
        return ctx.badRequest('Complete registration before verifying a new signup');
      }

      const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
      ctx.send({ status: true, jwt, user } as VerifyOtpResponse);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      ctx.internalServerError('Failed to verify OTP');
    }
  },
}));