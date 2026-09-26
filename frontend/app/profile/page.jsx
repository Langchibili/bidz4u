'use client';
// app/profile/page.jsx — account info, KYC status, wallet balance, and logout.
//
// SCHEMA NOTE: there's no profile-edit endpoint in anything you've shared
// (no PUT /users/me route, no dedicated "update my profile" controller) —
// the account-info section is read-only + logout for now. Editing name/
// email would need either enabling the default PUT /users/:id for the
// "authenticated" role (with an ownership check you'd have to add) or a
// small custom controller.
//
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Skeleton, Button, Chip, Stack, Divider } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, getCurrencySymbol } from '@/Functions';
import { useViewerCurrencyRate } from '@/lib/hooks/useSocket';
import BottomNav from '@/components/BottomNav';

export default function ProfilePage() {
  const router = useRouter();
  const { user, hydrated, isAuthenticated, countryConfig, effectiveSettings, logout } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [settingsBaseCurrency, setSettingsBaseCurrency] = useState(null);
  const savedCurrencyCode = countryConfig?.savedCurrencyCode;
  const profileCurrencyCode = effectiveSettings?._userCurrency || savedCurrencyCode;
  const profileCurrencySymbol = profileCurrencyCode === savedCurrencyCode
    ? countryConfig?.savedCurrencySymbol || profileCurrencyCode || ''
    : getCurrencySymbol(profileCurrencyCode);
  const { rate: walletRate, isReady: isWalletPriceReady } = useViewerCurrencyRate(
    wallet?.currency?.currCode === profileCurrencyCode
      ? profileCurrencyCode
      : settingsBaseCurrency || effectiveSettings?._settingsBaseCurrency || profileCurrencyCode,
    profileCurrencyCode
  );

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiClient
      .get('/wallets/me')
      .then((res) => {
        if (!cancelled) {
          setWallet(res?.wallet || null);
          setSettingsBaseCurrency(res?.settingsBaseCurrency || null);
        }
      })
      .catch((err) => console.error('Failed to load wallet balance', err))
      .finally(() => {
        if (!cancelled) setWalletLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!hydrated || !user) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Skeleton variant="text" width={180} height={48} />
        <Skeleton variant="rounded" height={132} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Profile
      </Typography>

      <Box
        sx={{
          borderRadius: 3, p: 3, mb: 3, bgcolor: 'background.paper',
          boxShadow: '0px 8px 32px rgba(0,0,0,0.5), inset 0px 1px 2px rgba(255,255,255,0.05)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {user.usrFullName || 'Bidz4u User'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {user.username}
        </Typography>
        <Chip
          size="small"
          label={user.usrKycVerified ? 'KYC Verified' : 'KYC Not Verified'}
          color={user.usrKycVerified ? 'success' : 'default'}
        />
      </Box>

      <Box
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          bgcolor: 'background.paper',
          borderLeft: '4px solid',
          borderColor: 'secondary.main',
          boxShadow: '0px 8px 32px rgba(0,0,0,0.35)',
        }}
      >
        <Typography variant="caption" color="text.secondary">Wallet balance</Typography>
        {walletLoading || !isWalletPriceReady ? (
          <Skeleton variant="text" width={190} height={42} />
        ) : (
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'secondary.main' }}>
            {formatCurrency(Number(wallet?.wltAvailableBalance || 0) * walletRate, profileCurrencySymbol)}
          </Typography>
        )}
        <Button size="small" color="secondary" onClick={() => router.push('/wallet')} sx={{ px: 0, minWidth: 0 }}>
          View more
        </Button>
      </Box>

      <Stack spacing={1.5}>
        <Row label="Country" value={countryConfig?.savedCountryName || '—'} />
        <Row label="Currency" value={`${profileCurrencyCode || '—'} (${profileCurrencySymbol})`} />
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Button
        fullWidth
        variant="outlined"
        color="error"
        size="large"
        onClick={logout}
        sx={{ height: 56 }}
      >
        Log Out
      </Button>

      <BottomNav />
    </Box>
  );
}

function Row({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
