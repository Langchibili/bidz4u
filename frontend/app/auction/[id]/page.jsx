'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  InputAdornment,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSocket } from '@/lib/hooks/useSocket';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { formatCurrency } from '@/Functions';
import BottomNav from '@/components/BottomNav';
import { CUSTOM_THEME_COLORS, STORAGE_KEYS } from '@/Constants';

export default function AuctionDetailPage() {
  // The route param is the auction's `documentId` — every link into this page
  // (home feed, my-bids) navigates using apiClient.resolveId(item), which
  // defaults to documentId. This matches Strapi v5's default core `findOne`
  // route (GET /auction-items/:id), which resolves :id as documentId.
  const { id: routeDocumentId } = useParams();
  const router = useRouter();
  const { user, isAuthenticated, countryConfig, effectiveSettings } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [bidError, setBidError] = useState('');
  const [flash, setFlash] = useState(false);

  // What the VIEWER types into the bid box is in THEIR OWN currency
  // (bidAmountLocal — bid.place converts it server-side into the auction's
  // native currency). This is separate from what the current-highest-bid
  // display below uses, which must be the auction's own currency — see the
  // note further down.
  const viewerCurrencyLabel = countryConfig?.savedCurrencySymbol || countryConfig?.savedCurrencyCode || '';
  const pollIntervalMs = effectiveSettings?._pollIntervalMs;

  // IMPORTANT: sockets and the lightweight-status polling fallback both key
  // off the NUMERIC id server-side (bid.place emits with `auctionItem.id`,
  // the sockets service rooms are `auction:${numericId}`, and
  // lightweight-status's controller does a raw `db.query(...).findOne({
  // where: { id } })`). So this hook is deliberately given `item?.id`
  // (numeric, apiClient.resolveId(item, 'id')) — NOT the documentId route
  // param — and only connects once the item has finished loading. See
  // UIDTYPE_AUDIT.md for the full endpoint-by-endpoint breakdown.
  const numericItemId = apiClient.resolveId(item, 'id');

  const { livePrice, liveCurrencyCode, auctionStatus, auctionEndTime, isUsingFallback, lastEvent } = useSocket(numericItemId, {
    userId: apiClient.resolveId(user, 'id'),
    userType: 'bidder',
    pollIntervalMs,
  });

  const endTime = auctionEndTime || item?.actListingTimeEnd;
  const timer = useAuctionTimer(endTime);

  const fetchItem = useCallback(async () => {
    try {
      setLoading(true);
      // Default core `findOne` — resolves the route param as documentId.
      const res = await apiClient.get(
        `/auction-items/${routeDocumentId}?populate[actImages][populate]=*&populate[seller][fields][0]=id&populate[seller][fields][1]=usrFullName&populate[seller][fields][2]=username`
      );
      setItem(res?.data || res);
    } catch (err) {
      setError(err.message || 'Failed to load this auction');
    } finally {
      setLoading(false);
    }
  }, [routeDocumentId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Flash gold whenever a new bid lands over the socket
  useEffect(() => {
    if (lastEvent?.type === 'bid:placed') {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lastEvent]);

  // The auction's current highest bid is denominated in the LISTING's own
  // currency (actNativeCurrencyCode), which may be a different country's
  // currency than the viewer's — NOT the viewer's own currencySymbol.
  // livePrice/liveCurrencyCode come from useSocket (bid:placed events or the
  // polling fallback); both fall back to the initially-fetched item.
  const hasLivePrice = Number(livePrice) > 0;
  const displayedPrice = hasLivePrice ? livePrice : item?.actStartingPriceNative ?? 0;
  const displayedCurrencyCode = liveCurrencyCode || item?.actNativeCurrencyCode || '';
  const displayedStatus = auctionStatus || item?.actAuctionStatus;

  const handlePlaceBid = async () => {
    setBidError('');
    if (!isAuthenticated()) {
      router.push(`/login?redirect=/auction/${routeDocumentId}`);
      return;
    }
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      setBidError('Enter a valid bid amount');
      return;
    }
    try {
      setPlacingBid(true);
      // bid.place's controller does `strapi.db.query('api::auction-item.auction-item')
      // .findOne({ where: { id: auctionItemId } })` — the raw Query Engine,
      // which only matches the numeric `id` column. Sending documentId here
      // would 404 inside that controller ("Auction item not found"), even
      // though this page's own URL uses documentId. Hence the explicit
      // uidType override — see UIDTYPE_AUDIT.md.
      //
      // `bidAmountLocal` is in the VIEWER's own currency — bid.place
      // converts it into the auction's native currency server-side
      // (converting only if the two currencies actually differ).
      await apiClient.post(
        '/bids/place',
        { auctionItemId: apiClient.resolveId(item, 'id'), bidAmountLocal: amount },
        'id'
      );
      setBidAmount('');
    } catch (err) {
      setBidError(err.message || 'Failed to place bid');
    } finally {
      setPlacingBid(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  if (error || !item) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Alert severity="error">{error || 'Auction not found'}</Alert>
      </Box>
    );
  }

  // Drafts have no meaningful public view — this page is otherwise never
  // linked to from a draft (the drafts browser on /sell routes there
  // directly, not through here), but a seller could still land here by
  // pasting the URL themselves. Redirect them back to finish it instead.
  if (item.actIsDraft) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Alert severity="info" sx={{ borderRadius: 3, mb: 2 }}>
          This listing is still a draft — finish setting it up from the Sell page.
        </Alert>
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          size="large"
          onClick={() => {
            localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(apiClient.resolveId(item, 'id')));
            localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(apiClient.resolveId(item)));
            router.push('/sell');
          }}
          sx={{ height: 56, fontWeight: 700 }}
        >
          Continue Editing Draft
        </Button>
      </Box>
    );
  }

  const isActive = displayedStatus === 'active';
  const isFinalMinute = timer.isInFinalMinute;
  const currencyMismatch = viewerCurrencyLabel && displayedCurrencyCode && viewerCurrencyLabel !== displayedCurrencyCode;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        {item.actTitle}
      </Typography>

      {item.actTown && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {item.actTown}
          </Typography>
        </Box>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {item.actDescription}
      </Typography>

      <Box
        component={motion.div}
        animate={flash ? {
          boxShadow: [
            'inset 0px 1px 2px rgba(255,255,255,0.05)',
            `inset 0px 0px 28px ${CUSTOM_THEME_COLORS.ACCENT_GOLD}`,
            'inset 0px 1px 2px rgba(255,255,255,0.05)',
          ],
        } : {}}
        transition={{ duration: 0.7 }}
        sx={{
          borderRadius: 3,
          p: 3,
          mb: 3,
          bgcolor: 'background.paper',
          boxShadow: '0px 8px 32px rgba(0,0,0,0.5), inset 0px 1px 2px rgba(255,255,255,0.05)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Current Bid</Typography>
          <Chip
            size="small"
            label={displayedStatus}
            sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: 'secondary.main', fontWeight: 700, textTransform: 'uppercase', fontSize: 10 }}
          />
        </Box>

        <AnimatePresence mode="wait">
          <motion.div key={displayedPrice} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: 'secondary.main' }}>
              {formatCurrency(displayedPrice, displayedCurrencyCode)}
            </Typography>
          </motion.div>
        </AnimatePresence>

        <Typography
          component={motion.div}
          animate={isFinalMinute ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 1, repeat: isFinalMinute ? Infinity : 0 }}
          variant="h6"
          sx={{ mt: 1, fontWeight: 700, color: isFinalMinute ? 'error.main' : 'text.primary' }}
        >
          {timer.isExpired ? 'Auction ended' : `${timer.display} left`}
        </Typography>

        {isUsingFallback && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Live connection lost — updating via polling
          </Typography>
        )}
      </Box>

      {isActive && !timer.isExpired && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {currencyMismatch && (
            <Typography variant="caption" color="text.secondary">
              This listing is priced in {displayedCurrencyCode}. Enter your bid in your own
              currency ({viewerCurrencyLabel}) — it'll be converted automatically.
            </Typography>
          )}
          <TextField
            fullWidth
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="Enter your bid"
            InputProps={{
              startAdornment: <InputAdornment position="start">{viewerCurrencyLabel}</InputAdornment>,
            }}
            sx={{ '& .MuiOutlinedInput-root': { height: 56 } }}
          />

          {bidError && (
            <Alert severity="error" sx={{ borderRadius: 3 }}>
              {bidError}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            color="secondary"
            size="large"
            onClick={handlePlaceBid}
            disabled={placingBid}
            sx={{ height: 56, fontSize: '1rem', fontWeight: 700 }}
          >
            {placingBid ? <CircularProgress size={24} color="inherit" /> : 'Place Bid'}
          </Button>
        </Box>
      )}

      {!isActive && (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          {displayedStatus === 'payment_pending' && 'This auction has closed — awaiting winner payment.'}
          {displayedStatus === 'sold' && 'This item has been sold.'}
          {displayedStatus === 'delisted_no_bids' && 'This auction closed with no bids.'}
          {displayedStatus === 'delisted_forfeited' && 'The winner forfeited — item re-listed.'}
        </Alert>
      )}

      <BottomNav />
    </Box>
  );
}
