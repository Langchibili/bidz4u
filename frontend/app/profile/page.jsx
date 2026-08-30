'use client';
// app/profile/page.jsx — account info, KYC status, country/currency, logout,
// and the seller's own non-draft listings (with Edit access).
//
// SCHEMA NOTE: there's no profile-edit endpoint in anything you've shared
// (no PUT /users/me route, no dedicated "update my profile" controller) —
// the account-info section is read-only + logout for now. Editing name/
// email would need either enabling the default PUT /users/:id for the
// "authenticated" role (with an ownership check you'd have to add) or a
// small custom controller.
//
// "My Listings" is the entry point into the /sell?editId=... edit flow —
// see app/sell/page.jsx's file header for the full edit-mode writeup.
// Editable listings are those NOT in ['active', 'sold', 'payment_pending']
// (that gate is enforced again server-side... actually client-side in
// /sell itself, since there's no dedicated backend check for it — see the
// gap noted there); this page just reflects the same rule when deciding
// whether to show an "Edit" button per row.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Button, Chip, Stack, Divider } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, getMediaUrl } from '@/Functions';
import BottomNav from '@/components/BottomNav';

const EXCLUDED_EDIT_STATUSES = ['active', 'sold', 'payment_pending'];

export default function ProfilePage() {
  const router = useRouter();
  const { user, hydrated, isAuthenticated, countryConfig, logout } = useAuth();
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    const numericUserId = apiClient.resolveId(user, 'id');
    apiClient
      .get(
        `/auction-items?filters[seller][id][$eq]=${numericUserId}&filters[actIsDraft][$eq]=false&sort=updatedAt:desc&populate[actImages][fields][0]=url`
      )
      .then((res) => setListings(res?.data || []))
      .catch((err) => console.error('Failed to load my listings', err))
      .finally(() => setListingsLoading(false));
  }, [user]);

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

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        My Listings
      </Typography>

      {listingsLoading ? (
        <CircularProgress size={20} color="secondary" />
      ) : (
        <Stack spacing={1.5}>
          {listings.map((item) => {
            const editable = !EXCLUDED_EDIT_STATUSES.includes(item.actAuctionStatus);
            const thumb = item.actImages?.[0]?.url;
            return (
              <Box
                key={apiClient.resolveId(item)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2.5,
                  bgcolor: 'background.paper', boxShadow: '0px 4px 16px rgba(0,0,0,0.35)',
                }}
              >
                <Box
                  sx={{
                    width: 48, height: 48, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(148,163,184,0.08)',
                    backgroundImage: thumb ? `url(${getMediaUrl(thumb)})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.actTitle}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatCurrency(item.actCurrentHighestPriceNative, item.actNativeCurrencyCode)} · {item.actAuctionStatus}
                  </Typography>
                </Box>
                {editable ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => router.push(`/sell?editId=${apiClient.resolveId(item)}`)}
                    sx={{ flexShrink: 0 }}
                  >
                    Edit
                  </Button>
                ) : (
                  <Chip size="small" label="Locked" sx={{ height: 22, fontSize: 10, flexShrink: 0 }} />
                )}
              </Box>
            );
          })}
          {listings.length === 0 && (
            <Typography variant="body2" color="text.secondary">No listings yet.</Typography>
          )}
        </Stack>
      )}

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
