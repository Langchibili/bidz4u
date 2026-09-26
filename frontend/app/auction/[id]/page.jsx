
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSocket, getDisplayedAuctionPrice, getDisplayedAuctionStatus, useViewerCurrencyRate } from '@/lib/hooks/useSocket';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { formatCurrency, getCurrencySymbol } from '@/Functions';
import BottomNav from '@/components/BottomNav';
import Bidz4uPayModal from '@/components/Bidz4uPayModal';
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
  const [bidCount, setBidCount] = useState(null);
  const [bidCountFailed, setBidCountFailed] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingPrice, setAcceptingPrice] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [isWinner, setIsWinner] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // What the VIEWER types into the bid box is in THEIR OWN currency
  // (bidAmountLocal — bid.place converts it server-side into the auction's
  // native currency). The main price display below is ALSO shown in the
  // viewer's own currency now (via useViewerCurrencyRate) — see the
  // PRICE CURRENCY note further down for how that's kept honest when the
  // listing's native currency differs.
  const savedCurrencyCode = countryConfig?.savedCurrencyCode;
  const viewerCurrencyCode = effectiveSettings?._userCurrency || savedCurrencyCode;
  const viewerCurrencyLabel = viewerCurrencyCode === savedCurrencyCode
    ? countryConfig?.savedCurrencySymbol || viewerCurrencyCode || ''
    : getCurrencySymbol(viewerCurrencyCode);
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
  const currentUserId = apiClient.resolveId(user, 'id');

  const live = useSocket(numericItemId, {
    userId: apiClient.resolveId(user, 'id'),
    userType: 'bidder',
    pollIntervalMs,
  });

  const endTime = live.auctionEndTime || item?.actListingTimeEnd;
  const timer = useAuctionTimer(endTime);

  const fetchItem = useCallback(async () => {
    try {
      setLoading(true);
      // Default core `findOne` — resolves the route param as documentId.
      const res = await apiClient.get(
        `/auction-items/${routeDocumentId}?populate[actImages][populate]=*&populate[itemOriginCountry][fields][0]=id&populate[itemOriginCountry][fields][1]=countryName&populate[itemOriginCountry][fields][2]=countryCode&populate[itemOriginCountry][populate][currency][fields][0]=currCode`
      );
      console.log('Fetched auction item', res);
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

  useEffect(() => {
    let cancelled = false;
    if (!numericItemId || !currentUserId) {
      setIsWinner(false);
      return () => { cancelled = true; };
    }

    apiClient
      .get(`/auction-items/${encodeURIComponent(routeDocumentId)}/winner`)
      .then((res) => {
        if (!cancelled) setIsWinner(res?.winner === true);
      })
      .catch(() => {
        if (!cancelled) setIsWinner(false);
      });

    return () => { cancelled = true; };
  }, [numericItemId, currentUserId, routeDocumentId, live.lastEvent]);

  // Flash gold whenever a new bid lands over the socket
  useEffect(() => {
    if (live.lastEvent?.type === 'bid:placed') {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [live.lastEvent]);

  // PRICE CURRENCY: the listing's price is stored/emitted in its own
  // "native" currency (actNativeCurrencyCode), which may be a different
  // country's currency than the viewer's. getDisplayedAuctionPrice /
  // getDisplayedAuctionStatus (from lib/hooks/useSocket.jsx) resolve that
  // native price/status the SAME way the home feed's AuctionCard does, so
  // the two surfaces can never disagree on live-vs-fetched precedence.
  // useViewerCurrencyRate() then converts that native price into the
  // VIEWER's own currency — shown below with the viewer's own currency
  // symbol, same as the wallet page.
  const itemCountryId = item?.itemOriginCountry?.id;
  const itemCountryName = item?.itemOriginCountry?.countryName;
  const viewerCountryName = countryConfig?.savedCountryName;
  const viewerCountryId = countryConfig?.countryId;
  const normalizedViewerCountryName = String(viewerCountryName || '').trim().toLowerCase();
  const normalizedItemCountryName = String(itemCountryName || '').trim().toLowerCase();
  const isDifferentCountry = viewerCountryId && itemCountryId
    ? String(viewerCountryId) !== String(itemCountryId)
    : Boolean(normalizedItemCountryName && normalizedViewerCountryName && normalizedItemCountryName !== normalizedViewerCountryName);
  const { displayedPrice: nativePrice, displayedCurrencyCode: nativeCurrencyCode } = getDisplayedAuctionPrice(item, live);
  const displayedStatus = getDisplayedAuctionStatus(item, live);
  const { rate, isReady: isPriceReady } = useViewerCurrencyRate(
    isDifferentCountry ? (nativeCurrencyCode || item?.itemOriginCountry?.currency?.currCode) : viewerCurrencyCode,
    viewerCurrencyCode
  );
  const displayedPrice = Number(nativePrice) * rate;
  const displayedCurrencySymbol = isDifferentCountry ? viewerCurrencyLabel : (item?.actNativeCurrencySymbol || viewerCurrencyLabel);
  const wasCurrencyConverted = isDifferentCountry && !!nativeCurrencyCode && !!viewerCurrencyCode && nativeCurrencyCode !== viewerCurrencyCode;
  const locationLabel = item?.actTown && isDifferentCountry
    ? `${item.actTown}, ${itemCountryName}`
    : item?.actTown || (isDifferentCountry ? itemCountryName : '');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!numericItemId || !currentUserId) {
      setIsOwner(false);
      return () => { cancelled = true; };
    }

    apiClient
      .get(`/auction-items/${encodeURIComponent(routeDocumentId)}/mine?userId=${encodeURIComponent(currentUserId)}`)
      .then((res) => {
        if (!cancelled) setIsOwner(res?.mine === true);
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });

    return () => { cancelled = true; };
  }, [numericItemId, currentUserId, routeDocumentId]);

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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10, containerType: 'inline-size' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        {item.actTitle}
      </Typography>

      {locationLabel && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {locationLabel}
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
          <motion.div key={isPriceReady ? displayedPrice : 'loading'} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <Typography
              variant="h3"
              sx={{
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                fontWeight: 800,
                color: 'secondary.main',
                fontSize: 'clamp(1.25rem, 9cqw, 3rem)',
              }}
            >
              {isPriceReady ? formatCurrency(displayedPrice, displayedCurrencySymbol) : '...'}
            </Typography>
          </motion.div>
        </AnimatePresence>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {bidCountFailed
            ? 'Bids unavailable'
            : bidCount === null
              ? 'Loading bids...'
              : `${bidCount} bid${bidCount === 1 ? '' : 's'}`}
        </Typography>

        {isOwner && isActive && bidCount > 0 && (
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={() => setAcceptDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Accept price
          </Button>
        )}

        {isPriceReady && wasCurrencyConverted && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Originally listed in {nativeCurrencyCode} — converted to your currency
          </Typography>
        )}

        <Typography
          component={motion.div}
          animate={isFinalMinute ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 1, repeat: isFinalMinute ? Infinity : 0 }}
          variant="h6"
          sx={{ mt: 1, fontWeight: 700, color: isFinalMinute ? 'error.main' : 'text.primary' }}
        >
          {timer.isExpired ? 'Auction ended' : `${timer.display} left`}
        </Typography>

      </Box>

      {isActive && !timer.isExpired && !isOwner && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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

      {displayedStatus === 'payment_pending' && isWinner && (
        <Button fullWidth variant="contained" color="secondary" onClick={() => setPaymentOpen(true)} sx={{ mb: 2 }}>
          Pay for auction
        </Button>
      )}

      <Bidz4uPayModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        amount={displayedPrice}
        currency={viewerCurrencyCode}
        relatedEntityId={numericItemId}
        phoneCode={countryConfig?.savedPhoneCode}
        onSuccess={() => setPaymentOpen(false)}
      />

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

      <BottomNav />
    </Box>
  );
}