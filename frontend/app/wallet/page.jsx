'use client';
// app/wallet/page.jsx
//
// Wallet screen: available + escrow balance, deposit (POST /bidz4upay/initiate,
// purpose=walletdeposit), withdrawal (POST /bidz4upay/request-withdrawal), and
// recent transaction history (GET /transactions/me).
//
// SCHEMA NOTE: mobile-money withdrawal/deposit needs a `phone` + `operator`
// pair, but there's no enumerated list of valid `operator` values anywhere in
// the schema/backend you shared (pawapay/lenco each expect specific network
// codes, e.g. MTN_MOMO_ZMB — see their docs). Left as free text for now;
// swap for a <Select> once you confirm the operator codes your gateway needs.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, CircularProgress, Button, TextField, Alert,
  Tabs, Tab, InputAdornment, Chip, Stack, Divider,
} from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { formatCurrency } from '@/Functions';
import BottomNav from '@/components/BottomNav';

export default function WalletPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, countryConfig } = useAuth();
  const currencySymbol = countryConfig?.savedCurrencySymbol || 'ZK';

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0); // 0 = deposit, 1 = withdraw

  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankId, setBankId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  const loadWallet = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        apiClient.get('/wallets/me'),
        apiClient.get('/transactions/me'),
      ]);
      setWallet(walletRes?.wallet || null);
      setTransactions(txRes?.transactions || []);
    } catch (err) {
      console.error('Failed to load wallet', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleDeposit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (!amount || Number(amount) <= 0) {
      setFeedback({ type: 'error', message: 'Enter a valid amount' });
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.post('/bidz4upay/initiate', {
        purpose: 'walletdeposit',
        amount,
        phone,
        operator,
      });
      setFeedback({ type: 'success', message: 'Deposit initiated — approve the prompt on your phone.' });
      setAmount('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to initiate deposit' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (!amount || Number(amount) <= 0) {
      setFeedback({ type: 'error', message: 'Enter a valid amount' });
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.post('/bidz4upay/request-withdrawal', {
        amount,
        method,
        ...(method === 'mobile_money' ? { phone, operator } : { accountNumber, bankId, accountName }),
      });
      setFeedback({ type: 'success', message: 'Withdrawal requested — processing.' });
      setAmount('');
      loadWallet();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to request withdrawal' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated || loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Wallet
      </Typography>

      <Box
        sx={{
          borderRadius: 3,
          p: 3,
          mb: 3,
          bgcolor: 'background.paper',
          boxShadow: '0px 8px 32px rgba(0,0,0,0.5), inset 0px 1px 2px rgba(255,255,255,0.05)',
        }}
      >
        <Typography variant="caption" color="text.secondary">Available Balance</Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, color: 'secondary.main', mb: 1 }}>
          {formatCurrency(wallet?.wltAvailableBalance, currencySymbol)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Locked in escrow: {formatCurrency(wallet?.wltLockedEscrowBalance, currencySymbol)}
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setFeedback(null); }}
        sx={{ mb: 2 }}
        textColor="secondary"
        indicatorColor="secondary"
      >
        <Tab label="Deposit" />
        <Tab label="Withdraw" />
      </Tabs>

      {feedback && (
        <Alert severity={feedback.type} sx={{ mb: 2, borderRadius: 3 }}>
          {feedback.message}
        </Alert>
      )}

      {tab === 0 && (
        <Box component="form" onSubmit={handleDeposit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          <TextField
            fullWidth
            type="number"
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment> }}
          />
          <TextField fullWidth label="Mobile money number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField fullWidth label="Network / operator" value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="e.g. MTN, Airtel" />
          <Button type="submit" variant="contained" color="secondary" size="large" disabled={submitting} sx={{ height: 56, fontWeight: 700 }}>
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Deposit'}
          </Button>
        </Box>
      )}

      {tab === 1 && (
        <Box component="form" onSubmit={handleWithdraw} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          <TextField
            fullWidth
            type="number"
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment> }}
          />
          <Tabs value={method} onChange={(_, v) => setMethod(v)} textColor="secondary" indicatorColor="secondary">
            <Tab label="Mobile Money" value="mobile_money" />
            <Tab label="Bank Account" value="bank_account" />
          </Tabs>
          {method === 'mobile_money' ? (
            <>
              <TextField fullWidth label="Mobile money number" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField fullWidth label="Network / operator" value={operator} onChange={(e) => setOperator(e.target.value)} />
            </>
          ) : (
            <>
              <TextField fullWidth label="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              <TextField fullWidth label="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              <TextField fullWidth label="Bank" value={bankId} onChange={(e) => setBankId(e.target.value)} />
            </>
          )}
          <Button type="submit" variant="contained" color="secondary" size="large" disabled={submitting} sx={{ height: 56, fontWeight: 700 }}>
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Request Withdrawal'}
          </Button>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Recent Transactions
      </Typography>
      <Stack spacing={1}>
        {transactions.map((tx) => (
          <Box
            key={tx.id}
            sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              p: 1.5, borderRadius: 2, bgcolor: 'background.paper',
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                {tx.txType?.replace('_', ' ')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(tx.createdAt).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatCurrency(tx.txAmount, currencySymbol)}
              </Typography>
              <Chip
                size="small"
                label={tx.txStatus}
                sx={{ height: 18, fontSize: 10, textTransform: 'uppercase' }}
                color={tx.txStatus === 'completed' ? 'success' : tx.txStatus === 'failed' ? 'error' : 'default'}
              />
            </Box>
          </Box>
        ))}
        {transactions.length === 0 && (
          <Typography variant="body2" color="text.secondary">No transactions yet.</Typography>
        )}
      </Stack>

      <BottomNav />
    </Box>
  );
}
