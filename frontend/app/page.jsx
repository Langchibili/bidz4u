'use client';
// app/page.jsx — home: redirects to login if unauthenticated, else shows the live feed.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Skeleton, Stack, TextField, InputAdornment, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { STORAGE_KEYS } from '@/Constants';
import AuctionCard from '@/components/AuctionCard';
import NotificationInbox from '@/components/NotificationInbox';
import BottomNav from '@/components/BottomNav';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user, countryConfig } = useAuth();
  const [items, setItems] = useState([]);
  const [pinnedItems, setPinnedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [activeCount, setActiveCount] = useState(0);
  const [preferredListingCountryId, setPreferredListingCountryId] = useState('');

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
    if (!hydrated) return;
    const storedCountryId = localStorage.getItem(STORAGE_KEYS.PREFERRED_LISTING_COUNTRY);
    setPreferredListingCountryId(storedCountryId || String(countryConfig?.countryId || ''));
  }, [hydrated, countryConfig?.countryId]);

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
      const [bidsResult, countResult] = await Promise.allSettled([
        apiClient.get('/bids/me/active-auctions'),
        apiClient.get('/auction-items?filters[actAuctionStatus][$eq]=active&filters[actIsDraft][$eq]=false&fields[0]=id&pagination[pageSize]=1'),
      ]);
      if (countResult.status === 'fulfilled') {
        setActiveCount(Number(countResult.value?.meta?.pagination?.total) || 0);
      }
      try {
        if (bidsResult.status !== 'fulfilled') throw bidsResult.reason;
        const bidsResponse = bidsResult.value;
        const pinnedById = new Map();
        (bidsResponse?.bids || []).forEach((bid) => {
          const auction = bid.auctionItem;
          if (!auction || auction.actAuctionStatus !== 'active' || auction.actIsDraft) return;
          if (search && !`${auction.actTitle || ''} ${auction.actDescription || ''} ${auction.category?.name || ''}`.toLowerCase().includes(search.toLowerCase())) return;
          const numericId = apiClient.resolveId(auction, 'id');
          if (numericId == null) return;
          const id = String(numericId);
          if (!pinnedById.has(id)) pinnedById.set(id, auction);
        });
        const preferredCountryId = preferredListingCountryId || String(countryConfig?.countryId || '');
        const preferred = [];
        const otherCountries = [];
        Array.from(pinnedById.values()).forEach((auction) => {
          if (String(apiClient.resolveId(auction.itemOriginCountry, 'id')) === preferredCountryId) preferred.push(auction);
          else otherCountries.push(auction);
        });
        const mostBidsFirst = (left, right) => Number(right.bidCount || 0) - Number(left.bidCount || 0);
        preferred.sort(mostBidsFirst);
        otherCountries.sort(mostBidsFirst);
        userPinnedItems = [...preferred, ...otherCountries];
      } catch (err) {
        console.error('Failed to load auctions the user has bid on', err);
      }
      if (cancelled) return;
      setPinnedItems(userPinnedItems);

      const pinnedHomeItems = userPinnedItems.slice(0, 2);
      const regularSlots = Math.max(0, 2 - pinnedHomeItems.length);
      const params = new URLSearchParams({
        page: '1',
        pageSize: '2',
        start: '0',
        preferredCountryId: preferredListingCountryId || String(countryConfig?.countryId || ''),
        excludeIds: userPinnedItems.map((item) => apiClient.resolveId(item, 'id')).join(','),
        sort: 'bids_desc',
      });
      if (search) params.set('search', search);

      try {
        if (regularSlots > 0) {
          const response = await apiClient.get(`/auction-items/marketplace?${params.toString()}`);
          if (cancelled) return;
          setItems((Array.isArray(response?.data) ? response.data : []).slice(0, regularSlots));
        } else if (!cancelled) {
          setItems([]);
        }
      } catch (err) {
        console.error('Failed to load auctions', err);
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAuctions();

    return () => { cancelled = true; };
  }, [hydrated, isAuthenticated, user?.id, countryConfig?.countryId, preferredListingCountryId, search]);

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

  const visibleItems = [...pinnedItems.slice(0, 2), ...items].slice(0, 2);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0 }}>
          Live Auctions
        </Typography>
        <NotificationInbox />
      </Box>

      <TextField
        fullWidth
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
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
          {visibleItems.map((item) => (
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

      {!loading && visibleItems.length === 0 && (
        <Typography color="text.secondary">
          {search ? 'No auctions match your search.' : 'No active auctions right now — check back soon.'}
        </Typography>
      )}

      {countryConfig?.savedCountryName && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Your country: {countryConfig.savedCountryName}
        </Typography>
      )}
      <Button fullWidth variant="text" color="secondary" onClick={() => router.push('/auctions')} sx={{ mt: 1, minHeight: 44, border: 0 }}>
        View all auctions ({activeCount})
      </Button>

      <BottomNav />
    </Box>
  );
}
