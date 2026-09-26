'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Skeleton,
  Alert,
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  Select,
  FormControl,
  Snackbar,
  Chip,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Person as PersonIcon,
  Tag as TagIcon,
  Public as PublicIcon,
  CardGiftcard as PromoIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { getPhoneDigits, validatePhoneNumber, buildFullPhone } from '@/Functions';
import { STORAGE_KEYS } from '@/Constants';

const steps = ['Country', 'Phone', 'Details', 'Verify'];

async function resolveAffiliateCode() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('ref') || params.get('afcode');
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEYS.REFERRAL_CODE, fromUrl);
      return fromUrl;
    }
    const fromStorage = localStorage.getItem(STORAGE_KEYS.REFERRAL_CODE);
    if (fromStorage) return fromStorage;
  }
  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const { register, sendOTP, isAuthenticated, persistCountryConfig } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [existsSnackbar, setExistsSnackbar] = useState(false);
  const [codeAutoFilled, setCodeAutoFilled] = useState(false);

  const [formData, setFormData] = useState({
    phoneNumber: '',
    firstName: '',
    lastName: '',
    referralCode: '',
  });

  useEffect(() => {
    fetchCountries();
    resolveAffiliateCode().then((code) => {
      if (code) {
        setFormData((prev) => ({ ...prev, referralCode: code }));
        setCodeAutoFilled(true);
      }
    });
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

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (field === 'referralCode') setCodeAutoFilled(false);
    setError('');
  };

  const handleNext = async () => {
    setError('');

    if (activeStep === 0) {
      if (!selectedCountry) {
        setError('Please select a country');
        return;
      }
      setActiveStep(1);
      return;
    }

    if (activeStep === 1) {
      const phoneNumberDigitLenth = selectedCountry.phoneNumberDigitLenth || 9;
      const cleanPhone = getPhoneDigits(formData.phoneNumber, phoneNumberDigitLenth);
      if (!validatePhoneNumber(cleanPhone, phoneNumberDigitLenth)) {
        setError('Please enter a valid phone number');
        return;
      }
      persistCountryConfig(selectedCountry);
      const fullUsername = buildFullPhone(selectedCountry.savedPhoneCode, cleanPhone, phoneNumberDigitLenth);

      try {
        setLoading(true);
        const res = await apiClient.post('/account-exist-check/check-user', { username: fullUsername });
        if (res?.userExists) {
          setExistsSnackbar(true);
          try {
            await sendOTP(fullUsername, 'login');
          } finally {
            setTimeout(() => {
              router.push(`/verify-phone?phone=${encodeURIComponent(fullUsername)}&purpose=login`);
            }, 800);
          }
          return;
        }
      } catch (err) {
        console.warn('Account existence check failed:', err);
      } finally {
        setLoading(false);
      }

      setActiveStep(2);
      return;
    }

    if (activeStep === 2) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setError('Please enter your first and last name');
        return;
      }

      try {
        setLoading(true);
        const phoneNumberDigitLenth = selectedCountry.phoneNumberDigitLenth || 9;
        const fullPhone = buildFullPhone(selectedCountry.savedPhoneCode, formData.phoneNumber, phoneNumberDigitLenth);

        await register({
          phoneNumber: fullPhone,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          referralCode: formData.referralCode.trim() || null,
          country: selectedCountry,
        });

        if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.REFERRAL_CODE);

        await sendOTP(fullPhone, 'registration');
        router.push(`/verify-phone?phone=${encodeURIComponent(fullPhone)}&purpose=registration`);
      } catch (err) {
        setError(err.message || 'Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      setError('');
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
            {activeStep === 0 ? 'Select Country' : 'Create Account'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {activeStep === 0 ? 'Choose your country to get started' : 'Sign up to get started with bidz4u'}
          </Typography>
        </motion.div>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <motion.div key={activeStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
        {activeStep === 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Country
            </Typography>
            {countriesLoading ? (
              <Skeleton variant="rounded" height={56} />
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

        {activeStep === 1 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Phone Number
            </Typography>
            <TextField
              fullWidth
              type="tel"
              value={formData.phoneNumber}
              onChange={handleChange('phoneNumber')}
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
        )}

        {activeStep === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                First Name
              </Typography>
              <TextField
                fullWidth
                value={formData.firstName}
                onChange={handleChange('firstName')}
                placeholder="John"
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'text.secondary' }} /></InputAdornment> }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Last Name
              </Typography>
              <TextField
                fullWidth
                value={formData.lastName}
                onChange={handleChange('lastName')}
                placeholder="Banda"
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'text.secondary' }} /></InputAdornment> }}
              />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Referral Code (Optional)
                </Typography>
                <AnimatePresence>
                  {codeAutoFilled && formData.referralCode && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                      <Chip
                        icon={<PromoIcon sx={{ fontSize: '14px !important' }} />}
                        label="Promotion applied"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: 22, fontSize: 10, fontWeight: 700 }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>

              <TextField
                fullWidth
                value={formData.referralCode}
                onChange={handleChange('referralCode')}
                placeholder="Enter referral code"
                sx={{
                  '& .MuiOutlinedInput-root': codeAutoFilled && formData.referralCode
                    ? { '& fieldset': { borderColor: 'success.main', borderWidth: 2 }, '&:hover fieldset': { borderColor: 'success.dark' } }
                    : {},
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagIcon sx={{ color: codeAutoFilled && formData.referralCode ? 'success.main' : 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                helperText={
                  codeAutoFilled && formData.referralCode
                    ? 'Detected from your affiliate link — you may be eligible for a welcome bonus'
                    : undefined
                }
                FormHelperTextProps={{ sx: { color: 'success.main', fontWeight: 500 } }}
              />
            </Box>
          </Box>
        )}
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }}>
            {error}
          </Alert>
        </motion.div>
      )}

      <Box sx={{ flex: 0.5 }} />

      {!countriesLoading && (
        <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
          {activeStep > 0 && (
            <Button variant="outlined" size="large" onClick={handleBack} sx={{ height: 56, flex: 1 }}>
              Back
            </Button>
          )}
          <Button
            fullWidth={activeStep === 0}
            variant="contained"
            color="secondary"
            size="large"
            onClick={handleNext}
            disabled={loading || (activeStep === 0 && !selectedCountry)}
            sx={{ height: 56, flex: activeStep > 0 ? 2 : 1 }}
          >
            {loading ? <Skeleton variant="text" width={112} sx={{ bgcolor: 'rgba(255,255,255,0.35)' }} /> : activeStep === steps.length - 2 ? 'Create Account' : 'Continue'}
          </Button>
        </Box>
      )}

      <Button fullWidth variant="text" onClick={() => router.push('/login')} sx={{ height: 48, mt: 2, textTransform: 'none' }}>
        <strong>&nbsp;Log In Instead</strong>
      </Button>

      <Snackbar
        open={existsSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setExistsSnackbar(false)}
        message="Account already exists, redirecting you to the OTP screen"
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: 'primary.main', fontWeight: 600, borderRadius: 3 } }}
      />
    </Box>
  );
}
