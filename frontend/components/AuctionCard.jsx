'use client';
// components/AuctionCard.jsx
//
// Feed card: thumbnail on the left, title/timer/highest-bid/bid-count/town on
// the right. Bid count comes from the filtered /bids endpoint's pagination
// total, since there's no dedicated count field on auction-item.
//
// LIVE UPDATES: this card subscribes to the same shared socket connection
// (and the same reconnect-safe polling fallback) as the auction detail page
// — both go through lib/hooks/useSocket.jsx, which is the single place that
// owns socket-connection, price/status-display, and currency-conversion
// logic for the whole app. Previously this card never subscribed to
// anything and just showed the price from whenever the feed was last
// fetched, which is why bids placed while someone was sitting on the home
// feed never visibly updated it.
//
// PRICE CURRENCY: the listing's price is stored/emitted in its own "native"
// currency (actNativeCurrencyCode), which may differ from the viewer's own
// currency if the item was listed in a different country. This card
// converts that native price into the VIEWER's own currency for display —
// via useViewerCurrencyRate(), which calls the backend's currency
// conversion controller — and always shows it with the viewer's own
// currency symbol (countryConfig.savedCurrencySymbol), the same way the
// wallet page always shows amounts in the viewer's own currency.
//
// COUNTRY GATING: both the currency conversion AND the "show the listing's
// country next to its town" behavior below are gated on the SAME check —
// item.itemOriginCountry.countryName vs. the viewer's own
// countryConfig.savedCountryName — not on currency codes. Two different
// countries can share a currency (conversion would be a no-op either way),
// but the intent here is specifically "is this a cross-border listing for
// this viewer", so country identity is what decides whether either piece
// of extra context is worth showing/fetching at all.
//
// This requires item.itemOriginCountry to be populated with at least
// countryName by whatever fetched `item` — see app/page.jsx's feed query.

import { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { formatCurrency, getCurrencySymbol, getMediaUrl } from '@/Functions';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { useSocket, getDisplayedAuctionPrice, useViewerCurrencyRate } from '@/lib/hooks/useSocket';
import { CUSTOM_THEME_COLORS } from '@/Constants';

export default function AuctionCard({ item, onClick }) {
  const { user, countryConfig, effectiveSettings } = useAuth();
  const savedCurrencyCode = countryConfig?.savedCurrencyCode;
  const viewerCurrencyCode = effectiveSettings?._userCurrency || savedCurrencyCode;
  const viewerCurrencySymbol = viewerCurrencyCode === savedCurrencyCode
    ? countryConfig?.savedCurrencySymbol || viewerCurrencyCode || ''
    : getCurrencySymbol(viewerCurrencyCode);
  const viewerCountryName = countryConfig?.savedCountryName;
  const viewerCountryId = countryConfig?.countryId;
  const itemCountryId = item.itemOriginCountry?.id;
  const itemCountryName = item.itemOriginCountry?.countryName;
  const normalizedViewerCountryName = String(viewerCountryName || '').trim().toLowerCase();
  const normalizedItemCountryName = String(itemCountryName || '').trim().toLowerCase();
  const isDifferentCountry = viewerCountryId && itemCountryId
    ? String(viewerCountryId) !== String(itemCountryId)
    : Boolean(normalizedItemCountryName && normalizedViewerCountryName && normalizedItemCountryName !== normalizedViewerCountryName);

  // Numeric id — the sockets service rooms and the lightweight-status
  // polling fallback both key off this, not documentId. See the uidType
  // note at the top of lib/hooks/useSocket.jsx.
  const numericItemId = apiClient.resolveId(item, 'id');
  const currentUserId = apiClient.resolveId(user, 'id');
  const [isOwner, setIsOwner] = useState(false);
  const live = useSocket(numericItemId);

  const endTime = live.auctionEndTime || item.actListingTimeEnd;
  const timer = useAuctionTimer(endTime);
  const thumbnail = item.actImages?.[0]?.formats?.thumbnail?.url || item.actImages?.[0]?.url;
  const [bidCount, setBidCount] = useState(null);
  const [bidCountFailed, setBidCountFailed] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingPrice, setAcceptingPrice] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!numericItemId || !currentUserId) {
      setIsOwner(false);
      return () => { cancelled = true; };
    }

    apiClient
      .get(`/auction-items/${encodeURIComponent(numericItemId)}/mine?userId=${encodeURIComponent(currentUserId)}`)
      .then((res) => {
        if (!cancelled) setIsOwner(res?.mine === true);
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });

    return () => { cancelled = true; };
  }, [numericItemId, currentUserId]);

  const handleAcceptPrice = async () => {
    try {
      setAcceptingPrice(true);
      setAcceptError('');
      await apiClient.post(`/auction-items/${numericItemId}/accept-price`, {});
      setAcceptDialogOpen(false);
    } catch (err) {
      setAcceptError(err.message || 'Failed to accept price');
    } finally {
      setAcceptingPrice(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!numericItemId) {
      setBidCount(null);
      setBidCountFailed(false);
      return () => {
        cancelled = true;
      };
    }

    setBidCount(null);
    setBidCountFailed(false);
    apiClient
      .get(
        `/bids?filters[auctionItem][id][$eq]=${encodeURIComponent(numericItemId)}&fields[0]=id&pagination[pageSize]=1&pagination[withCount]=true`
      )
      .then((res) => {
        if (!cancelled) {
          const total = res?.meta?.pagination?.total;
          setBidCount(typeof total === 'number' ? total : res?.data?.length ?? 0);
          setBidCountFailed(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`Failed to count bids for auction ${numericItemId}`, err);
          setBidCount(null);
          setBidCountFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numericItemId, live.lastEvent]);

  const { displayedPrice: nativePrice, displayedCurrencyCode: nativeCurrencyCode } = getDisplayedAuctionPrice(item, live);
  // Only actually attempt conversion when the countries differ — passing
  // viewerCurrencyCode as the "native" side when they don't makes
  // useViewerCurrencyRate treat it as a no-op (rate 1, immediately ready)
  // without needing any change to that hook itself.
  const { rate, isReady: isPriceReady } = useViewerCurrencyRate(
    isDifferentCountry ? (nativeCurrencyCode || item.itemOriginCountry?.currency?.currCode) : viewerCurrencyCode,
    viewerCurrencyCode
  );
  const displayedPrice = Number(nativePrice) * rate;
  const displayedCurrencySymbol = isDifferentCountry ? viewerCurrencySymbol : (item.actNativeCurrencySymbol || viewerCurrencySymbol);
  const displayedStatus = live.auctionStatus || item.actAuctionStatus;

  const locationLabel = item.actTown && isDifferentCountry
    ? `${item.actTown}, ${itemCountryName}`
    : item.actTown || (isDifferentCountry ? itemCountryName : '');

 return (
    <Box
      onClick={onClick}
      component={motion.div}
      whileTap={{ scale: 0.98 }}
      sx={{
        display: 'flex',
        gap: 1.5,
        borderRadius: 3,
        p: 1.5,
        cursor: 'pointer',
        bgcolor: 'background.paper',
        boxShadow: '0px 8px 32px rgba(0,0,0,0.5), inset 0px 1px 2px rgba(255,255,255,0.05)',
      }}
    >
      <Box
        sx={{
          width: 84,
          height: 84,
          flexShrink: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'rgba(148,163,184,0.08)',
          backgroundImage: thumbnail ? `url(${getMediaUrl(thumbnail)})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <Box sx={{ flex: 1, minWidth: 0, containerType: 'inline-size' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {item.actTitle}
          </Typography>
          <Chip
            size="small"
            label={timer.isExpired ? 'Ended' : timer.display}
            sx={{
              flexShrink: 0,
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: timer.isInFinalMinute ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: timer.isInFinalMinute ? 'error.main' : CUSTOM_THEME_COLORS.ACCENT_GOLD,
            }}
          />
        </Box>

        {item.actTown && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}>
            <PlaceIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {locationLabel}
            </Typography>
          </Box>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={isPriceReady ? displayedPrice : 'loading'} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            <Typography
              variant="h6"
              sx={{
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontWeight: 800,
                color: 'secondary.main',
                mt: 0.5,
                fontSize: 'clamp(0.75rem, 12cqw, 1.25rem)',
              }}
            >
              {isPriceReady ? formatCurrency(displayedPrice, displayedCurrencySymbol) : 'Loading price...'}
            </Typography>
          </motion.div>
        </AnimatePresence>

        <Typography variant="caption" color="text.secondary">
          {bidCountFailed
            ? 'Bids unavailable'
            : bidCount === null
              ? 'Loading bids...'
              : `${bidCount} bid${bidCount === 1 ? '' : 's'}`}
        </Typography>

        {isOwner && displayedStatus === 'active' && bidCount > 0 && (
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            onClick={(event) => {
              event.stopPropagation();
              setAcceptDialogOpen(true);
            }}
            sx={{ mt: 1 }}
          >
            Accept price
          </Button>
        )}
      </Box>

      <Dialog open={acceptDialogOpen} onClose={() => !acceptingPrice && setAcceptDialogOpen(false)}>
        <DialogTitle>Accept price?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to accept this price? This will stop any more offers coming in.
          </DialogContentText>
          {acceptError && <Typography color="error" sx={{ mt: 2 }}>{acceptError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcceptDialogOpen(false)} disabled={acceptingPrice}>No</Button>
          <Button onClick={handleAcceptPrice} disabled={acceptingPrice} variant="contained" color="secondary">
            {acceptingPrice ? 'Accepting...' : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}