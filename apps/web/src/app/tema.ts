import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';

import { alpha, createTheme } from '@mui/material/styles';

/**
 * Identidade visual da ECTAS Saneamento (ADR-015). As três cores principais vêm do logotipo
 * oficial (as três ondas); a fonte é a Montserrat do site ectas.com.br, servida pelo próprio
 * sistema, sem CDN.
 *
 * Contraste (RNF-11, AA): turquesa só como decoração e indicador sobre fundo claro (2,3:1 no
 * branco); como texto, só sobre o marinho (5,9:1). Azul e marinho passam de 4,5:1 no branco.
 */
export const CORES = {
  /** Onda maior do logotipo: menu lateral, títulos. */
  marinho: '#13314D',
  /** Marinho mais fundo, para a última onda do menu. */
  abismo: '#0D2238',
  /** Onda do meio: ações, links, foco. */
  azul: '#0073A8',
  azulEscuro: '#005B86',
  /** Onda menor: indicadores, ondas, destaques sobre o marinho. */
  turquesa: '#59BDBC',
  /** Turquesa bem claro do site: fundos de destaque. */
  turquesaClaro: '#D4EFEE',
  /** Fundo das páginas: espuma, um branco com um pouco de água. */
  espuma: '#EEF7F7',
  borda: '#D3E6E8',
  grafite: '#2F2E2E',
  /** Texto secundário: marinho acinzentado, 6,4:1 no branco. */
  textoSecundario: '#4A6274',
  branco: '#FFFFFF',
} as const;

/** Altura mínima de alvos de toque (RNF-01). */
export const ALVO_TOQUE = 44;

export const LARGURA_MENU = 272;

const FONTE = '"Montserrat", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const tema = createTheme({
  palette: {
    primary: { main: CORES.azul, dark: CORES.azulEscuro, contrastText: CORES.branco },
    secondary: { main: CORES.marinho, contrastText: CORES.branco },
    info: { main: CORES.azul },
    text: { primary: CORES.grafite, secondary: CORES.textoSecundario },
    background: { default: CORES.espuma, paper: CORES.branco },
    divider: CORES.borda,
  },
  typography: {
    fontFamily: FONTE,
    fontSize: 14,
    h1: {
      fontSize: '1.75rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      textWrap: 'balance',
    },
    h2: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.3, textWrap: 'balance' },
    h3: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitTapHighlightColor: 'transparent' },
        body: {
          // Sistema de números: algarismos da mesma largura alinham colunas e totais.
          fontVariantNumeric: 'tabular-nums',
          touchAction: 'manipulation',
        },
        // Foco visível só no teclado; azul sobre fundo claro, turquesa sobre o marinho.
        ':focus-visible': { outline: `3px solid ${CORES.azul}`, outlineOffset: 2 },
        '.fundo-escuro :focus-visible': { outlineColor: CORES.turquesa },
      },
    },
    MuiButton: {
      styleOverrides: { root: { minHeight: ALVO_TOQUE, borderRadius: 8 } },
      defaultProps: { disableElevation: true },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: CORES.borda, borderRadius: 14 } },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiDrawer: { styleOverrides: { paper: { overscrollBehavior: 'contain' } } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiTooltip: {
      styleOverrides: { tooltip: { backgroundColor: alpha(CORES.marinho, 0.95), fontSize: 12 } },
    },
  },
});
