'use client';
// app/ClientProviders.jsx — single global provider so every route (including
// app/auction/[id]) gets theme + AppContext without repeating boilerplate.

import { ThemeProvider, CssBaseline } from '@mui/material';
import ContextProviders from '@/lib/contexts/ContextProviders';
import { bidz4uTheme } from '@/theme';

export default function ClientProviders({ children }) {
  return (
    <ThemeProvider theme={bidz4uTheme}>
      <CssBaseline />
      <ContextProviders>{children}</ContextProviders>
    </ThemeProvider>
  );
}
