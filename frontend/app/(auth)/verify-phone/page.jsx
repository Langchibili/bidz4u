'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, TextField, Button, Skeleton, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/contexts/AuthContext';

function VerifyPhoneInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOTP, reSendOTP } = useAuth();

  const phoneNumber = searchParams.get('phone');
  const purpose = searchParams.get('purpose') || 'registration';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendTimer]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every((d) => d) && newOtp.join('').length === 6) handleSubmit(newOtp.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;
    const newOtp = pastedData.split('');
    while (newOtp.length < 6) newOtp.push('');
    setOtp(newOtp);
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
    if (pastedData.length === 6) handleSubmit(pastedData);
  };

  const handleSubmit = async (otpValue = otp.join('')) => {
    if (otpValue.length !== 6) {
      setError('Please enter complete OTP');
      return;
    }
    setLoading(true);
    try {
      const response = await verifyOTP(phoneNumber, otpValue, purpose);
      if (response?.status) {
        router.push('/');
        return;
      }
      setError('Please enter correct OTP');
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendTimer(30);
    setError('');
    try {
      await reSendOTP(phoneNumber, purpose);
    } catch {
      setError('Failed to resend OTP');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', p: 3 }}>
      <Box sx={{ pt: 4, pb: 6 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Verify Phone
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter the 6-digit code sent to
            <br />
            <strong>{phoneNumber}</strong>
          </Typography>
        </motion.div>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mb: 4 }}>
        {otp.map((digit, index) => (
          <motion.div key={index} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: index * 0.05 }}>
            <TextField
              inputRef={(el) => (inputRefs.current[index] = el)}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              inputProps={{ maxLength: 1, style: { textAlign: 'center', fontSize: '1.5rem', fontWeight: 600 } }}
              sx={{
                width: 48,
                '& .MuiOutlinedInput-root': {
                  height: 56,
                  '& fieldset': { borderWidth: 2, borderColor: error ? 'error.main' : 'divider' },
                  '&.Mui-focused fieldset': { borderColor: 'secondary.main' },
                },
              }}
            />
          </motion.div>
        ))}
      </Box>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>
            {error}
          </Alert>
        </motion.div>
      )}

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        {resendTimer > 0 ? (
          <Typography variant="body2" color="text.secondary">
            Resend code in {resendTimer}s
          </Typography>
        ) : (
          <Button onClick={handleResend} sx={{ textTransform: 'none' }}>
            Resend Code
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 0.5 }} />

      <Button
        fullWidth
        variant="contained"
        color="secondary"
        size="large"
        onClick={() => handleSubmit()}
        disabled={otp.join('').length !== 6 || loading}
        sx={{ height: 56, mb: 2 }}
      >
        {loading ? <Skeleton variant="text" width={144} sx={{ bgcolor: 'rgba(255,255,255,0.35)' }} /> : 'Verify & Continue'}
      </Button>
    </Box>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4 }}><Skeleton variant="text" width={180} height={40} /><Skeleton variant="rounded" height={56} sx={{ mt: 3 }} /></Box>}>
      <VerifyPhoneInner />
    </Suspense>
  );
}
