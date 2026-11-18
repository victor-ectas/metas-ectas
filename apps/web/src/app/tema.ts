import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';

import { alpha, createTheme, type Theme } from '@mui/material/styles';

/**
 * Identidade visual da ECTAS Saneamento, pelo Manual da Identidade Visual
 * (docs/BRAND GUIDE ECTAS.pdf; ADR-015, ADR-029) e com modo escuro (ADR-030).
 *
 * Cores principais do manual: marinho #002B49 (Pantone 7463C), azul #0073A8 (7690C), turquesa
 * #66D3CD (325C) e branco. Secundárias, só de apoio: #1D1D1B, #606060, #CCCCCC.
 */

/**
 * Cores da marca, fixas nos dois modos: o que é "da ECTAS" e não do tema. O menu lateral, a barra
 * do celular e a faixa do Início continuam marinho e azul também no escuro, com texto branco, e
 * o logotipo nunca muda de cor.
 */
export const MARCA = {
  marinho: '#002B49',
  abismo: '#001C30',
  azul: '#0073A8',
  turquesa: '#66D3CD',
  branco: '#FFFFFF',
} as const;

/** Nomes dos tons do tema. Cada um tem um valor no claro e outro no escuro. */
type NomeTom =
  | 'marinho'
  | 'azul'
  | 'azulEscuro'
  | 'turquesa'
  | 'turquesaClaro'
  | 'espuma'
  | 'borda'
  | 'grafite'
  | 'textoSecundario'
  | 'branco'
  | 'alertaFundo'
  | 'alertaTexto'
  | 'alertaPonto'
  | 'erroFundo'
  | 'erroTexto'
  | 'erroPonto'
  | 'neutroFundo'
  | 'neutroPonto';

/**
 * Valores no claro. Contraste (RNF-11, AA), calculado: turquesa só como fio, indicador e
 * decoração sobre fundo claro (1,8:1 no branco). No branco: azul 5,2:1, marinho 14,6:1, cinza
 * 6,3:1; no fundo espuma, azul 4,9:1 e cinza 5,9:1.
 */
const CLARO: Readonly<Record<NomeTom, string>> = {
  /** Tinta forte: títulos, números, texto de destaque, selecionado. */
  marinho: MARCA.marinho,
  /** Ações, links, foco, frases de apoio. */
  azul: MARCA.azul,
  azulEscuro: '#005A85',
  turquesa: MARCA.turquesa,
  /** Turquesa diluída: fundos de destaque e trilhos. */
  turquesaClaro: '#E0F6F5',
  /** Fundo das páginas: branco com um fio de água. */
  espuma: '#F5F9FA',
  /** Bordas: o cinza claro do manual (#CCCCCC) levado para o tom da água. */
  borda: '#D7E3E8',
  /** Texto principal: o grafite do manual (#1D1D1B). */
  grafite: '#1D1D1B',
  /** Texto secundário: o cinza do manual (#606060). */
  textoSecundario: '#606060',
  /** Superfícies: cartões, campos, barra superior. */
  branco: MARCA.branco,
  alertaFundo: '#F6E9DC',
  alertaTexto: '#7C2D12',
  alertaPonto: '#C2410C',
  erroFundo: '#F8E4E4',
  erroTexto: '#8A1C1C',
  erroPonto: '#C53030',
  neutroFundo: '#EEF0F2',
  neutroPonto: '#9AA7B2',
};

/**
 * Valores no escuro: um mar à noite, a partir do marinho da marca. Contraste calculado nas
 * superfícies (#11212E), o pior caso: texto principal 14:1, secundário 7,7:1, tinta forte
 * 13,9:1, azul de ação 7,4:1 (botão: marinho sobre o azul, 7,8:1), turquesa 9,2:1. Selos de
 * situação: texto sobre o fundo do selo acima de 6,7:1.
 */
const ESCURO: Readonly<Record<NomeTom, string>> = {
  marinho: '#E3EEF4',
  azul: '#5CB8E6',
  azulEscuro: '#8ACDEE',
  turquesa: MARCA.turquesa,
  turquesaClaro: '#163A40',
  espuma: '#0B1620',
  borda: '#26394A',
  grafite: '#E8EEF2',
  textoSecundario: '#A3B4C1',
  branco: '#11212E',
  alertaFundo: '#3A2414',
  alertaTexto: '#F5C9A6',
  alertaPonto: '#F08A4B',
  erroFundo: '#3A1A1C',
  erroTexto: '#F4B9B9',
  erroPonto: '#EF6B6B',
  neutroFundo: '#1C2C39',
  neutroPonto: '#7C8E9C',
};

const variavel = (nome: NomeTom) =>
  `--ectas-${nome.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`;

/**
 * Tons do tema, como variáveis CSS: os componentes usam `CORES.x` e o valor certo vem do modo
 * em uso (claro ou escuro), definido no `:root` pelo `CssBaseline` do tema. Para transparência,
 * use `transparente(CORES.x, 40)` (o `alpha` do MUI não aceita variáveis).
 */
export const CORES = Object.fromEntries(
  (Object.keys(CLARO) as NomeTom[]).map((nome) => [nome, `var(${variavel(nome)})`]),
) as Readonly<Record<NomeTom, string>>;

