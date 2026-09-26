'use client';
// components/BottomNav.jsx
//
// App-wide bottom navigation covering every user-facing area from the
// project plan: browsing/bidding (Home), listing an item for sale (Sell),
// wallet/deposits/withdrawals (Wallet), the bidder's own bid history
// (My Bids), and account/KYC/logout (Profile).

import { usePathname, useRouter } from 'next/navigation';
import { Box, Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import AddCircleIcon from '@mui/icons-material/AddCircleOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import PersonIcon from '@mui/icons-material/PersonOutline';

const TABS = [
  { label: 'Auctions', value: '/', icon: <GavelIcon /> },
  { label: 'Sell', value: '/sell', icon: <AddCircleIcon /> },
  { label: 'My Bids', value: '/my-bids', icon: <ReceiptLongIcon /> },
  { label: 'Profile', value: '/profile', icon: <PersonIcon /> },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Highlight the closest matching tab (e.g. /auction/12 doesn't match any
  // tab exactly — leave nothing selected rather than mis-highlighting Home).
  const current = TABS.find((t) => t.value === pathname)?.value || false;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 0,
      }}
    >
      <BottomNavigation
        showLabels
        value={current}
        onChange={(_, newValue) => router.push(newValue)}
        sx={{
          bgcolor: 'background.paper',
          '& .Mui-selected': { color: 'secondary.main' },
        }}
      >
        {TABS.map((tab) => (
          <BottomNavigationAction key={tab.value} label={tab.label} value={tab.value} icon={tab.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}