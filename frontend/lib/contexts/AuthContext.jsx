'use client';
// lib/contexts/AuthContext.jsx
//
// Same createContext/useContext shape as the reference AuthProvider — user,
// loading, error, register/sendOTP/reSendOTP/verifyOTP/loginWithOTP/logout,
// isAuthenticated() — plus bidz4u-specific country/currency config and the
// effective-settings fetch, since bidding needs those cached right after login.

import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { authAPI } from '@/lib/api/auth';
import { apiClient } from '@/lib/api/client';
import { GLOBAL_DEFAULTS, STORAGE_KEYS } from '@/Constants';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const [countryConfig, setCountryConfig] = useState({
    savedCountryName: '',
    savedPhoneCode: '',
    phoneNumberDigitLenth: 9,
    savedCurrencyCode: GLOBAL_DEFAULTS.FALLBACK_CURRENCY_CODE,
    savedCurrencySymbol: GLOBAL_DEFAULTS.FALLBACK_CURRENCY_SYMBOL,
  });
  const [effectiveSettings, setEffectiveSettings] = useState(null);

  // ── Load whatever was persisted from a previous session ──────────────────
  useEffect(() => {
    loadUser();
    if (typeof window !== 'undefined') {
      try {
        const savedCountry = localStorage.getItem(STORAGE_KEYS.COUNTRY_CONFIG);
        const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (savedCountry) setCountryConfig(JSON.parse(savedCountry));
        if (savedSettings) setEffectiveSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to hydrate country/settings from localStorage', e);
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUser = async () => {
    try {
      const token = apiClient.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const userData = await authAPI.me();
      setUser(userData);
    } catch (err) {
      console.error('Error loading user:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const persistCountryConfig = useCallback((chosenCountry) => {
    const configPayload = {
      savedCountryName: chosenCountry.countryName || chosenCountry.name,
      savedPhoneCode: (chosenCountry.savedPhoneCode || chosenCountry.phoneCode || '').replace('+', ''),
      phoneNumberDigitLenth: chosenCountry.phoneNumberDigitLenth || 9,
      savedCurrencyCode: chosenCountry.currency?.currCode || chosenCountry.currency?.code || GLOBAL_DEFAULTS.FALLBACK_CURRENCY_CODE,
      savedCurrencySymbol: chosenCountry.currency?.currSymbol || chosenCountry.currency?.symbol || GLOBAL_DEFAULTS.FALLBACK_CURRENCY_SYMBOL,
      // Deliberately NOT apiClient.resolveId(chosenCountry) — both consumers
      // of this countryId (GET /countries/:id/effective-settings, which does
      // `Number(id)` server-side, and POST /user-registration/register's
      // `countryId`, which does a raw `db.query(...).findOne({ where: { id
      // } })`) require the NUMERIC id. `Number(documentId)` would be NaN.
      // See UIDTYPE_AUDIT.md.
      countryId: chosenCountry.id,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.COUNTRY_CONFIG, JSON.stringify(configPayload));
    }
    setCountryConfig(configPayload);
    return configPayload;
  }, []);

  const fetchEffectiveSettings = useCallback(async (countryId) => {
    if (!countryId) return null;
    try {
      const res = await apiClient.get(`/countries/${countryId}/effective-settings`);
      if (res?.success) {
        setEffectiveSettings(res.settings);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(res.settings));
        }
        return res.settings;
      }
    } catch (e) {
      console.warn('Failed to fetch effective settings, using cached/fallback', e);
    }
    return null;
  }, []);

  // ── Register ───────────────────────────────────────────────────────────
  const register = async (data) => {
    try {
      setLoading(true);
      setError(null);
      if (data.country) persistCountryConfig(data.country);
      return await authAPI.register(data);
    } catch (err) {
      if (err.status === 400 && /already exists/i.test(err.message || '')) {
        setError('Oops! Account exists already, log in instead.');
      } else {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (phoneNumber, purpose) => {
    try {
      setError(null);
      return await authAPI.sendOTP(phoneNumber, purpose);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const reSendOTP = async (phoneNumber, purpose) => {
    try {
      setError(null);
      return await authAPI.reSendOTP(phoneNumber, purpose);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // ── Verify OTP — the only step that actually logs the user in ───────────
  const verifyOTP = async (phoneNumber, otp, purpose) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.verifyOTP(phoneNumber, otp, purpose);

      if (response?.status && response?.user) {
        setUser(response.user);

        // Country config was already persisted during registration/login
        // step 1 — fetch effective settings now that we have a countryId.
        const storedCountry = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem(STORAGE_KEYS.COUNTRY_CONFIG) || 'null')
          : null;
        if (storedCountry?.countryId) {
          await fetchEffectiveSettings(storedCountry.countryId);
        }
      }

      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithOTP = async (phoneNumber) => {
    try {
      setError(null);
      return await authAPI.loginWithOTP(phoneNumber);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const refreshUser = async () => {
    const userData = await authAPI.me();
    setUser(userData);
    return userData;
  };

  const isAuthenticated = () => {
    return !!user && !!apiClient.getToken();
  };

  const value = {
    user,
    loading,
    error,
    hydrated,
    countryConfig,
    effectiveSettings,
    persistCountryConfig,
    fetchEffectiveSettings,
    register,
    sendOTP,
    reSendOTP,
    verifyOTP,
    loginWithOTP,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default useAuth;