/** Cor com transparência, aceitando variáveis CSS: `transparente(CORES.azul, 40)` = 40% de azul. */
export function transparente(cor: string, porcento: number): string {
  return `color-mix(in srgb, ${cor} ${String(porcento)}%, transparent)`;
}

/** Altura mínima de alvos de toque (RNF-01). */
export const ALVO_TOQUE = 44;

export const LARGURA_MENU = 272;

const FONTE = '"Montserrat", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Título de seção do manual ("| LOGOTIPO", "| PALETA DE CORES"): maiúsculas espaçadas, peso
 * leve, com o fio turquesa à esquerda. A maiúscula é só visual (CSS): o texto e o nome acessível
 * continuam em frase normal.
 */
export const ESTILO_TITULO_SECAO = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  lineHeight: 1.4,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: CORES.marinho,
  display: 'flex',
  alignItems: 'center',
  gap: '0.75em',
  '&::before': {
    content: '""',
    flexShrink: 0,
    width: '2px',
    height: '1.15em',
    borderRadius: '1px',
    backgroundColor: MARCA.turquesa,
  },
} as const;

export type ModoTema = 'claro' | 'escuro';

/**
 * Monta o tema do MUI para um modo. `reduzirMovimento` desliga animações e transições, além do
 * que o sistema do aparelho já pede (`prefers-reduced-motion`).
 */
export function criarTema(modo: ModoTema, reduzirMovimento = false): Theme {
  const tons = modo === 'escuro' ? ESCURO : CLARO;
  const variaveis = Object.fromEntries(
    (Object.keys(tons) as NomeTom[]).map((nome) => [variavel(nome), tons[nome]]),
  );
  return createTheme({
    palette: {
      mode: modo === 'escuro' ? 'dark' : 'light',
      primary: {
        main: tons.azul,
        dark: tons.azulEscuro,
        // No escuro o azul de ação é claro: o texto do botão fica marinho.
        contrastText: modo === 'escuro' ? MARCA.abismo : MARCA.branco,
      },
      secondary: { main: tons.marinho, contrastText: tons.branco },
      info: { main: tons.azul },
      text: { primary: tons.grafite, secondary: tons.textoSecundario },
      background: { default: tons.espuma, paper: tons.branco },
      divider: tons.borda,
    },
    typography: {
      fontFamily: FONTE,
      fontSize: 14,
      // Títulos de página em Montserrat Light, como os títulos do manual.
      h1: {
        fontSize: '2rem',
        fontWeight: 300,
        lineHeight: 1.15,
        letterSpacing: '-0.005em',
        textWrap: 'balance',
      },
      // Títulos de seção no padrão do manual ("| PALETA DE CORES").
      h2: ESTILO_TITULO_SECAO,
      h3: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { ...variaveis, colorScheme: modo === 'escuro' ? 'dark' : 'light' },
          html: { WebkitTapHighlightColor: 'transparent' },
          body: {
            // Sistema de números: algarismos da mesma largura alinham colunas e totais.
            fontVariantNumeric: 'tabular-nums',
            touchAction: 'manipulation',
          },
          // Foco visível só no teclado; azul sobre fundo claro, turquesa sobre o marinho.
          ':focus-visible': { outline: `3px solid ${tons.azul}`, outlineOffset: 2 },
          '.fundo-escuro :focus-visible': { outlineColor: MARCA.turquesa },
          '::selection': { backgroundColor: alpha(MARCA.turquesa, 0.45) },
          // Escolha da pessoa nas Configurações: sem animações nem transições.
          ...(reduzirMovimento
            ? {
                '*, *::before, *::after': {
                  animationDuration: '0.01ms !important',
                  animationIterationCount: '1 !important',
                  transitionDuration: '0.01ms !important',
                  scrollBehavior: 'auto !important',
                },
              }
            : {}),
        },
      },
      // Botões arredondados como os terminais do logotipo.
      MuiButton: {
        styleOverrides: {
          root: { minHeight: ALVO_TOQUE, borderRadius: 999, paddingInline: 20 },
          outlined: {
            borderColor: alpha(tons.azul, 0.45),
            '&:hover': { borderColor: tons.azul },
          },
        },
        defaultProps: { disableElevation: true },
      },
      MuiIconButton: { styleOverrides: { root: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE } } },
      MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
      // Superfícies: borda fina, sem sombra; o raio maior que o dos campos marca a hierarquia.
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderColor: tons.borda, borderRadius: 18 } },
      },
      MuiPaper: {
        // O MUI clareia o papel no escuro com uma imagem de fundo; aqui a cor vem dos tons.
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: tons.borda },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: tons.branco,
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(tons.azul, 0.6) },
          },
          notchedOutline: { borderColor: tons.borda },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } },
      MuiDrawer: { styleOverrides: { paper: { overscrollBehavior: 'contain' } } },
      MuiAppBar: { defaultProps: { elevation: 0 } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
      MuiTooltip: {
        styleOverrides: { tooltip: { backgroundColor: alpha(MARCA.marinho, 0.95), fontSize: 12 } },
      },
    },
  });
}
