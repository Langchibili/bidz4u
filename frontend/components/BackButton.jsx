'use client';

import { IconButton, Tooltip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePathname, useRouter } from 'next/navigation';

export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/') return null;

  return (
    <Tooltip title="Go back">
      <IconButton
        aria-label="Go back"
        onClick={() => router.back()}
        sx={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 1200,
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        <ArrowBackIcon />
      </IconButton>
    </Tooltip>
  );
}
