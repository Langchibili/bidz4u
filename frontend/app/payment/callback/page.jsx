'use client';

import { Box, Button, Typography } from '@mui/material';

export default function PaymentCallbackPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          Verification returned
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Your payment status is being confirmed. Return to the Bidz4U payment window.
        </Typography>
        <Button variant="contained" color="secondary" onClick={() => window.close()}>
          Close window
        </Button>
      </Box>
    </Box>
  );
}