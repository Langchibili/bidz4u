'use client';
// app/sell/page.jsx — create a new auction listing.
//
// UPDATED for the new backend `auction-item.create` override (still the
// same permission-matrix action name "create", just custom logic behind it):
//   - `seller` is now ALWAYS forced to ctx.state.user.id server-side — the
//     earlier security gap (client-supplied seller) is resolved. This page
//     no longer sends `seller` at all.
//   - `itemOriginCountry` and `actStartingPriceNative` are now REQUIRED by
//     the controller, and `actNativeCurrencyCode` is computed automatically
//     from `itemOriginCountry`'s currency — the frontend must not send
//     actNativeCurrencyCode itself, and the "starting price" is denominated
//     in whichever country is selected below, not a fixed USD/viewer
//     currency.
//   - The controller validates itemOriginCountry via
//     `strapi.db.query('api::country.country').findOne({ where: { id } })`
//     — the raw Query Engine — so it MUST be the country's numeric id, not
//     documentId. See UIDTYPE_AUDIT.md.
//
// COUNTRY + TOWN SELECTION: a listing's country no longer silently follows
// the seller's own account country — sellers can list from any active
// country. The dropdown below defaults to the seller's own account country
// (countryConfig.countryId) but can be changed; changing it reloads the
// town options AND the currency shown on the starting-price field, since
// both are derived from whichever country is currently selected, not the
// seller's account.
//
// `country.towns` is fetched as part of the same full country list used for
// the dropdown itself (GET /countries?populate=currency, same call the
// login/signup pages already make) — no separate per-country request is
// needed, since `towns` is a plain scalar field on `country` and isn't
// excluded by that query.
//
// REMAINING GAPS:
//  1. No listing moderation/approval workflow exists in the schema
//     (`actAuctionStatus` has no "pending_review" value) — this page sets
//     status straight to 'active' on creation.
//  2. Image upload is a separate `POST /upload` call before the auction-item
//     create — the "authenticated" role needs Upload permission enabled
//     (Settings → Roles → Authenticated) in addition to Create on
//     auction-item.

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, TextField, Button, InputAdornment, CircularProgress, Alert, MenuItem,
} from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import BottomNav from '@/components/BottomNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1343/api';

