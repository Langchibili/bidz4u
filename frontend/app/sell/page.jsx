'use client';
// app/sell/page.jsx — create a new auction listing.
//
// SCHEMA / BACKEND GAPS worth knowing about (see bottom of file too):
//  1. There is no dedicated "create listing" controller — auction-item uses
//     Strapi's default core router (`factories.createCoreRouter`). That means:
//       - `seller` is NOT auto-set to the logged-in user; this page sends it
//         explicitly as `user.id`. A malicious client could pass a different
//         seller id — you'll want a custom `create` override that forces
//         `seller: ctx.state.user.id` server-side before this goes live.
//       - The "authenticated" role needs Create permission enabled on
//         auction-item in Strapi admin (Settings → Roles → Authenticated),
//         which isn't in any file you've shared — it's an admin-panel toggle.
//  2. No listing moderation/approval workflow exists in the schema
//     (`actAuctionStatus` has no "pending_review" value) — this page sets
//     status straight to 'active' on creation. If you want approval before
//     going live, that's a schema + admin workflow addition.
//  3. Image upload is a separate `POST /upload` call before the auction-item
//     create — the "authenticated" role also needs Upload permission enabled.

import { useState } from 'react';
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
  return json?.[0]?.id || null;
}

export default function SellPage() {
  const router = useRouter();
  const { user, countryConfig } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim() || !startingPrice || Number(startingPrice) <= 0) {
      setError('Enter a title and a valid starting price');
      return;
    }
    if (!countryConfig?.countryId) {
      setError('Missing country context — please log out and back in');
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
          actStartingPriceUsd: Number(startingPrice),
          actCurrentHighestPriceUsd: Number(startingPrice),
          actListingTimeStart: now.toISOString(),
          actListingTimeEnd: end.toISOString(),
          actAuctionStatus: 'active',
          actImages: imageId ? [imageId] : [],
          seller: user?.id,
          itemOriginCountry: countryConfig.countryId,
        },
      });

      setSuccess('Listing created!');
      setTitle('');
      setDescription('');
      setStartingPrice('');
      setImageFile(null);
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
          fullWidth
          type="number"
          label="Starting price (USD)"
          value={startingPrice}
          onChange={(e) => setStartingPrice(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          helperText="Auction items are priced in USD internally; bidders see it converted to their local currency."
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
