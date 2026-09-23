'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { apiClient } from '@/lib/api/client';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export default function Bidz4uPayModal({ open, onClose, amount, currency, relatedEntityId, phoneCode = '260', onSuccess }) {
  const [phone, setPhone] = useState('');
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
      setOperator('');
    }
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

  const submit = async () => {
    if (!phone || !operator) {
      setMessage('Enter your phone number and mobile-money operator.');
      return;
    }
    try {
      setPhase('submitting');
      setMessage('');
      const result = await apiClient.post('/bidz4upay/initiate', {
        purpose: 'winnerpay',
        amount,
        relatedEntityId,
        phone,
        operator,
      });
      startPolling(result?.data?.reference || result?.reference);
    } catch (error) {
      setPhase('error');
      setMessage(error.message || 'Unable to start payment.');
    }
  };

  return (
    <Dialog open={open} onClose={phase === 'submitting' || phase === 'polling' ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Pay for this auction</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Amount due: {currency} {Number(amount || 0).toFixed(2)}
        </Typography>
        {(phase === 'form' || phase === 'submitting') && (
          <>
            <TextField fullWidth label={`Phone (+${phoneCode})`} value={phone} onChange={(event) => setPhone(event.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth select label="Mobile-money operator" value={operator} onChange={(event) => setOperator(event.target.value)}>
              <MenuItem value="mtn">MTN</MenuItem>
              <MenuItem value="airtel">Airtel</MenuItem>
              <MenuItem value="zamtel">Zamtel</MenuItem>
            </TextField>
          </>
        )}
        {phase === 'submitting' && <CircularProgress size={24} sx={{ mt: 2 }} />}
        {phase === 'polling' && <Alert severity="info">Approve the payment request on your phone.</Alert>}
        {phase === 'success' && <Alert severity="success">{message}</Alert>}
        {phase === 'error' && <Alert severity="error">{message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={phase === 'submitting' || phase === 'polling'}>Close</Button>
        {(phase === 'form' || phase === 'error') && <Button onClick={submit} variant="contained" color="secondary">Pay now</Button>}
      </DialogActions>
    </Dialog>
  );
}
