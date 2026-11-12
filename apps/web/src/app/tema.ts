import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';

import { createTheme } from '@mui/material/styles';

/**
 * Identidade visual a partir do site da empresa (ectas.com.br): azul-marinho, azul e petróleo,
 * texto grafite e fonte Montserrat (ADR-014). A fonte é servida pelo próprio sistema, sem CDN.
 * Contraste AA (RNF-11): todas as cores de texto e de botão abaixo passam de 4,5:1 sobre branco.
 */
export const CORES = {
  marinho: '#002B49',
  azul: '#0073A8',
  petroleo: '#37576D',
  grafite: '#2F2E2E',
  cinzaTexto: '#5F5E5E',
  fundo: '#F4F6F8',
  borda: '#DDE3E8',
} as const;

/** Altura mínima de alvos de toque (RNF-01). */
export const ALVO_TOQUE = 44;

export const LARGURA_MENU = 264;

export const tema = createTheme({
  palette: {
    primary: { main: CORES.marinho },
    secondary: { main: CORES.azul },
    text: { primary: CORES.grafite, secondary: CORES.cinzaTexto },
    background: { default: CORES.fundo, paper: '#FFFFFF' },
    divider: CORES.borda,
  },
  typography: {
    fontFamily: '"Montserrat", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 700 },
    h2: { fontSize: '1.375rem', fontWeight: 600 },
    h3: { fontSize: '1.125rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: ALVO_TOQUE } } },
    MuiIconButton: { styleOverrides: { root: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
  },
});
