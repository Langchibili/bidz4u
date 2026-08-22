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
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSocket } from '@/lib/hooks/useSocket';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { formatCurrency } from '@/Functions';
import BottomNav from '@/components/BottomNav';
import { CUSTOM_THEME_COLORS } from '@/Constants';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isAuthenticated, countryConfig, effectiveSettings } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [bidError, setBidError] = useState('');
  const [flash, setFlash] = useState(false);

  const currencySymbol = countryConfig?.savedCurrencySymbol || 'ZK';
  const pollIntervalMs = effectiveSettings?._pollIntervalMs;

  const { livePrice, auctionStatus, auctionEndTime, isUsingFallback, lastEvent } = useSocket(id, {
    userId: user?.id,
    userType: 'bidder',
    pollIntervalMs,
  });

  const endTime = auctionEndTime || item?.actListingTimeEnd;
  const timer = useAuctionTimer(endTime);

  const fetchItem = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(
        `/auction-items/${id}?populate[actImages][populate]=*&populate[seller][fields][0]=id&populate[seller][fields][1]=usrFullName&populate[seller][fields][2]=username`
      );
      setItem(res?.data || res);
    } catch (err) {
      setError(err.message || 'Failed to load this auction');
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const displayedPrice = livePrice ?? item?.actCurrentHighestPriceUsd ?? 0;
  const displayedStatus = auctionStatus || item?.actAuctionStatus;

  const handlePlaceBid = async () => {
    setBidError('');
    if (!isAuthenticated()) {
      router.push(`/login?redirect=/auction/${id}`);
      return;
    }
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      setBidError('Enter a valid bid amount');
      return;
    }
    try {
      setPlacingBid(true);
      await apiClient.post('/bids/place', { auctionItemId: id, bidAmountLocal: amount });
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

  const isActive = displayedStatus === 'active';
  const isFinalMinute = timer.isInFinalMinute;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        {item.actTitle}
      </Typography>
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
              {formatCurrency(displayedPrice, currencySymbol)}
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
          <TextField
            fullWidth
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`More than ${formatCurrency(displayedPrice, currencySymbol)}`}
            InputProps={{
              startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
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
