'use client';
// app/my-bids/page.jsx — GET /bids/me, grouped by status.
//
// CURRENCY NOTE: bid.bidAmountLocalSnapshot is denominated in
// bid.bidLocalCurrencyCode — the currency the bidder actually typed the
// amount in AT THE TIME OF THAT BID — which is more historically accurate
// than assuming it still matches the viewer's current countryConfig (e.g.
// if they've since changed country, or the amount was converted from a
// listing in a different currency). Each row now formats using its own
// bid.bidLocalCurrencyCode rather than a single page-wide currency.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Skeleton, Stack, Chip, Pagination } from '@mui/material';
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
  const { isAuthenticated, hydrated } = useAuth();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated()) return undefined;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get(`/bids/me?page=${page}&pageSize=10`)
      .then((res) => {
        if (cancelled) return;
        setBids(res?.bids || []);
        setPageCount(Math.max(1, Number(res?.meta?.pagination?.pageCount) || 1));
        setTotal(Number(res?.meta?.pagination?.total) || 0);
      })
      .catch((err) => console.error('Failed to load bids', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hydrated, isAuthenticated, page]);

  if (!hydrated || loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Skeleton variant="text" width={160} height={48} />
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Skeleton variant="rounded" height={76} />
          <Skeleton variant="rounded" height={76} />
          <Skeleton variant="rounded" height={76} />
        </Stack>
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
            key={apiClient.resolveId(bid)}
            onClick={() => {
              // Default core `findOne` route resolves :id as documentId —
              // apiClient.resolveId(bid.auctionItem) defaults to documentId,
              // matching the auction detail page's own fetch. See
              // UIDTYPE_AUDIT.md — this is unrelated to bid.place's numeric
              // requirement, which only applies inside that one controller.
              const docId = apiClient.resolveId(bid.auctionItem);
              if (docId) router.push(`/auction/${docId}`);
            }}
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
                {formatCurrency(bid.bidAmountLocalSnapshot, bid.bidLocalCurrencyCode)}
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

      {total > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>{total} total bids</Typography>}

      {pageCount > 1 && (
        <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="secondary" sx={{ mt: 3, display: 'flex', justifyContent: 'center' }} />
      )}

      <BottomNav />
    </Box>
  );
}
