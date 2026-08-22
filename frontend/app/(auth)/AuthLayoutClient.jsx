'use client';
// app/(auth)/AuthLayoutClient.jsx
// Theme + context already come from the root ClientProviders — this just adds
// a brief splash while localStorage auth state hydrates, and centers content.

import { Box, Container } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect } from 'react';

function LoadingSplash({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            background: 'linear-gradient(135deg,#020C1B 0%,#0A192F 100%)',
          }}
        >
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <Box
              sx={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: -1,
                background: 'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              bidz4u
            </Box>
          </motion.div>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {[0, 1, 2].map((i) => (
              <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], y: [0, -5, 0] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#F59E0B' }} />
              </motion.div>
            ))}
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AuthLayoutClient({ children }) {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplashVisible(false), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="sm" disableGutters>
        {children}
        <LoadingSplash visible={splashVisible} />
      </Container>
    </Box>
  );
}
