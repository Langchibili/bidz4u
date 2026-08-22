'use client';
// lib/contexts/AppContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GLOBAL_DEFAULTS, STORAGE_KEYS } from '@/Constants';
import { apiClient } from '@/lib/api/client';

export const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [authState, setAuthState] = useState({ token: null, user: null, hydrated: false });
  const [countryConfig, setCountryConfig] = useState({
    savedCountryName: '',
    savedPhoneCode: '',
    phoneNumberDigitLenth: 9,
    savedCurrencyCode: GLOBAL_DEFAULTS.FALLBACK_CURRENCY_CODE,
    savedCurrencySymbol: GLOBAL_DEFAULTS.FALLBACK_CURRENCY_SYMBOL,
  });
  const [effectiveSettings, setEffectiveSettings] = useState(null);

  // ── Hydrate from localStorage on boot ──────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const savedCountry = localStorage.getItem(STORAGE_KEYS.COUNTRY_CONFIG);
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

      if (savedToken && savedUser) {
        setAuthState({ token: savedToken, user: JSON.parse(savedUser), hydrated: true });
      } else {
        setAuthState((prev) => ({ ...prev, hydrated: true }));
      }
      if (savedCountry) setCountryConfig(JSON.parse(savedCountry));
      if (savedSettings) setEffectiveSettings(JSON.parse(savedSettings));
    } catch (e) {
      console.error('Failed to hydrate AppContext from localStorage', e);
      setAuthState((prev) => ({ ...prev, hydrated: true }));
    }
  }, []);

  const persistCountryConfig = useCallback((chosenCountry) => {
    const configPayload = {
      savedCountryName: chosenCountry.countryName || chosenCountry.name,
      savedPhoneCode: (chosenCountry.savedPhoneCode || chosenCountry.phoneCode || '').replace('+', ''),
      phoneNumberDigitLenth: chosenCountry.phoneNumberDigitLenth || 9,
      savedCurrencyCode: chosenCountry.currency?.currCode || chosenCountry.currency?.code || GLOBAL_DEFAULTS.FALLBACK_CURRENCY_CODE,
      savedCurrencySymbol: chosenCountry.currency?.currSymbol || chosenCountry.currency?.symbol || GLOBAL_DEFAULTS.FALLBACK_CURRENCY_SYMBOL,
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

  const handleUserLogin = useCallback(async (jwtToken, apiUserResponse, chosenCountry) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, jwtToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(apiUserResponse));
    }
    const configPayload = chosenCountry ? persistCountryConfig(chosenCountry) : countryConfig;
    setAuthState({ token: jwtToken, user: apiUserResponse, hydrated: true });
    if (configPayload?.countryId) {
      await fetchEffectiveSettings(configPayload.countryId);
    }
  }, [countryConfig, persistCountryConfig, fetchEffectiveSettings]);

  const handleUserLogout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
    setAuthState({ token: null, user: null, hydrated: true });
  }, []);

  return (
    <AppContext.Provider
      value={{
        authState,
        countryConfig,
        effectiveSettings,
        persistCountryConfig,
        fetchEffectiveSettings,
        handleUserLogin,
        handleUserLogout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within an AppProvider');
  return ctx;
}
