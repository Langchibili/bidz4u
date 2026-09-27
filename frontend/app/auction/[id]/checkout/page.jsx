'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { formatCurrency, getCurrencySymbol, getMediaUrl } from '@/Functions';
import Bidz4uPayModal from '@/components/Bidz4uPayModal';
import ConfirmDeliveryModal from '@/components/ConfirmDeliveryModal';
import BottomNav from '@/components/BottomNav';

export default function WinnerCheckoutPage() {
  const { id } = useParams();
  const router = useRouter();
  const { hydrated, isAuthenticated, countryConfig, effectiveSettings } = useAuth();
  const [item, setItem] = useState(null);
  const [quote, setQuote] = useState(null);
  const [isWinner, setIsWinner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);

  const loadCheckout = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const itemResponse = await apiClient.get(
        `/auction-items/${encodeURIComponent(id)}?populate[actImages][populate]=*`
      );
      const loadedItem = itemResponse?.data || itemResponse;
      setItem(loadedItem);

      const winnerResponse = await apiClient.get(`/auction-items/${encodeURIComponent(id)}/winner`);
      const winner = winnerResponse?.winner === true;
      setIsWinner(winner);
      if (!winner) {
        setError('Only the winning bidder can complete payment for this item.');
        return;
      }

      if (loadedItem?.actAuctionStatus === 'payment_pending') {
        const numericId = apiClient.resolveId(loadedItem, 'id');
        const quoteResponse = await apiClient.get(`/bidz4upay/winner-quote/${encodeURIComponent(numericId)}`);
        setQuote(quoteResponse?.data || quoteResponse);
      } else if (loadedItem?.actAuctionStatus === 'sold') {
        setPaymentComplete(true);
      } else {
        setError('This item is not currently awaiting winner payment.');
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load checkout details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated()) {
      router.push(`/login?redirect=/auction/${id}/checkout`);
      return;
    }
    loadCheckout();
  }, [hydrated, id, isAuthenticated, loadCheckout, router]);

  const currencyCode = quote?.currency || effectiveSettings?._userCurrency || countryConfig?.savedCurrencyCode || '';
  const currencySymbol = currencyCode === countryConfig?.savedCurrencyCode
    ? countryConfig?.savedCurrencySymbol || currencyCode
    : getCurrencySymbol(currencyCode);
  const itemSymbol = item?.actNativeCurrencySymbol || item?.actNativeCurrencyCode || '';
  const image = item?.actImages?.[0];
  const imageUrl = image ? getMediaUrl(image.formats?.large?.url || image.formats?.medium?.url || image.url) : '';

  if (!hydrated || loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Skeleton variant="rounded" height={260} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="60%" height={42} />
        <Skeleton variant="text" width="38%" height={30} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>Complete your purchase</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {item && (
        <>
          {imageUrl && (
            <Box
              component="img"
              src={imageUrl}
              alt={item.actTitle || 'Winning item'}
              sx={{ width: '100%', height: { xs: 230, sm: 340 }, objectFit: 'cover', borderRadius: 2, mb: 2 }}
            />
          )}
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{item.actTitle}</Typography>
          {quote && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">Winning price</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                {formatCurrency(Number(quote.totalPrice || 0), itemSymbol)}
              </Typography>
              {Number(quote.walletApplied || 0) > 0 && (
                <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                  Locked bid deposit applied: {formatCurrency(Number(quote.walletApplied), itemSymbol)}
                </Typography>
              )}
              <Alert severity="info" sx={{ mb: 2 }}>
                Your payment is protected by escrow. The seller cannot withdraw the funds until you receive the item and confirm delivery.
              </Alert>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                size="large"
                disabled={!isWinner || paymentComplete}
                onClick={() => setPaymentOpen(true)}
                sx={{ minHeight: 54, fontWeight: 800 }}
              >
                Pay {formatCurrency(Number(quote.amountDue || 0), currencySymbol)}
              </Button>
            </Box>
          )}

          {paymentComplete && !item.actEscrowReleased && (
            <Alert
              severity="success"
              sx={{ mt: 2 }}
              action={<Button color="inherit" size="small" onClick={() => setDeliveryOpen(true)}>Received</Button>}
            >
              Your item is awaiting delivery. Please wait for it to be delivered, then confirm that you have received it.
            </Alert>
          )}
          {paymentComplete && item.actEscrowReleased && (
            <Alert severity="success" sx={{ mt: 2 }}>Receipt confirmed. The seller’s escrow has been released.</Alert>
          )}
        </>
      )}

      <Bidz4uPayModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        amount={quote?.amountDue || 0}
        currency={currencySymbol}
        relatedEntityId={apiClient.resolveId(item, 'id')}
        phoneCode={countryConfig?.savedPhoneCode}
        onSuccess={() => {
          setPaymentOpen(false);
          setPaymentComplete(true);
          setItem((current) => ({ ...current, actAuctionStatus: 'sold' }));
        }}
      />
      <ConfirmDeliveryModal
        open={deliveryOpen}
        item={item}
        onClose={() => setDeliveryOpen(false)}
        onConfirmed={() => setItem((current) => ({ ...current, actEscrowReleased: true, actBuyerConfirmedDelivery: true }))}
      />
      <BottomNav />
    </Box>
  );
}
