// 'use client';
// // app/page.jsx — home: redirects to login if unauthenticated, else shows the live feed.

// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { Box, Typography, CircularProgress, Stack } from '@mui/material';
// import { useAuth } from '@/lib/contexts/AuthContext';
// import { apiClient } from '@/lib/api/client';
// import AuctionCard from '@/components/AuctionCard';
// import BottomNav from '@/components/BottomNav';

// export default function Home() {
//   const router = useRouter();
//   const { isAuthenticated, hydrated, countryConfig } = useAuth();
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (hydrated && !isAuthenticated()) {
//       router.push('/login');
//     }
//   }, [hydrated, isAuthenticated, router]);

//   useEffect(() => {
//     // populate[bids][fields][0]=id keeps the bid-count payload light — we only
//     // need array length, not full bid records, for the feed view.
//     apiClient
//       .get(
//         '/auction-items?filters[actAuctionStatus][$eq]=active&populate[actImages][fields][0]=url&populate[actImages][fields][1]=formats&populate[bids][fields][0]=id&sort=createdAt:desc'
//       )
//       .then((res) => setItems(res?.data || []))
//       .catch((err) => console.error('Failed to load auctions', err))
//       .finally(() => setLoading(false));
//   }, []);

//   if (!hydrated || loading) {
//     return (
//       <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
//         <CircularProgress color="secondary" />
//       </Box>
//     );
//   }

//   return (
//     <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
//       <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
//         Live Auctions
//       </Typography>

//       <Stack spacing={1.5}>
//         {items.map((item) => (
//           <AuctionCard
//             key={apiClient.resolveId(item)}
//             item={item}
//             currencySymbol={countryConfig?.savedCurrencySymbol}
//             // Default core `findOne` (GET /auction-items/:id) resolves :id as
//             // documentId in Strapi v5 — apiClient.resolveId() defaults to
//             // documentId, so no override needed here. See UIDTYPE_AUDIT.md.
//             onClick={() => router.push(`/auction/${apiClient.resolveId(item)}`)}
//           />
//         ))}
//       </Stack>

//       {items.length === 0 && (
//         <Typography color="text.secondary">No active auctions right now — check back soon.</Typography>
//       )}

//       <BottomNav />
//     </Box>
//   );
// }

'use client';
// app/page.jsx — home: redirects to login if unauthenticated, else shows the live feed.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Stack } from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import AuctionCard from '@/components/AuctionCard';
import BottomNav from '@/components/BottomNav';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hydrated && !isAuthenticated()) {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    // populate[bids][fields][0]=id keeps the bid-count payload light — we only
    // need array length, not full bid records, for the feed view.
    apiClient
      .get(
        '/auction-items?filters[actAuctionStatus][$eq]=active&populate[actImages][fields][0]=url&populate[actImages][fields][1]=formats&populate[bids][fields][0]=id&sort=createdAt:desc'
      )
      .then((res) => setItems(res?.data || []))
      .catch((err) => console.error('Failed to load auctions', err))
      .finally(() => setLoading(false));
  }, []);

  if (!hydrated || loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Live Auctions
      </Typography>

      <Stack spacing={1.5}>
        {items.map((item) => (
          <AuctionCard
            key={apiClient.resolveId(item)}
            item={item}
            // No currencySymbol prop — AuctionCard now sources currency from
            // item.actNativeCurrencyCode directly, since prices are
            // denominated per-listing, not in the viewer's own currency.
            // Default core `findOne` (GET /auction-items/:id) resolves :id as
            // documentId in Strapi v5 — apiClient.resolveId() defaults to
            // documentId, so no override needed here. See UIDTYPE_AUDIT.md.
            onClick={() => router.push(`/auction/${apiClient.resolveId(item)}`)}
          />
        ))}
      </Stack>

      {items.length === 0 && (
        <Typography color="text.secondary">No active auctions right now — check back soon.</Typography>
      )}

      <BottomNav />
    </Box>
  );
}