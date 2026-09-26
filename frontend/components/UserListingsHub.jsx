'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { STORAGE_KEYS } from '@/Constants';
import { formatCurrency, getMediaUrl, isDraftListing } from '@/Functions';

const FILTERS = [
  { value: 'all', label: 'All listings' },
  { value: 'payment_pending', label: 'Payment pending' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sold', label: 'Sold' },
  { value: 'delisted_no_bids', label: 'Closed, no bids' },
  { value: 'delisted_forfeited', label: 'Forfeited' },
  { value: 'draft', label: 'Draft' },
];

function listingStatus(item) {
  return isDraftListing(item.actIsDraft) ? 'draft' : item.actAuctionStatus || 'scheduled';
}

function listingPriority(item) {
  const status = listingStatus(item);
  if (status === 'payment_pending') return 0;
  if (status === 'active') return 1;
  return 2;
}

function itemUrl(item) {
  return apiClient.resolveId(item);
}

export default function UserListingsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, isAuthenticated } = useAuth();
  const [listings, setListings] = useState([]);
  const [winnerPayments, setWinnerPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const touchStartY = useRef(null);

  useEffect(() => {
    if (!hydrated || !user || !isAuthenticated()) {
      setListings([]);
      setWinnerPayments([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    const refreshListings = () => {
      apiClient
        .get('/auction-items/me/listings')
        .then((res) => {
          if (cancelled) return;
          setListings(Array.isArray(res?.items) ? res.items : []);
          setWinnerPayments(Array.isArray(res?.winnerPayments) ? res.winnerPayments : []);
        })
        .catch((error) => {
          if (!cancelled) console.error('Failed to load user listings', error);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    refreshListings();
    const refreshInterval = setInterval(refreshListings, 30000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [hydrated, isAuthenticated, pathname, user?.id]);

  const sortedListings = useMemo(() => listings
    .filter((item) => filter === 'all' || listingStatus(item) === filter)
    .slice()
    .sort((left, right) => listingPriority(left) - listingPriority(right)
      || new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)), [filter, listings]);

  const openListing = (item) => {
    if (isDraftListing(item.actIsDraft)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(apiClient.resolveId(item, 'id')));
      localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(apiClient.resolveId(item)));
      router.push('/sell');
    } else {
      const id = itemUrl(item);
      if (id) router.push(`/auction/${id}`);
    }
    setDrawerOpen(false);
  };

  const removeListing = async () => {
    if (!deleteTarget) return;
    const listingId = apiClient.resolveId(deleteTarget);
    try {
      setDeleting(true);
      setDeleteError('');
      await apiClient.delete(`/auction-items/${encodeURIComponent(listingId)}/mine`);
      setListings((current) => current.filter((item) => apiClient.resolveId(item) !== listingId));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error.message || 'Failed to remove this listing');
    } finally {
      setDeleting(false);
    }
  };

  const sellerPaymentPending = listings.filter((item) => !isDraftListing(item.actIsDraft) && item.actAuctionStatus === 'payment_pending');
  const hasListings = listings.length > 0;

  return (
    <>
      {sellerPaymentPending.map((item) => (
        <Alert
          key={`seller-${apiClient.resolveId(item)}`}
          severity="warning"
          action={<Button color="inherit" size="small" onClick={() => router.push(`/auction/${itemUrl(item)}`)}>View listing</Button>}
          sx={{
            borderRadius: 0,
            bgcolor: '#fff2c2',
            color: '#543b00',
            '& .MuiAlert-icon': { color: '#946200' },
          }}
        >
          Payment is pending for “{item.actTitle || 'your listing'}”. We’ll update you when the winning bidder pays.
        </Alert>
      ))}

      {winnerPayments.map((item) => (
        <Alert
          key={`winner-${apiClient.resolveId(item)}`}
          severity="warning"
          action={<Button color="inherit" size="small" onClick={() => router.push(`/auction/${itemUrl(item)}`)}>Pay now</Button>}
          sx={{
            borderRadius: 0,
            bgcolor: '#fff2c2',
            color: '#543b00',
            '& .MuiAlert-icon': { color: '#946200' },
          }}
        >
          Pay the remaining balance for “{item.actTitle || 'your winning auction'}” now to avoid penalties.
        </Alert>
      ))}

      {pathname === '/' && hasListings && (
        <Button
          onClick={() => setDrawerOpen(true)}
          onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY ?? null; }}
          onTouchEnd={(event) => {
            const touchEndY = event.changedTouches[0]?.clientY;
            if (touchStartY.current !== null && touchEndY !== undefined && touchStartY.current - touchEndY > 40) {
              setDrawerOpen(true);
            }
            touchStartY.current = null;
          }}
          aria-label={`Open your ${listings.length} listings`}
          sx={{
            position: 'fixed',
            zIndex: 49,
            left: 0,
            bottom: 56,
            minWidth: 0,
            width: '100%',
            minHeight: 62,
            px: 2,
            py: 0.5,
            borderRadius: '30px 30px 0 0',
            backgroundColor: 'rgba(248, 216, 158, 0.88)',
            backgroundImage: 'repeating-radial-gradient(ellipse at 50% 118%, transparent 0 20px, rgba(255, 255, 255, 0.22) 21px 22px, transparent 23px 40px), linear-gradient(160deg, rgba(255, 241, 207, 0.94), rgba(241, 190, 92, 0.8))',
            backdropFilter: 'blur(12px) saturate(115%)',
            color: '#4b3918',
            border: '1px solid rgba(255, 249, 230, 0.72)',
            boxShadow: '0 -4px 18px rgba(35, 23, 5, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
            textTransform: 'none',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            '&:hover': { backgroundColor: 'rgba(248, 216, 158, 0.94)' },
          }}
        >
          <KeyboardArrowUpIcon sx={{ fontSize: 21, animation: 'listing-arrow 1.1s ease-in-out infinite', '@keyframes listing-arrow': { '0%, 100%': { transform: 'translateY(2px)', opacity: 0.45 }, '50%': { transform: 'translateY(-2px)', opacity: 1 } } }} />
          My listings · {listings.length}
        </Button>
      )}

      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        swipeAreaWidth={0}
        disableSwipeToOpen
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { height: '100dvh', maxHeight: '100dvh', width: 'calc(100% - 12px)', mx: '6px', overflow: 'hidden', bgcolor: 'background.default', borderRadius: '24px 24px 0 0' } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ width: 40 }} />
              <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'text.disabled' }} />
              <IconButton aria-label="Close listings drawer" onClick={() => setDrawerOpen(false)} sx={{ width: 40, height: 40 }}>
                <CloseIcon />
              </IconButton>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>My listings</Typography>
            {loading ? (
              <Stack spacing={1.5}>
                <Skeleton variant="rounded" height={76} />
                <Skeleton variant="rounded" height={76} />
                <Skeleton variant="rounded" height={76} />
              </Stack>
            ) : sortedListings.length ? (
              <Stack spacing={1}>
                {sortedListings.map((item) => {
                  const thumbnail = item.actImages?.[0]?.formats?.thumbnail?.url || item.actImages?.[0]?.url;
                  const isDraft = isDraftListing(item.actIsDraft);
                  const status = listingStatus(item);
                  const canRemove = isDraft || item.actAuctionStatus === 'scheduled';
                  return (
                    <Box
                      key={apiClient.resolveId(item)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Box
                        component="button"
                        onClick={() => openListing(item)}
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          border: 0,
                          borderRadius: 1.5,
                          textAlign: 'left',
                          color: 'text.primary',
                          bgcolor: 'background.paper',
                          cursor: 'pointer',
                        }}
                      >
                        <Box sx={{
                          width: 56,
                          height: 56,
                          flexShrink: 0,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                          backgroundImage: thumbnail ? `url(${getMediaUrl(thumbnail)})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>{item.actTitle || 'Untitled listing'}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {formatCurrency(item.actCurrentHighestPriceNative || item.actStartingPriceNative, item.actNativeCurrencyCode)}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={isDraft ? 'Draft' : status.replaceAll('_', ' ')}
                          color={status === 'payment_pending' ? 'warning' : status === 'active' ? 'success' : 'default'}
                          sx={{ flexShrink: 0, textTransform: 'capitalize' }}
                        />
                      </Box>
                      {canRemove && (
                        <IconButton
                          aria-label={`Delete ${item.actTitle || 'listing'}`}
                          onClick={() => { setDeleteError(''); setDeleteTarget(item); }}
                          sx={{ flexShrink: 0, color: 'error.light', bgcolor: 'rgba(239, 68, 68, 0.1)' }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Typography color="text.secondary">No listings match this filter.</Typography>
            )}
          </Box>

          <Divider />
          <FormControl fullWidth sx={{ p: 2, flexShrink: 0 }}>
            <InputLabel id="listing-status-filter-label">Show listings</InputLabel>
            <Select
              labelId="listing-status-filter-label"
              value={filter}
              label="Show listings"
              onChange={(event) => setFilter(event.target.value)}
              MenuProps={{
                anchorOrigin: { vertical: 'top', horizontal: 'left' },
                transformOrigin: { vertical: 'bottom', horizontal: 'left' },
                PaperProps: { sx: { maxHeight: '45vh' } },
              }}
            >
              {FILTERS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </SwipeableDrawer>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remove this listing?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{deleteTarget?.actTitle || 'Untitled listing'}” will be removed from your account.
          </DialogContentText>
          {deleteError && <Typography color="error" sx={{ mt: 2 }}>{deleteError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button onClick={removeListing} disabled={deleting} color="error" variant="contained">
            {deleting ? <Skeleton variant="text" width={64} sx={{ bgcolor: 'rgba(255,255,255,0.35)' }} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
