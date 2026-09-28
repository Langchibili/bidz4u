'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  Tabs,
  Tab,
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
  const { user, countryConfig } = useAuth();
  const initialDigitLength = Number(countryConfig?.phoneNumberDigitLenth || 9);
  const initialPhoneCode = String(phoneCode || countryConfig?.savedPhoneCode || '260').replace(/\D/g, '');
  const initialAccountPhone = getPhoneDigits(user?.username, initialDigitLength)
    || getPhoneDigits(user?.usrPhoneNormalized, initialDigitLength)
    || getPhoneDigits(user?.phoneNumber, initialDigitLength);
  const [phone, setPhone] = useState(initialAccountPhone);
  const [phoneConfig, setPhoneConfig] = useState({
    phoneCode: initialPhoneCode,
    phoneNumberDigitLenth: initialDigitLength,
    defaultPhone: initialAccountPhone,
    defaultPhoneInternational: buildFullPhone(initialPhoneCode, initialAccountPhone, initialDigitLength),
    countryCode: countryConfig?.savedCountryName?.toLowerCase() === 'zambia' ? 'ZM' : '',
    verifiedPaymentNumbers: [],
  });
  const [useAlternatePhone, setUseAlternatePhone] = useState(false);
  const [verifiedNumbers, setVerifiedNumbers] = useState([]);
  const [otp, setOtp] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [paymentType, setPaymentType] = useState('mobile_money');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardFirstName, setCardFirstName] = useState(user?.firstName || '');
  const [cardLastName, setCardLastName] = useState(user?.lastName || '');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');
  const [operator, setOperator] = useState('');
  const [phase, setPhase] = useState('form');
  const [message, setMessage] = useState('');
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);
  const phoneTouchedRef = useRef(false);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const fallbackPhoneCode = String(phoneCode || countryConfig?.savedPhoneCode || '260').replace(/\D/g, '');
    const fallbackDigitLength = Number(countryConfig?.phoneNumberDigitLenth || 9);
    const accountPhone = getPhoneDigits(user?.username, fallbackDigitLength)
      || getPhoneDigits(user?.usrPhoneNormalized, fallbackDigitLength)
      || getPhoneDigits(user?.phoneNumber, fallbackDigitLength);
    const fallbackConfig = {
      phoneCode: fallbackPhoneCode,
      phoneNumberDigitLenth: fallbackDigitLength,
      defaultPhone: accountPhone,
      defaultPhoneInternational: buildFullPhone(fallbackPhoneCode, accountPhone, fallbackDigitLength),
      countryCode: countryConfig?.savedCountryName?.toLowerCase() === 'zambia' ? 'ZM' : '',
      verifiedPaymentNumbers: [],
    };

    if (!open) {
      clearInterval(pollRef.current);
      clearTimeout(timeoutRef.current);
      setPhase('form');
      setMessage('');
      setPhone(accountPhone);
      setPhoneConfig(fallbackConfig);
      setUseAlternatePhone(false);
      setVerifiedNumbers([]);
      setOtp('');
      setOtpOpen(false);
      setOtpMessage('');
      setPaymentType('mobile_money');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setCardFirstName(user?.firstName || '');
      setCardLastName(user?.lastName || '');
      setBillingStreet('');
      setBillingCity('');
      setBillingPostalCode('');
      setOperator('');
      return undefined;
    }

    phoneTouchedRef.current = false;
    setPhone(accountPhone);
    setPhoneConfig(fallbackConfig);

    let cancelled = false;
    apiClient.get('/bidz4upay/payment-phone')
      .then((result) => {
        if (cancelled) return;
        setPhoneConfig(result);
        if (!phoneTouchedRef.current) setPhone(result?.defaultPhone || accountPhone);
        setVerifiedNumbers(Array.isArray(result?.verifiedPaymentNumbers) ? result.verifiedPaymentNumbers : []);
      })
      .catch((error) => {
        console.error('Failed to load payment phone settings', error);
        if (!cancelled) setMessage('Unable to load your account phone number. Close and try again.');
      });
    return () => { cancelled = true; };
  }, [open, user?.username, user?.usrPhoneNormalized, user?.phoneNumber, countryConfig?.savedPhoneCode, countryConfig?.phoneNumberDigitLenth, countryConfig?.savedCountryName, phoneCode]);

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
  const countryCode = String(phoneConfig?.countryCode || '').toUpperCase();
  const localPhoneDigits = getPhoneDigits(phone, digitLength);

  useEffect(() => {
    if (countryCode !== 'ZM') return;
    if (/^(97|77|57)/.test(localPhoneDigits)) setOperator('airtel');
    else if (/^(96|76)/.test(localPhoneDigits)) setOperator('mtn');
    else setOperator((current) => ['airtel', 'mtn'].includes(current) ? '' : current);
  }, [countryCode, localPhoneDigits]);

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
    const isCardPayment = !isWithdrawal && paymentType === 'card';
    let verificationWindow = null;
    const walletCoversPayment = purpose === 'winnerpay' && Number(amount) <= 0;
    if (isCardPayment) {
      const [month, year] = cardExpiry.split('/');
      if (cardNumber.replace(/\D/g, '').length !== 16 || month?.length !== 2 || year?.length !== 2
        || cardCvv.length < 3 || !cardFirstName.trim() || !cardLastName.trim()
        || !billingStreet.trim() || !billingCity.trim() || !billingPostalCode.trim()) {
        setMessage('Complete the card details and billing address before continuing.');
        return;
      }
    }
    if (!isCardPayment && usesMobileMoney && !walletCoversPayment && (
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
      && (getPhoneDigits(phone, digitLength).length !== digitLength || !(operator || withdrawalDetails.operator))) {
      setMessage('Enter your withdrawal number and mobile-money operator.');
      return;
    }
    if (!isCardPayment && usesMobileMoney && !walletCoversPayment && !phoneIsVerified) {
      await requestPhoneVerification();
      return;
    }
    try {
      if (isCardPayment) {
        verificationWindow = window.open('about:blank', 'bidz4u-card-verification', 'width=600,height=700');
      }
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
          paymentType,
          ...(isCardPayment ? {
            customer: { firstName: cardFirstName.trim(), lastName: cardLastName.trim() },
            card: {
              number: cardNumber.replace(/\D/g, ''),
              expiryMonth: cardExpiry.split('/')[0],
              expiryYear: `20${cardExpiry.split('/')[1]}`,
              cvv: cardCvv,
            },
            billing: {
              streetAddress: billingStreet.trim(),
              city: billingCity.trim(),
              postalCode: billingPostalCode.trim(),
              country: (phoneConfig?.countryCode || 'ZM').toUpperCase(),
            },
            redirectUrl: `${window.location.origin}/payment/callback`,
          } : { phone: paymentPhone, operator }),
        });
      const payment = result?.data || result;
      if (!payment?.reference) {
        throw new Error('Payment was not started because no tracking reference was returned. Please try again.');
      }
      if (payment?.paymentStatus === 'completed') {
        if (verificationWindow && !verificationWindow.closed) verificationWindow.close();
        setPhase('success');
        setMessage('Payment completed successfully.');
        onSuccess?.(payment);
      } else if (payment?.paymentStatus === 'failed' || payment?.immediateFailure) {
        if (verificationWindow && !verificationWindow.closed) verificationWindow.close();
        setPhase('error');
        setMessage(payment.failureReason || 'Payment failed. Check your details and try again.');
      } else {
        if (payment?.gatewayStatus === '3ds-auth-required' && payment?.redirectUrl) {
          if (verificationWindow && !verificationWindow.closed) {
            verificationWindow.location.href = payment.redirectUrl;
          } else {
            verificationWindow = window.open(payment.redirectUrl, 'bidz4u-card-verification', 'width=600,height=700');
          }
          verificationWindow = null;
          setMessage('Complete the bank verification in the new window.');
        } else if (verificationWindow && !verificationWindow.closed) {
          verificationWindow.close();
        }
        startPolling(payment?.reference);
      }
    } catch (error) {
      if (verificationWindow && !verificationWindow.closed) verificationWindow.close();
      setPhase('error');
      setMessage(error.message || 'Unable to start payment.');
    }
  };

  return (
    <Dialog open={open} onClose={otpOpen || phase === 'submitting' || phase === 'polling' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {purpose === 'walletdeposit' ? 'Deposit to wallet' : purpose === 'withdraw' ? 'Confirm withdrawal' : 'Pay for this auction'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Amount: {currency} {Number(amount || 0).toFixed(2)}
        </Typography>
        {purpose !== 'withdraw' && !(purpose === 'winnerpay' && Number(amount) <= 0) && (phase === 'form' || phase === 'submitting') && (
          <Tabs
            value={paymentType}
            onChange={(_, value) => { setPaymentType(value); setMessage(''); }}
            variant="fullWidth"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab value="mobile_money" label="Mobile Money" />
            <Tab value="card" label="Card" />
          </Tabs>
        )}
        {purpose !== 'withdraw' && paymentType === 'mobile_money' && !(purpose === 'winnerpay' && Number(amount) <= 0) && (phase === 'form' || phase === 'submitting') && (
          <>
            <TextField
              fullWidth
              type="tel"
              label="Mobile money number"
              value={phone}
              onChange={(event) => { phoneTouchedRef.current = true; setPhone(event.target.value); }}
              InputProps={{ startAdornment: <InputAdornment position="start">+{phoneCodeDigits}</InputAdornment> }}
              sx={{ mb: 1 }}
            />
            <Button size="small" onClick={() => {
              phoneTouchedRef.current = true;
              setUseAlternatePhone((current) => !current);
              setPhone(useAlternatePhone ? (phoneConfig?.defaultPhone || '') : '');
              setOperator('');
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
        {purpose !== 'withdraw' && paymentType === 'card' && (phase === 'form' || phase === 'submitting') && (
          <Stack spacing={1.5} sx={{ maxHeight: '55vh', overflowY: 'auto', pr: 0.5 }}>
            <TextField
              fullWidth
              label="Card number"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())}
              placeholder="1234 5678 9012 3456"
              inputProps={{ inputMode: 'numeric', maxLength: 19, autoComplete: 'cc-number' }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                label="Expiry (MM/YY)"
                value={cardExpiry}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
                  setCardExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                }}
                placeholder="MM/YY"
                inputProps={{ inputMode: 'numeric', maxLength: 5, autoComplete: 'cc-exp' }}
              />
              <TextField
                label="CVV"
                value={cardCvv}
                onChange={(event) => setCardCvv(event.target.value.replace(/\D/g, '').slice(0, 4))}
                type="password"
                inputProps={{ inputMode: 'numeric', maxLength: 4, autoComplete: 'cc-csc' }}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField label="First name" value={cardFirstName} onChange={(event) => setCardFirstName(event.target.value)} autoComplete="given-name" />
              <TextField label="Last name" value={cardLastName} onChange={(event) => setCardLastName(event.target.value)} autoComplete="family-name" />
            </Box>
            <Typography variant="overline" color="text.secondary">Billing address</Typography>
            <TextField label="Street address" value={billingStreet} onChange={(event) => setBillingStreet(event.target.value)} autoComplete="address-line1" />
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1.5 }}>
              <TextField label="City" value={billingCity} onChange={(event) => setBillingCity(event.target.value)} autoComplete="address-level2" />
              <TextField label="Postal code" value={billingPostalCode} onChange={(event) => setBillingPostalCode(event.target.value)} autoComplete="postal-code" />
            </Box>
            <Alert severity="info">Card details are encrypted before they are sent to Lenco.</Alert>
          </Stack>
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
                onChange={(event) => { phoneTouchedRef.current = true; setPhone(event.target.value); }}
                InputProps={{ startAdornment: <InputAdornment position="start">+{phoneCodeDigits}</InputAdornment> }}
                sx={{ mb: 1 }}
              />
              <Button size="small" onClick={() => {
                phoneTouchedRef.current = true;
                setUseAlternatePhone((current) => !current);
                setPhone(useAlternatePhone ? (phoneConfig?.defaultPhone || '') : '');
                setOperator('');
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
        {phase === 'polling' && <Alert severity="info">{message || (paymentType === 'card' ? 'Complete the bank verification to continue.' : 'Approve the payment request on your phone.')}</Alert>}
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

      <Dialog
        open={otpOpen}
        onClose={() => !otpBusy && setOtpOpen(false)}
        fullWidth
        maxWidth="xs"
        sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
      >
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
