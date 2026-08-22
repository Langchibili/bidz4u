'use client';
// lib/hooks/useAuth.js
//
// Wraps the OTP-only auth flow described in the backend reference:
//   POST /account-exist-check/check-user
//   POST /user-registration/register
//   POST /auth-otp/send | /auth-otp/resend | /auth-otp/verify
//
// loginWithOTP() is the "existing user" convenience path used from LoginPage:
// it just sends an OTP for purpose='login' — verifyOTP() completes the flow.

import { useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAppContext } from '@/lib/contexts/AppContext';

export function useAuth() {
  const { authState, countryConfig, handleUserLogin, handleUserLogout } = useAppContext();

  const checkUserExists = useCallback(async (fullPhone) => {
    const res = await apiClient.post('/account-exist-check/check-user', { username: fullPhone });
    return !!res?.userExists;
  }, []);

  const register = useCallback(async ({ phoneNumber, firstName, lastName, email, country }) => {
    const res = await apiClient.post('/user-registration/register', {
      firstName,
      lastName,
      phoneNumber,
      email: email || undefined,
      countryId: country?.id,
    });
    return res;
  }, []);

  const sendOTP = useCallback(async (phoneNumber, purpose = 'login') => {
    return apiClient.post('/auth-otp/send', { phoneNumber, purpose });
  }, []);

  const reSendOTP = useCallback(async (phoneNumber, purpose = 'login') => {
    return apiClient.post('/auth-otp/resend', { phoneNumber, purpose });
  }, []);

  // Convenience wrapper used from LoginPage once an existing account is confirmed.
  const loginWithOTP = useCallback(async (phoneNumber) => {
    return sendOTP(phoneNumber, 'login');
  }, [sendOTP]);

  const verifyOTP = useCallback(async (phoneNumber, otp, purpose = 'login') => {
    const res = await apiClient.post('/auth-otp/verify', { phoneNumber, otp, purpose });
    if (res?.status && res?.jwt && res?.user) {
      const storedCountry = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('bidz4u_country_config') || 'null')
        : null;
      await handleUserLogin(res.jwt, res.user, storedCountry ? { ...storedCountry, id: storedCountry.countryId } : null);
    }
    return res;
  }, [handleUserLogin]);

  const logout = useCallback(() => {
    handleUserLogout();
  }, [handleUserLogout]);

  const isAuthenticated = useCallback(() => {
    return !!(authState?.token && authState?.user);
  }, [authState]);

  return {
    user: authState?.user || null,
    token: authState?.token || null,
    hydrated: authState?.hydrated,
    countryConfig,
    checkUserExists,
    register,
    sendOTP,
    reSendOTP,
    loginWithOTP,
    verifyOTP,
    logout,
    isAuthenticated,
  };
}
