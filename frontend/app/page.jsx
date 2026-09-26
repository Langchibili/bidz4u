'use client';
// app/page.jsx — home: redirects to login if unauthenticated, else shows the live feed.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Skeleton, Stack } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import AuctionCard from '@/components/AuctionCard';
import BottomNav from '@/components/BottomNav';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hydrated) return undefined;
    if (!isAuthenticated()) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    // AuctionCard fetches each bid count from /bids using a relation filter, so
    // the feed does not load the full bid collection for every item.
    //
    // filters[actIsDraft][$eq]=false is explicit defense-in-depth: draft
    // listings default to actAuctionStatus='scheduled' (not 'active'), so
    // the actAuctionStatus filter alone already excludes them today — but a
    // future status change to a draft (e.g. via a backend bug) shouldn't be
    // the only thing keeping drafts off the public feed.
    apiClient
      .get(
        '/auction-items?filters[actAuctionStatus][$eq]=active&filters[actIsDraft][$eq]=false&populate[actImages][fields][0]=url&populate[actImages][fields][1]=formats&populate[itemOriginCountry][fields][0]=id&populate[itemOriginCountry][fields][1]=countryName&populate[itemOriginCountry][fields][2]=countryCode&populate[itemOriginCountry][populate][currency][fields][0]=currCode&sort=createdAt:desc'
      )
      .then((res) => {
        if (!cancelled) setItems(res?.data || []);
      })
      .catch((err) => console.error('Failed to load auctions', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [hydrated, isAuthenticated, user?.id]);

  if (!hydrated) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Skeleton variant="text" width={210} height={48} />
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Skeleton variant="rounded" height={112} />
          <Skeleton variant="rounded" height={112} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Live Auctions
      </Typography>

      {loading ? (
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={112} />
          <Skeleton variant="rounded" height={112} />
          <Skeleton variant="rounded" height={112} />
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {items.map((item) => (
            <AuctionCard
              key={apiClient.resolveId(item)}
              item={item}
              // No currencySymbol prop — AuctionCard now sources currency from
              // item.actNativeCurrencyCode directly, since prices are
              // denominated per-listing, not in the viewer's own currency.
              // Default core `findOne` (GET /auction-items/:id) resolves :id as
              // documentId in Strapi v5 — apiClient.resolveId() defaults to
              // documentId, so no override needed here. See UIDTYPE_AUDIT.md.
              onClick={() => router.push(`/auction/${apiClient.resolveId(item)}`)}
            />
          ))}
        </Stack>
      )}

      {!loading && items.length === 0 && (
        <Typography color="text.secondary">No active auctions right now — check back soon.</Typography>
      )}

      <BottomNav />
    </Box>
  );
}
