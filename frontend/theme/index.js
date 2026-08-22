// theme/index.js
import { createTheme } from '@mui/material/styles';
import { CUSTOM_THEME_COLORS } from '@/Constants';

const {
  PRIMARY_DEEP_BLUE,
  SECONDARY_SURFACE_BLUE,
  BACKGROUND_DARK_CANVAS,
  ACCENT_GOLD,
  ACCENT_GOLD_DARK,
  TEXT_LIGHT,
  TEXT_MUTED,
} = CUSTOM_THEME_COLORS;

export const deepElevation = {
  boxShadow:
    '0px 8px 32px rgba(0, 0, 0, 0.5), inset 0px 1px 2px rgba(255, 255, 255, 0.05)',
};

export const bidz4uTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: PRIMARY_DEEP_BLUE, contrastText: TEXT_LIGHT },
    secondary: { main: ACCENT_GOLD, dark: ACCENT_GOLD_DARK, contrastText: PRIMARY_DEEP_BLUE },
    background: { default: BACKGROUND_DARK_CANVAS, paper: SECONDARY_SURFACE_BLUE },
    text: { primary: TEXT_LIGHT, secondary: TEXT_MUTED },
    divider: 'rgba(148, 163, 184, 0.15)',
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, textTransform: 'none', fontWeight: 600 },
        containedSecondary: {
          background: `linear-gradient(135deg, ${ACCENT_GOLD} 0%, ${ACCENT_GOLD_DARK} 100%)`,
          color: PRIMARY_DEEP_BLUE,
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', ...deepElevation },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
  },
});

export default bidz4uTheme;