const DURATION_OPTIONS = [
  { label: '6 hours', hours: 6 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
];

async function uploadImage(file, token) {
  const form = new FormData();
  form.append('files', file);
  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error('Image upload failed');
  const json = await res.json();
  // Media (upload) relations conventionally still use the file's numeric
  // `id` in most Strapi v5 codebases. See UIDTYPE_AUDIT.md.
  return json?.[0]?.id || null;
}

/**
 * `country.towns` is a plain JSON field — its exact shape isn't pinned down
 * by the schema (json accepts anything), so this normalizes whatever comes
 * back into a flat list of { value, label } pairs:
 *   - array of strings:            ["Lusaka", "Ndola"]
 *   - array of objects with name:  [{ name: "Lusaka" }, { townName: "Ndola" }]
 *   - array of objects with code:  [{ name: "Lusaka", code: "LSK" }]
 * If your actual `towns` shape doesn't match any of these, adjust this
 * function — it's the only place town-shape assumptions live.
 */
function normalizeTowns(rawTowns) {
  if (!Array.isArray(rawTowns)) return [];
  return rawTowns
    .map((t) => {
      if (typeof t === 'string') return { value: t, label: t };
      if (t && typeof t === 'object') {
        const label = t.name || t.townName || t.town || t.label || null;
        const value = t.code || label;
        return label ? { value, label } : null;
      }
      return null;
    })
    .filter(Boolean);
}

export default function SellPage() {
  const router = useRouter();
  const { user, countryConfig } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [imageFile, setImageFile] = useState(null);
  const [town, setTown] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState(''); // numeric id, matches <Select> value convention used on /login and /signup

  // Load the full country list once — same shape/call as /login and /signup,
  // so `towns` and `currency` are already present on every entry with no
  // extra request needed.
  useEffect(() => {
    apiClient
      .get('/countries?populate=currency&sort=countryName:asc')
      .then((res) => {
        const list = res?.data || [];
        setCountries(list);
        // Default to the seller's own account country, falling back to the
        // first available country if that lookup fails for any reason.
        const ownCountry = list.find((c) => c.id === countryConfig?.countryId);
        setSelectedCountryId((ownCountry || list[0])?.id || '');
      })
      .catch((err) => console.error('Failed to load countries', err))
      .finally(() => setCountriesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selectedCountryId) || null,
    [countries, selectedCountryId]
  );
  const towns = useMemo(() => normalizeTowns(selectedCountry?.towns), [selectedCountry]);
  const currencyLabel = selectedCountry?.currency?.currSymbol || selectedCountry?.currency?.currCode || '';

  // Reset the town selection whenever the country changes — a town from the
  // previous country is meaningless once a different country is selected.
  useEffect(() => {
    setTown('');
  }, [selectedCountryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !startingPrice || Number(startingPrice) <= 0) {
      setError('Enter a title and a valid starting price');
      return;
    }
    if (!selectedCountryId) {
      setError('Select a country for this listing');
      return;
    }
    if (towns.length > 0 && !town) {
      setError("Select the town you're listing from");
      return;
    }

    try {
      setSubmitting(true);

      let imageId = null;
      if (imageFile) {
        imageId = await uploadImage(imageFile, apiClient.getToken());
      }

      const now = new Date();
      const end = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      await apiClient.post('/auction-items', {
        data: {
          actTitle: title.trim(),
          actDescription: description.trim(),
          // Denominated in the SELECTED country's currency — the backend
          // computes actNativeCurrencyCode from itemOriginCountry itself,
          // so it must not be sent from here.
          actStartingPriceNative: Number(startingPrice),
          actListingTimeStart: now.toISOString(),
          actListingTimeEnd: end.toISOString(),
          actAuctionStatus: 'active',
          actTown: town || null,
          actImages: imageId ? [imageId] : [],
          // Numeric — the controller validates this against country.id via
          // the raw Query Engine before accepting the listing.
          itemOriginCountry: selectedCountryId,
          // `seller` intentionally omitted — the backend now forces it to
          // ctx.state.user.id regardless of what's sent here.
        },
      });

      setSuccess('Listing created!');
      setTitle('');
      setDescription('');
      setStartingPrice('');
      setImageFile(null);
      setTown('');
      setTimeout(() => router.push('/'), 900);
    } catch (err) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Sell an Item
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        List an item for auction — bidders start seeing it immediately.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <TextField
          select
          fullWidth
          label="Country"
          value={selectedCountryId}
          onChange={(e) => setSelectedCountryId(e.target.value)}
          disabled={countriesLoading}
          helperText={countriesLoading ? 'Loading countries…' : 'Defaults to your own account country — change it to list from elsewhere'}
        >
          {countries.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.countryName}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Town"
          value={town}
          onChange={(e) => setTown(e.target.value)}
          disabled={countriesLoading || !selectedCountryId}
          helperText={
            !countriesLoading && towns.length === 0
              ? `No towns configured for ${selectedCountry?.countryName || 'this country'} yet`
              : undefined
          }
        >
          {towns.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          type="number"
          label="Starting price"
          value={startingPrice}
          onChange={(e) => setStartingPrice(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment>,
          }}
          helperText={
            selectedCountry
              ? `Priced in ${selectedCountry.countryName}'s currency (${selectedCountry.currency?.currCode || '—'}) — bidders elsewhere see it converted automatically.`
              : undefined
          }
        />

        <TextField
          select
          fullWidth
          label="Auction duration"
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
        >
          {DURATION_OPTIONS.map((opt) => (
            <MenuItem key={opt.hours} value={opt.hours}>{opt.label}</MenuItem>
          ))}
        </TextField>

        <Button variant="outlined" component="label" sx={{ height: 56 }}>
          {imageFile ? imageFile.name : 'Upload photo'}
          <input type="file" accept="image/*" hidden onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </Button>

        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ borderRadius: 3 }}>{success}</Alert>}

        <Button type="submit" variant="contained" color="secondary" size="large" disabled={submitting} sx={{ height: 56, fontWeight: 700 }}>
          {submitting ? <CircularProgress size={24} color="inherit" /> : 'Create Listing'}
        </Button>
      </Box>

      <BottomNav />
    </Box>
  );
}