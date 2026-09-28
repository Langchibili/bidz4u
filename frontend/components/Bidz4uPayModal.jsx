'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Skeleton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '@/lib/api/client';
import { buildFullPhone, getPhoneDigits } from '@/Functions';
import { useAuth } from '@/lib/contexts/AuthContext';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export default function Bidz4uPayModal({
  open,
  onClose,
  amount,
  currency,
  purpose = 'winnerpay',
  relatedEntityId,
  phoneCode = '260',
  withdrawalDetails = {},
  onSuccess,
}) {
  const { countryConfig } = useAuth();
  const [phone, setPhone] = useState('');
  const [phoneConfig, setPhoneConfig] = useState(null);
  const [useAlternatePhone, setUseAlternatePhone] = useState(false);
  const [verifiedNumbers, setVerifiedNumbers] = useState([]);
  const [otp, setOtp] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [operator, setOperator] = useState('');
  const [phase, setPhase] = useState('form');
  const [message, setMessage] = useState('');
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (!open) {
      clearInterval(pollRef.current);
      clearTimeout(timeoutRef.current);
      setPhase('form');
      setMessage('');
      setPhone('');
      setPhoneConfig(null);
      setUseAlternatePhone(false);
      setVerifiedNumbers([]);
      setOtp('');
      setOtpOpen(false);
      setOtpMessage('');
      setOperator('');
      return undefined;
    }

    let cancelled = false;
    apiClient.get('/bidz4upay/payment-phone')
      .then((result) => {
        if (cancelled) return;
        setPhoneConfig(result);
        setPhone(result?.defaultPhone || '');
        setVerifiedNumbers(Array.isArray(result?.verifiedPaymentNumbers) ? result.verifiedPaymentNumbers : []);
      })
      .catch((error) => {
        console.error('Failed to load payment phone settings', error);
        if (!cancelled) setMessage('Unable to load your account phone number. Close and try again.');
      });
    return () => { cancelled = true; };
  }, [open]);

  const startPolling = (reference) => {
    setPhase('polling');
    pollRef.current = setInterval(async () => {
      try {
        const result = await apiClient.get(`/bidz4upay/status/${encodeURIComponent(reference)}`);
        if (result?.paymentStatus === 'completed') {
          clearInterval(pollRef.current);
          clearTimeout(timeoutRef.current);
          setPhase('success');
          setMessage('Payment completed successfully.');
          onSuccess?.(result);
        } else if (result?.paymentStatus === 'failed') {
          clearInterval(pollRef.current);
          clearTimeout(timeoutRef.current);
          setPhase('error');
          setMessage(result.failureReason || 'Payment failed.');
        }
      } catch (error) {
        console.error('Payment status check failed', error);
      }
    }, POLL_INTERVAL_MS);
    timeoutRef.current = setTimeout(() => {
      clearInterval(pollRef.current);
      setPhase('error');
      setMessage('Payment timed out. Check your phone and try again.');
    }, POLL_TIMEOUT_MS);
  };

  const digitLength = Number(phoneConfig?.phoneNumberDigitLenth || countryConfig?.phoneNumberDigitLenth || 9);
  const phoneCodeDigits = String(phoneConfig?.phoneCode || phoneCode || countryConfig?.savedPhoneCode || '260').replace(/\D/g, '');
  const paymentPhone = buildFullPhone(phoneCodeDigits, phone, digitLength);
  const accountPhone = phoneConfig?.defaultPhoneInternational || '';
  const phoneIsVerified = paymentPhone === accountPhone || verifiedNumbers.includes(paymentPhone);
  const usesMobileMoney = purpose !== 'withdraw' || withdrawalDetails.method !== 'bank_account';

  const requestPhoneVerification = async () => {
    try {
      setOtpBusy(true);
      setOtpMessage('');
      await apiClient.post('/auth-otp/payment-phone/send', { phoneNumber: paymentPhone });
      setOtpOpen(true);
    } catch (error) {
      setMessage(error.message || 'Unable to send a verification code.');
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyPaymentPhone = async () => {
    try {
      setOtpBusy(true);
      setOtpMessage('');
      const result = await apiClient.post('/auth-otp/payment-phone/verify', {
        phoneNumber: paymentPhone,
        otp,
      });
      setVerifiedNumbers(Array.isArray(result?.verifiedNumbers) ? result.verifiedNumbers : [...verifiedNumbers, paymentPhone]);
      setOtpOpen(false);
      setOtp('');
      setMessage('Phone number verified. Continue with your payment.');
    } catch (error) {
      setOtpMessage(error.message || 'Invalid or expired code.');
    } finally {
      setOtpBusy(false);
    }
  };

  const submit = async () => {
    const isWithdrawal = purpose === 'withdraw';
    const walletCoversPayment = purpose === 'winnerpay' && Number(amount) <= 0;
    if (usesMobileMoney && !walletCoversPayment && (
      getPhoneDigits(phone, digitLength).length !== digitLength || !(operator || withdrawalDetails.operator)
    )) {
      setMessage('Enter your phone number and mobile-money operator.');
      return;
    }
    if (isWithdrawal && withdrawalDetails.method === 'bank_account'
      && (!withdrawalDetails.accountNumber || !withdrawalDetails.bankId || !withdrawalDetails.accountName)) {
      setMessage('Complete the bank account details before continuing.');
      return;
    }
    if (isWithdrawal && withdrawalDetails.method !== 'bank_account'
      && (!getPhoneDigits(phone, digitLength).length || !withdrawalDetails.operator)) {
      setMessage('Enter your withdrawal number and mobile-money operator.');
      return;
    }
    if (usesMobileMoney && !walletCoversPayment && !phoneIsVerified) {
      await requestPhoneVerification();
      return;
    }
    try {
      setPhase('submitting');
      setMessage('');
      const result = isWithdrawal
        ? await apiClient.post('/bidz4upay/request-withdrawal', {
          amount,
          ...withdrawalDetails,
          ...(withdrawalDetails.method !== 'bank_account' ? { phone: paymentPhone } : {}),
          operator: operator || withdrawalDetails.operator,
        })
        : await apiClient.post('/bidz4upay/initiate', {
          purpose,
          amount,
          relatedEntityId,
          phone: paymentPhone,
          operator,
        });
      const payment = result?.data || result;
      if (payment?.paymentStatus === 'completed') {
        setPhase('success');
        setMessage('Payment completed successfully.');
        onSuccess?.(payment);
      } else {
        startPolling(payment?.reference);
      }
    } catch (error) {
      setPhase('error');
      setMessage(error.message || 'Unable to start payment.');
    }
  };

  return (
    <Dialog open={open} onClose={phase === 'submitting' || phase === 'polling' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {purpose === 'walletdeposit' ? 'Deposit to wallet' : purpose === 'withdraw' ? 'Confirm withdrawal' : 'Pay for this auction'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Amount: {currency} {Number(amount || 0).toFixed(2)}
        </Typography>
        {purpose !== 'withdraw' && !(purpose === 'winnerpay' && Number(amount) <= 0) && (phase === 'form' || phase === 'submitting') && (
          <>
            <TextField
              fullWidth
              type="tel"
              label="Mobile money number"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">+{phoneCodeDigits}</InputAdornment> }}
              sx={{ mb: 1 }}
            />
            <Button size="small" onClick={() => {
              setUseAlternatePhone((current) => !current);
              setPhone(useAlternatePhone ? (phoneConfig?.defaultPhone || '') : '');
              setMessage('');
            }} sx={{ mb: 2, alignSelf: 'flex-start' }}>
              {useAlternatePhone ? 'Use account number' : 'Use a different number'}
            </Button>
            <TextField fullWidth select label="Mobile-money operator" value={operator} onChange={(event) => setOperator(event.target.value)}>
              <MenuItem value="mtn">MTN</MenuItem>
              <MenuItem value="airtel">Airtel</MenuItem>
              <MenuItem value="zamtel">Zamtel</MenuItem>
            </TextField>
          </>
        )}
        {purpose === 'winnerpay' && Number(amount) <= 0 && (phase === 'form' || phase === 'submitting') && (
          <Alert severity="success">Your available wallet balance covers the remaining amount.</Alert>
        )}
        {purpose === 'withdraw' && (phase === 'form' || phase === 'submitting') && (
          withdrawalDetails.method === 'bank_account' ? (
            <Alert severity="info">Payout to {withdrawalDetails.accountName || 'your bank account'}</Alert>
          ) : (
            <>
              <TextField
                fullWidth
                type="tel"
                label="Mobile money number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">+{phoneCodeDigits}</InputAdornment> }}
                sx={{ mb: 1 }}
              />
              <Button size="small" onClick={() => {
                setUseAlternatePhone((current) => !current);
                setPhone(useAlternatePhone ? (phoneConfig?.defaultPhone || '') : '');
                setMessage('');
              }} sx={{ mb: 2, alignSelf: 'flex-start' }}>
                {useAlternatePhone ? 'Use account number' : 'Use a different number'}
              </Button>
              <TextField fullWidth select label="Mobile-money operator" value={operator || withdrawalDetails.operator || ''} onChange={(event) => setOperator(event.target.value)}>
                <MenuItem value="mtn">MTN</MenuItem>
                <MenuItem value="airtel">Airtel</MenuItem>
                <MenuItem value="zamtel">Zamtel</MenuItem>
              </TextField>
            </>
          )
        )}
        {phase === 'submitting' && <Skeleton variant="rounded" width="100%" height={48} sx={{ mt: 2 }} />}
        {phase === 'polling' && <Alert severity="info">Approve the payment request on your phone.</Alert>}
        {phase === 'success' && <Alert severity="success">{message}</Alert>}
        {phase === 'error' && <Alert severity="error">{message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={phase === 'submitting' || phase === 'polling'}>Close</Button>
        {(phase === 'form' || phase === 'error') && (
          <Button onClick={submit} variant="contained" color="secondary">
            {purpose === 'withdraw' ? 'Withdraw' : purpose === 'walletdeposit' ? 'Deposit' : Number(amount) <= 0 ? 'Apply wallet balance' : 'Pay now'}
          </Button>
        )}
      </DialogActions>

      <Dialog open={otpOpen} onClose={() => !otpBusy && setOtpOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Verify payment number</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the code sent to +{paymentPhone}.
          </Typography>
          <TextField
            fullWidth
            label="Verification code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', maxLength: 6 }}
          />
          {otpMessage && <Alert severity="error" sx={{ mt: 2 }}>{otpMessage}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={requestPhoneVerification} disabled={otpBusy}>Resend code</Button>
          <Button onClick={() => setOtpOpen(false)} disabled={otpBusy}>Cancel</Button>
          <Button onClick={verifyPaymentPhone} variant="contained" disabled={otpBusy || otp.length !== 6}>Verify</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
