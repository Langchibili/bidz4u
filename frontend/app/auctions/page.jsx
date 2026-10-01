'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, InputAdornment, MenuItem, Pagination, Skeleton, Stack,
  Switch, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, getMediaUrl } from '@/Functions';
import { useAuth } from '@/lib/contexts/AuthContext';
import { STORAGE_KEYS } from '@/Constants';
import BottomNav from '@/components/BottomNav';
import ShareAuctionButton from '@/components/ShareAuctionButton';

const PAGE_SIZE = 10;

export default function AuctionsPage() {
  const router = useRouter();
  const { countryConfig, hydrated, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [town, setTown] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [endingWithinHours, setEndingWithinHours] = useState('');
  const [sort, setSort] = useState('bids_desc');
  const [preferredCountryId, setPreferredCountryId] = useState('');
  const [switchCountryOpen, setSwitchCountryOpen] = useState(false);
  const [pendingPreferredCountryId, setPendingPreferredCountryId] = useState('');
  const [noPriceOnly, setNoPriceOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login?redirect=/auctions');
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated()) return undefined;
    let cancelled = false;
    Promise.all([
      apiClient.get('/categories?sort=name:asc&pagination[pageSize]=100'),
      apiClient.get('/countries?sort=countryName:asc&pagination[pageSize]=250'),
    ]).then(([categoryResponse, countryResponse]) => {
      if (cancelled) return;
      setCategories(Array.isArray(categoryResponse?.data) ? categoryResponse.data : []);
      setCountries(Array.isArray(countryResponse?.data) ? countryResponse.data : []);
    }).catch((loadError) => console.error('Failed to load marketplace filters', loadError));
    return () => { cancelled = true; };
  }, [hydrated, isAuthenticated]);

  useEffect(() => {
    if (!hydrated) return;
    const saved = localStorage.getItem(STORAGE_KEYS.PREFERRED_LISTING_COUNTRY);
    const preferred = saved || String(countryConfig?.countryId || '');
    setPreferredCountryId(preferred);
    setPendingPreferredCountryId(preferred);
  }, [hydrated, countryConfig?.countryId]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated()) return undefined;
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      preferredCountryId: String(preferredCountryId || countryConfig?.countryId || ''),
      sort,
    });
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    if (countryId) params.set('countryId', countryId);
    if (town.trim()) params.set('town', town.trim());
    if (minPrice !== '') params.set('minPrice', minPrice);
    if (maxPrice !== '') params.set('maxPrice', maxPrice);
    if (endingWithinHours) params.set('endingWithinHours', endingWithinHours);
    if (noPriceOnly) params.set('noPrice', 'true');

    setLoading(true);
    setError('');
    apiClient.get(`/auction-items/marketplace?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setItems(Array.isArray(response?.data) ? response.data : []);
        const pagination = response?.meta?.pagination || {};
        setTotal(Number(pagination.total) || 0);
        setPageCount(Math.max(1, Number(pagination.pageCount) || 1));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setPageCount(1);
        setError(loadError.message || 'Unable to load auctions.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hydrated, isAuthenticated, countryConfig?.countryId, preferredCountryId, page, search, categoryId, countryId, town, minPrice, maxPrice, endingWithinHours, sort, noPriceOnly]);

  useEffect(() => { setPage(1); }, [search, categoryId, countryId, town, minPrice, maxPrice, endingWithinHours, sort, noPriceOnly]);

  const imageFor = (item) => item.actImages?.[0]?.formats?.medium?.url
    || item.actImages?.[0]?.formats?.thumbnail?.url
    || item.actImages?.[0]?.url;
  const preferredCountry = countries.find((country) => String(country.id) === String(preferredCountryId))
    || countries.find((country) => String(country.id) === String(countryConfig?.countryId));
  const townCountry = countries.find((country) => String(country.id) === String(countryId || preferredCountryId));
  const towns = Array.isArray(townCountry?.towns)
    ? townCountry.towns.map((entry) => {
      if (typeof entry === 'string') return { value: entry, label: entry };
      const label = entry?.name || entry?.townName || entry?.town || entry?.label;
      return label ? { value: entry?.code || label, label } : null;
    }).filter(Boolean)
    : [];

  const savePreferredCountry = () => {
    if (pendingPreferredCountryId) {
      localStorage.setItem(STORAGE_KEYS.PREFERRED_LISTING_COUNTRY, pendingPreferredCountryId);
      setPreferredCountryId(pendingPreferredCountryId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.PREFERRED_LISTING_COUNTRY);
      setPreferredCountryId(String(countryConfig?.countryId || ''));
    }
    setPage(1);
    setSwitchCountryOpen(false);
  };

  if (!hydrated) {
    return (
      <Box sx={{ minHeight: '100vh', p: 2.5, bgcolor: 'background.default' }}>
        <Skeleton width={190} height={42} />
        <Skeleton variant="rounded" height={56} sx={{ my: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
          {Array.from({ length: PAGE_SIZE }).map((_, index) => <Skeleton key={index} variant="rounded" height={220} />)}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 3 }, pb: 10, maxWidth: 1280, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>All Auctions</Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Your country: {preferredCountry?.countryName || countryConfig?.savedCountryName || 'Not set'}
        </Typography>
        <Button size="small" onClick={() => setSwitchCountryOpen(true)} sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}>
          Switch country
        </Button>
      </Stack>

      <TextField
        fullWidth
        value={searchText}
        onChange={(event) => { setSearchText(event.target.value); setPage(1); }}
        placeholder="Search titles, descriptions, or categories"
        aria-label="Search auctions by title, description, or category"
        sx={{ mb: 1.5 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.25, mb: 1.5 }}>
        <TextField select size="small" label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <MenuItem value="">All categories</MenuItem>
          {categories.map((category) => <MenuItem key={category.id} value={String(category.id)}>{category.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Country" value={countryId} onChange={(event) => setCountryId(event.target.value)}>
          <MenuItem value="">All countries</MenuItem>
          {countries.map((country) => <MenuItem key={country.id} value={String(country.id)}>{country.countryName}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Town" value={town} onChange={(event) => setTown(event.target.value)} disabled={!towns.length}>
          <MenuItem value="">All towns</MenuItem>
          {towns.map((entry) => <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)}>
          <MenuItem value="newest">Newest</MenuItem>
          <MenuItem value="bids_desc">Most bids</MenuItem>
          <MenuItem value="bids_asc">Fewest bids</MenuItem>
          <MenuItem value="ending_soon">Ending soon</MenuItem>
          <MenuItem value="price_asc">Price: low to high</MenuItem>
          <MenuItem value="price_desc">Price: high to low</MenuItem>
        </TextField>
        <TextField size="small" type="number" label="Min price (listing currency)" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputProps={{ min: 0 }} />
        <TextField size="small" type="number" label="Max price (listing currency)" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputProps={{ min: 0 }} />
        <TextField select size="small" label="Ending within" value={endingWithinHours} onChange={(event) => setEndingWithinHours(event.target.value)}>
          <MenuItem value="">Any time</MenuItem>
          <MenuItem value="1">1 hour</MenuItem>
          <MenuItem value="6">6 hours</MenuItem>
          <MenuItem value="24">24 hours</MenuItem>
          <MenuItem value="72">3 days</MenuItem>
        </TextField>
        <FormControlLabel
          control={<Switch checked={noPriceOnly} onChange={(event) => setNoPriceOnly(event.target.checked)} color="secondary" />}
          label={<Typography variant="body2">No starting price</Typography>}
          sx={{ ml: 0 }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>{total} active auction{total === 1 ? '' : 's'}</Typography>}

      {loading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 165px), 1fr))', gap: 1.5 }}>
          {Array.from({ length: PAGE_SIZE }).map((_, index) => <Skeleton key={index} variant="rounded" height={235} />)}
        </Box>
      ) : items.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 165px), 1fr))', gap: 1.5 }}>
          {items.map((item) => {
            const image = imageFor(item);
            return (
              <Box
                key={apiClient.resolveId(item)}
                sx={{ minWidth: 0, position: 'relative' }}
              >
                <Box
                  component="button"
                  onClick={() => router.push(`/auction/${apiClient.resolveId(item)}`)}
                  sx={{ width: '100%', minWidth: 0, p: 1, textAlign: 'left', color: 'text.primary', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, cursor: 'pointer', '&:hover': { borderColor: 'secondary.main' } }}
                >
                  <Box sx={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 1, mb: 1, bgcolor: 'action.hover', backgroundImage: image ? `url(${getMediaUrl(image)})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 750, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 40 }}>{item.actTitle}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, mt: 0.5, color: 'secondary.main' }}>
                    {item.noPrice && Number(item.actCurrentHighestPriceNative || 0) <= 0
                      ? 'No price set'
                      : formatCurrency(item.actCurrentHighestPriceNative || item.actStartingPriceNative, item.actNativeCurrencyCode)}
                  </Typography>
                  <Chip size="small" label={item.category?.name || 'Uncategorized'} sx={{ mt: 1, maxWidth: '100%' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[item.actTown, item.itemOriginCountry?.countryName].filter(Boolean).join(', ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Ends {new Date(item.actListingTimeEnd).toLocaleDateString()}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.bidCount || 0} bid{Number(item.bidCount) === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <ShareAuctionButton item={item} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }} />
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography color="text.secondary">No auctions match these filters.</Typography>
      )}

      {!loading && pageCount > 1 && (
        <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="secondary" sx={{ mt: 3, display: 'flex', justifyContent: 'center' }} />
      )}
      <Button onClick={() => router.push('/')} sx={{ mt: 2 }}>Back to live auctions</Button>
      <Dialog open={switchCountryOpen} onClose={() => setSwitchCountryOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Switch preferred country</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Show this country first"
            value={pendingPreferredCountryId}
            onChange={(event) => setPendingPreferredCountryId(event.target.value)}
            sx={{ mt: 1 }}
          >
            <MenuItem value="">My account country ({countryConfig?.savedCountryName || 'default'})</MenuItem>
            {countries.map((country) => <MenuItem key={country.id} value={String(country.id)}>{country.countryName}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwitchCountryOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={savePreferredCountry}>Apply</Button>
        </DialogActions>
      </Dialog>
      <BottomNav />
    </Box>
  );
}