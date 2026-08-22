'use client';
// app/profile/page.jsx — account info, KYC status, country/currency, logout.
//
// SCHEMA NOTE: there's no profile-edit endpoint in anything you've shared
// (no PUT /users/me route, no dedicated "update my profile" controller) —
// this page is read-only + logout for now. Editing name/email would need
// either enabling the default PUT /users/:id for the "authenticated" role
// (with an ownership check you'd have to add) or a small custom controller.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Button, Chip, Stack, Divider } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';

export default function ProfilePage() {
  const router = useRouter();
  const { user, hydrated, isAuthenticated, countryConfig, logout } = useAuth();

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="secondary" />
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

      <Stack spacing={1.5}>
        <Row label="Country" value={countryConfig?.savedCountryName || '—'} />
        <Row label="Currency" value={`${countryConfig?.savedCurrencyCode || '—'} (${countryConfig?.savedCurrencySymbol || ''})`} />
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
