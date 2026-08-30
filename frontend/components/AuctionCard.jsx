'use client';
// components/AuctionCard.jsx
//
// Feed card: thumbnail on the left, title/timer/highest-bid/bid-count/town on
// the right. Bid count comes from item.bids?.length — see the README note on
// /auction-items populate cost, since there's no dedicated count field.
//
// PRICE CURRENCY (fixed): auction-item moved from a flat USD price to a
// per-item "native currency" — the price shown here is always in the
// LISTING's own currency (item.actCurrentHighestPriceNative /
// item.actNativeCurrencyCode), which may differ from the viewer's own
// currency if the item was listed in a different country. This card no
// longer takes a `currencySymbol` prop for that reason — passing the
// viewer's currency here would be actively wrong now that items can be
// denominated in any listed country's currency.

import { Box, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { formatCurrency, getMediaUrl } from '@/Functions';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { CUSTOM_THEME_COLORS } from '@/Constants';

export default function AuctionCard({ item, onClick }) {
  const timer = useAuctionTimer(item.actListingTimeEnd);
  const thumbnail = item.actImages?.[0]?.formats?.thumbnail?.url || item.actImages?.[0]?.url;
  const bidCount = Array.isArray(item.bids) ? item.bids.length : item.bidCount ?? null;

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

      <Box sx={{ flex: 1, minWidth: 0 }}>
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
              {item.actTown}
            </Typography>
          </Box>
        )}

        <Typography variant="h6" sx={{ fontWeight: 800, color: 'secondary.main', mt: 0.5 }}>
          {formatCurrency(item.actCurrentHighestPriceNative, item.actNativeCurrencyCode)}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {bidCount !== null ? `${bidCount} bid${bidCount === 1 ? '' : 's'}` : 'No bids yet'}
        </Typography>
      </Box>
    </Box>
  );
}
