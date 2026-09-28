'use client';
// app/page.jsx — home: redirects to login if unauthenticated, else shows the live feed.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Skeleton, Stack, TextField, InputAdornment, Pagination } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import AuctionCard from '@/components/AuctionCard';
import BottomNav from '@/components/BottomNav';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchText]);

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
    const params = new URLSearchParams({
      'filters[actAuctionStatus][$eq]': 'active',
      'filters[actIsDraft][$eq]': 'false',
      'populate[actImages][fields][0]': 'url',
      'populate[actImages][fields][1]': 'formats',
      'populate[itemOriginCountry][fields][0]': 'id',
      'populate[itemOriginCountry][fields][1]': 'countryName',
      'populate[itemOriginCountry][fields][2]': 'countryCode',
      'populate[itemOriginCountry][populate][currency][fields][0]': 'currCode',
      'pagination[page]': String(page),
      'pagination[pageSize]': '10',
      sort: 'createdAt:desc',
    });
    if (search) {
      params.set('filters[$or][0][actTitle][$containsi]', search);
      params.set('filters[$or][1][actDescription][$containsi]', search);
    }

    setLoading(true);
    apiClient
      .get(`/auction-items?${params.toString()}`)
      .then((res) => {
        if (!cancelled) {
          setItems(Array.isArray(res?.data) ? res.data : []);
          setPageCount(Math.max(1, Number(res?.meta?.pagination?.pageCount) || 1));
        }
      })
      .catch((err) => {
        console.error('Failed to load auctions', err);
        if (!cancelled) {
          setItems([]);
          setPageCount(1);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [hydrated, isAuthenticated, user?.id, page, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

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

      <TextField
        fullWidth
        value={searchText}
        onChange={(event) => {
          setSearchText(event.target.value);
          setPage(1);
        }}
        placeholder="Search auction titles and descriptions"
        aria-label="Search auctions"
        sx={{ mb: 2.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon aria-hidden="true" />
            </InputAdornment>
          ),
        }}
      />

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
        <Typography color="text.secondary">
          {search ? 'No auctions match your search.' : 'No active auctions right now — check back soon.'}
        </Typography>
      )}

      {!loading && items.length > 0 && (
        <Pagination
          count={pageCount}
          page={page}
          onChange={(_, nextPage) => setPage(nextPage)}
          color="secondary"
          aria-label="Auction pages"
          sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}
        />
      )}

      <BottomNav />
    </Box>
  );
}
