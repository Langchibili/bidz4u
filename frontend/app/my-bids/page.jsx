'use client';
// app/my-bids/page.jsx — GET /bids/me, grouped by status.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Stack, Chip } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { formatCurrency } from '@/Functions';
import BottomNav from '@/components/BottomNav';

const STATUS_COLOR = {
  active_leading: 'success',
  outbid_refunded: 'default',
  won_complete: 'secondary',
  won_forfeited: 'error',
};

const STATUS_LABEL = {
  active_leading: 'Leading',
  outbid_refunded: 'Outbid',
  won_complete: 'Won',
  won_forfeited: 'Forfeited',
};

export default function MyBidsPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, countryConfig } = useAuth();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    apiClient
      .get('/bids/me')
      .then((res) => setBids(res?.bids || []))
      .catch((err) => console.error('Failed to load bids', err))
      .finally(() => setLoading(false));
  }, []);

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
        My Bids
      </Typography>

      <Stack spacing={1.5}>
        {bids.map((bid) => (
          <Box
            key={bid.id}
            onClick={() => bid.auctionItem?.id && router.push(`/auction/${bid.auctionItem.id}`)}
            sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              p: 2, borderRadius: 3, cursor: 'pointer', bgcolor: 'background.paper',
              boxShadow: '0px 8px 32px rgba(0,0,0,0.5), inset 0px 1px 2px rgba(255,255,255,0.05)',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bid.auctionItem?.actTitle || 'Auction item'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(bid.createdAt).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatCurrency(bid.bidAmountLocalSnapshot, countryConfig?.savedCurrencySymbol)}
              </Typography>
              <Chip
                size="small"
                label={STATUS_LABEL[bid.bidStatus] || bid.bidStatus}
                color={STATUS_COLOR[bid.bidStatus] || 'default'}
                sx={{ height: 18, fontSize: 10, mt: 0.5 }}
              />
            </Box>
          </Box>
        ))}
        {bids.length === 0 && (
          <Typography color="text.secondary">You haven&apos;t placed any bids yet.</Typography>
        )}
      </Stack>

      <BottomNav />
    </Box>
  );
}
