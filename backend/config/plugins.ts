import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

// bidz4u uses OTP-only login — no password re-entry to fall back on — so the
// whole point of a long session is to avoid re-sending an SMS OTP just to
// keep using the app. 1 year, expressed both ways Strapi's config accepts it:
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60; // 31,536,000
const ONE_YEAR_JWT_STRING = '365d';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      jwt: {
        expiresIn: ONE_YEAR_JWT_STRING,
      },
      refreshToken: {
        // How long a refresh token stays valid before the user must OTP-login again.
        lifespan: ONE_YEAR_SECONDS,
      },
      sessions: {
        httpOnly: true,
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes: deniedExecutableTypes,
      },
    },
  },
});

export default config;