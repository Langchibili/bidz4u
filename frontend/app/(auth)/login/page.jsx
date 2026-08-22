'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  CircularProgress,
  Alert,
  MenuItem,
  Select,
  FormControl,
  Snackbar,
} from '@mui/material';
import { Phone as PhoneIcon, Public as PublicIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { getPhoneDigits, buildFullPhone } from '@/Functions';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithOTP, isAuthenticated, persistCountryConfig } = useAuth();

  const [step, setStep] = useState(0); // 0: country selection, 1: phone input
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [existsSnackbar, setExistsSnackbar] = useState(false);

  useEffect(() => {
    fetchCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCountries = async () => {
    try {
      setCountriesLoading(true);
      const res = await apiClient.get('/countries?populate=currency&sort=countryName:asc');
      const list = res?.data || [];
      setCountries(list);

      const zambia = list.find((c) => c.countryName === 'Zambia' || c.countryCode === 'ZM');
      setSelectedCountry(zambia || list[0] || null);
    } catch (err) {
      setError('Failed to load countries. Please refresh the page.');
      console.error('Error fetching countries:', err);
    } finally {
      setCountriesLoading(false);
    }
  };

  const handleCountrySelect = () => {
    if (!selectedCountry) {
      setError('Please select a country');
      return;
    }
    setError('');
    setStep(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const phoneNumberDigitLenth = selectedCountry.phoneNumberDigitLenth || 9;
    const cleanPhone = getPhoneDigits(phoneNumber, phoneNumberDigitLenth);
    if (cleanPhone.length < phoneNumberDigitLenth) {
      setError('Please enter a valid phone number');
      return;
    }

    const fullPhone = buildFullPhone(selectedCountry.savedPhoneCode, cleanPhone, phoneNumberDigitLenth);
    persistCountryConfig(selectedCountry);

    try {
      setLoading(true);
      let userExists = false;
      try {
        const res = await apiClient.post('/account-exist-check/check-user', { username: fullPhone });
        userExists = !!res?.userExists;
      } catch (err) {
        console.warn('Account existence check failed, proceeding to OTP:', err);
        userExists = true; // fail open toward login OTP, matches reference behaviour
      }

      if (userExists) {
        try {
          await loginWithOTP(fullPhone);
        } finally {
          router.push(`/verify-phone?phone=${encodeURIComponent(fullPhone)}&purpose=login`);
        }
      } else {
        setExistsSnackbar(true);
        setTimeout(() => router.push('/signup'), 800);
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated()) {
    router.push('/');
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', p: 3 }}>
      <Box sx={{ pt: 4, pb: 6 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            {step === 0 ? 'Select Country' : 'Welcome Back'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {step === 0 ? 'Choose your country to continue' : 'Enter your phone number to continue'}
          </Typography>
        </motion.div>
      </Box>

      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
        {step === 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Country
            </Typography>
            {countriesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <FormControl fullWidth>
                <Select
                  value={selectedCountry?.id || ''}
                  onChange={(e) => setSelectedCountry(countries.find((c) => c.id === e.target.value))}
                  startAdornment={
                    <InputAdornment position="start">
                      <PublicIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  }
                  sx={{ height: 56 }}
                >
                  {countries.map((country) => (
                    <MenuItem key={country.id} value={country.id}>
                      {country.countryName} (+{country.savedPhoneCode})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        )}

        {step === 1 && (
          <form onSubmit={handleSubmit}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Phone Number
              </Typography>
              <TextField
                fullWidth
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="972612345"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          +{selectedCountry?.savedPhoneCode}
                        </Typography>
                        <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
                      </Box>
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: 56 } }}
              />
            </Box>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
                  {error}
                </Alert>
              </motion.div>
            )}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="secondary"
              size="large"
              disabled={loading || phoneNumber.replace(/\D/g, '').length < (selectedCountry?.phoneNumberDigitLenth || 9)}
              sx={{ height: 56, fontSize: '1rem', fontWeight: 600, mb: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
            </Button>

            <Button fullWidth variant="text" onClick={() => router.push('/signup')} sx={{ height: 48, textTransform: 'none' }}>
              <strong>&nbsp;Sign Up Instead</strong>
            </Button>
          </form>
        )}
      </motion.div>

      {step === 0 && error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
            {error}
          </Alert>
        </motion.div>
      )}

      <Box sx={{ flex: 0.5 }} />

      {step === 0 && !countriesLoading && (
        <>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            size="large"
            onClick={handleCountrySelect}
            disabled={!selectedCountry}
            sx={{ height: 56, fontSize: '1rem', fontWeight: 600, mb: 2 }}
          >
            Continue
          </Button>
          <Button fullWidth variant="text" onClick={() => router.push('/signup')} sx={{ height: 48, textTransform: 'none' }}>
            <strong>&nbsp;Sign Up Instead</strong>
          </Button>
        </>
      )}

      {step === 1 && (
        <Button
          fullWidth
          variant="text"
          onClick={() => {
            setStep(0);
            setError('');
          }}
          sx={{ height: 48, mt: 2, textTransform: 'none' }}
        >
          ← Change Country
        </Button>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
        By continuing, you agree to our Terms &amp; Conditions
      </Typography>

      <Snackbar
        open={existsSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setExistsSnackbar(false)}
        message="Account does not exist yet, please sign up"
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: 'primary.main', fontWeight: 600, borderRadius: 3 } }}
      />
    </Box>
  );
}
