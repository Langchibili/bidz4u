// lib/api/auth.js
//
// authAPI — same call shape/responsibilities as the reference OkraRides
// authAPI (register/sendOTP/reSendOTP/verifyOTP/loginWithOTP/me/logout), but
// mapped onto bidz4u's real Strapi routes:
//
//   POST /account-exist-check/check-user
//   POST /user-registration/register     (creates user, wallet auto-created
//                                          via afterCreate lifecycle)
//   POST /auth-otp/send | /resend | /verify
//
// bidz4u is OTP-only — there is no /auth/local, no password, no /users/me
// content-manager endpoint for "current user" (that's a users-permissions
// plugin route bidz4u's schema doesn't rely on for identity). The verify
// step itself returns { status, jwt, user }, so `me()` just re-reads
// whatever was cached at verify time rather than a separate round-trip.

import { apiClient } from './client';
import { STORAGE_KEYS } from '@/Constants';

export const authAPI = {
  // Check if an account already exists for this normalized phone/username
  async checkUserExists(fullPhone) {
    const res = await apiClient.post('/account-exist-check/check-user', { username: fullPhone });
    return !!res?.userExists;
  },

  // Register new user — country is required (drives phone-digit validation +
  // currency), referralCode is stored client-side only for now (affiliate
  // system isn't wired into /user-registration/register yet).
  async register(data) {
    const { phoneNumber, firstName, lastName, email, country, referralCode } = data;

    if (referralCode && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.REFERRAL_CODE, referralCode);
    }

    const response = await apiClient.post('/user-registration/register', {
      firstName,
      lastName,
      phoneNumber,
      email: email || undefined,
      countryId: country?.id,
    });

    return response; // { status, userId, username }
  },

  // Send OTP (purpose: 'login' | 'registration')
  async sendOTP(phoneNumber, purpose = 'login') {
    return apiClient.post('/auth-otp/send', { phoneNumber, purpose });
  },

  async reSendOTP(phoneNumber, purpose = 'login') {
    return apiClient.post('/auth-otp/resend', { phoneNumber, purpose });
  },

  // Verify OTP — this is the ONLY step that produces a JWT in this app.
  // On success, persists the token + user via apiClient so subsequent calls
  // are authenticated, matching the reference's setToken-on-verify pattern.
  async verifyOTP(phoneNumber, otp, purpose = 'login') {
    const response = await apiClient.post('/auth-otp/verify', { phoneNumber, otp, purpose });

    if (response?.status && response?.jwt) {
      apiClient.setToken(response.jwt);
      if (typeof window !== 'undefined' && response.user) {
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
      }
    }

    return response; // { status, jwt, user }
  },

  // Convenience wrapper used from LoginPage once an existing account is confirmed
  async loginWithOTP(phoneNumber) {
    await this.sendOTP(phoneNumber, 'login');
    return { success: true, message: 'OTP sent' };
  },

  async verifyLoginOTP(phoneNumber, otp) {
    return this.verifyOTP(phoneNumber, otp, 'login');
  },

  // There is no /users/me content-manager route wired up for bidz4u users —
  // identity is whatever /auth-otp/verify returned, cached at login time.
  async me() {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return cached ? JSON.parse(cached) : null;
  },

  logout() {
    apiClient.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.COUNTRY_CONFIG);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      window.location.href = '/login';
    }
  },
};

export default authAPI;
