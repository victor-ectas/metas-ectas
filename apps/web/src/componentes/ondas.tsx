import { Box } from '@mui/material';

import { CORES } from '../app/tema';

/**
 * Ondas da ECTAS (ADR-015): a mesma linguagem das faixas do site ectas.com.br, onde o azul
 * desce em turquesa e termina no claro. São só decoração: ficam escondidas dos leitores de tela.
 */

/**
 * Borda ondulada no pé de uma faixa colorida: uma onda turquesa atrás e, na frente, uma onda da
 * cor do fundo da página, que "recorta" a faixa.
 */
export function OndaBorda(props: { readonly corFundo?: string }) {
  return (
    <Box
      component="svg"
      aria-hidden
      focusable="false"
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      sx={{ display: 'block', width: '100%', height: { xs: 36, md: 56 } }}
    >
      <path
        d="M0,30 C220,78 470,4 760,30 C1030,54 1250,74 1440,22 L1440,90 L0,90 Z"
        fill={CORES.turquesa}
        opacity={0.55}
      />
      <path
        d="M0,56 C260,92 520,22 800,46 C1060,68 1260,84 1440,48 L1440,90 L0,90 Z"
        fill={props.corFundo ?? CORES.espuma}
      />
    </Box>
  );
}

/**
 * As três ondas do logotipo subindo no pé do menu lateral: turquesa, azul e marinho fundo, na
 * ordem em que aparecem no símbolo.
 */
export function OndasMenu() {
  return (
    <Box
      component="svg"
      aria-hidden
      focusable="false"
      viewBox="0 0 272 120"
      preserveAspectRatio="none"
      sx={{ display: 'block', width: '100%', height: 96 }}
    >
      <path
        d="M0,34 C46,10 92,10 138,30 C184,50 228,46 272,20 L272,120 L0,120 Z"
        fill={CORES.turquesa}
        opacity={0.28}
      />
      <path
        d="M0,58 C52,36 104,40 150,58 C196,76 236,70 272,52 L272,120 L0,120 Z"
        fill={CORES.azul}
        opacity={0.7}
      />
      <path
        d="M0,84 C56,68 110,74 160,86 C206,97 244,94 272,82 L272,120 L0,120 Z"
        fill={CORES.abismo}
      />
    </Box>
  );
}
