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
  const [pinnedItems, setPinnedItems] = useState([]);
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
    setLoading(true);
    const loadAuctions = async () => {
      let userPinnedItems = [];
      try {
        const bidsResponse = await apiClient.get('/bids/me');
        const pinnedById = new Map();
        (bidsResponse?.bids || []).forEach((bid) => {
          const auction = bid.auctionItem;
          if (!auction || auction.actAuctionStatus !== 'active' || auction.actIsDraft) return;
          if (search && !`${auction.actTitle || ''} ${auction.actDescription || ''}`.toLowerCase().includes(search.toLowerCase())) return;
          const numericId = apiClient.resolveId(auction, 'id');
          if (numericId == null) return;
          const id = String(numericId);
          if (!pinnedById.has(id)) pinnedById.set(id, auction);
        });
        userPinnedItems = Array.from(pinnedById.values());
      } catch (err) {
        console.error('Failed to load auctions the user has bid on', err);
      }
      if (cancelled) return;
      setPinnedItems(userPinnedItems);

      const pinnedPageItems = userPinnedItems.slice((page - 1) * 10, page * 10);
      const regularSlots = 10 - pinnedPageItems.length;
      const regularStart = Math.max(0, (page - 1) * 10 - userPinnedItems.length);
      const params = new URLSearchParams({
        'filters[actAuctionStatus][$eq]': 'active',
        'filters[actIsDraft][$eq]': 'false',
        'populate[actImages][fields][0]': 'url',
        'populate[actImages][fields][1]': 'formats',
        'populate[itemOriginCountry][fields][0]': 'id',
        'populate[itemOriginCountry][fields][1]': 'countryName',
        'populate[itemOriginCountry][fields][2]': 'countryCode',
        'populate[itemOriginCountry][populate][currency][fields][0]': 'currCode',
        'pagination[start]': String(regularStart),
        'pagination[limit]': String(Math.max(1, regularSlots)),
        'pagination[withCount]': 'true',
        sort: 'createdAt:desc',
      });
      userPinnedItems.forEach((item, index) => {
        params.set(`filters[id][$notIn][${index}]`, String(apiClient.resolveId(item, 'id')));
      });
      if (search) {
        params.set('filters[$or][0][actTitle][$containsi]', search);
        params.set('filters[$or][1][actDescription][$containsi]', search);
      }

      try {
        const response = await apiClient.get(`/auction-items?${params.toString()}`);
        if (cancelled) return;
        const regularItems = Array.isArray(response?.data) ? response.data : [];
        setItems(regularItems.slice(0, regularSlots));
        const regularTotal = Number(response?.meta?.pagination?.total) || 0;
        setPageCount(Math.max(1, Math.ceil((userPinnedItems.length + regularTotal) / 10)));
      } catch (err) {
        console.error('Failed to load auctions', err);
        if (!cancelled) {
          setItems([]);
          setPageCount(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAuctions();

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
          {[...pinnedItems.slice((page - 1) * 10, page * 10), ...items].map((item) => (
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
