import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { MARCA } from '../app/tema';
import simbolo from '../assets/ectas-simbolo.png';
import simboloBranco from '../assets/ectas-simbolo-branco.png';

/** Proporção do arquivo do símbolo (283 × 192). */
const PROPORCAO = 192 / 283;

/** Altura da linha d'água ondulada no topo do nível, em px. */
const ONDA = 7;

/** Uma onda por ladrilho, para recortar o topo do nível (preto = visível, na máscara). */
const MASCARA_ONDA = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="${String(ONDA)}" viewBox="0 0 28 ${String(ONDA)}" preserveAspectRatio="none"><path d="M0 ${String(ONDA)}V3.5C4.7 0 9.3 0 14 3.5S23.3 7 28 3.5V${String(ONDA)}Z" fill="#000"/></svg>`,
)}")`;

/**
 * O símbolo da ECTAS como janela (Manual da Identidade Visual, exemplos de aplicação): as três
 * ondas do logotipo se enchem das próprias cores até o nível pedido, como água num recipiente.
 * Usado na nota parcial: o número vem escrito ao lado, então o desenho é decorativo.
 *
 * O símbolo é sempre o arquivo oficial, sem deformar. No claro, a água tem as cores oficiais e o
 * "vazio" é o mesmo símbolo esmaecido. No escuro, como o manual pede para fundos marinhos, o
 * símbolo é monocromático: a água em turquesa e o vazio em branco translúcido. A água sobe uma vez
 * ao abrir a tela (parada para quem pede menos movimento).
 */
export function NivelAgua(props: {
  /** Nível de 0 a 100 (texto com ponto decimal, como vem de `resumoNota`). */
  readonly nivel: string;
  /** Largura do símbolo, em px. */
  readonly largura: number;
}) {
  const escuro = useTheme().palette.mode === 'dark';
  const nivel = Math.min(100, Math.max(0, Number(props.nivel) || 0));
  const altura = Math.round(props.largura * PROPORCAO);
  /** Símbolo inteiro: o arquivo colorido (claro) ou a forma do branco pintada numa cor (escuro). */
  const desenho = (cor: string | null, extra: object = {}): ReactNode =>
    cor === null ? (
      <Box
        component="img"
        src={simbolo}
        alt=""
        width={props.largura}
        height={altura}
        sx={{ display: 'block', ...extra }}
      />
    ) : (
      <Box
        sx={{
          width: props.largura,
          height: altura,
          bgcolor: cor,
          maskImage: `url(${simboloBranco})`,
          maskSize: '100% 100%',
          WebkitMaskImage: `url(${simboloBranco})`,
          WebkitMaskSize: '100% 100%',
          ...extra,
        }}
      />
    );
  return (
    <Box
      aria-hidden
      sx={{ position: 'relative', width: props.largura, height: altura, flexShrink: 0 }}
    >
      {/* Vazio: o símbolo esmaecido. */}
      {escuro
        ? desenho(alpha(MARCA.branco, 0.12), { position: 'absolute', inset: 0 })
        : desenho(null, { position: 'absolute', inset: 0, opacity: 0.16 })}
      {/* Água: o símbolo nas cores oficiais, só até o nível, com a linha d'água em ondas. */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${String(nivel)}%`,
          overflow: 'hidden',
          maskImage: `${MASCARA_ONDA}, linear-gradient(#000, #000)`,
          maskSize: `28px ${String(ONDA)}px, 100% calc(100% - ${String(ONDA - 1)}px)`,
          maskPosition: `0 0, 0 ${String(ONDA - 1)}px`,
          maskRepeat: 'repeat-x, no-repeat',
          WebkitMaskImage: `${MASCARA_ONDA}, linear-gradient(#000, #000)`,
          WebkitMaskSize: `28px ${String(ONDA)}px, 100% calc(100% - ${String(ONDA - 1)}px)`,
          WebkitMaskPosition: `0 0, 0 ${String(ONDA - 1)}px`,
          WebkitMaskRepeat: 'repeat-x, no-repeat',
          '@keyframes encher': { from: { height: '0%' } },
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'encher 1.4s cubic-bezier(0.22, 1, 0.36, 1) both',
          },
        }}
      >
        {desenho(escuro ? MARCA.turquesa : null, { position: 'absolute', left: 0, bottom: 0 })}
      </Box>
    </Box>
  );
}
