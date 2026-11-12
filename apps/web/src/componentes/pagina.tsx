import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/** Margens laterais do conteúdo, iguais em todas as páginas. */
export const MARGEM_PAGINA = { xs: 2, sm: 3, md: 5 } as const;

/** Largura máxima do conteúdo: linhas de leitura confortáveis em monitores largos. */
export const LARGURA_CONTEUDO = 1120;

/**
 * Área de conteúdo de uma página, com as margens e a largura padrão. `colada` reduz o espaço do
 * topo, para quando a página já começa com uma faixa (como o Início).
 */
export function Pagina(props: { readonly children: ReactNode; readonly colada?: boolean }) {
  return (
    <Box sx={{ px: MARGEM_PAGINA, pt: props.colada === true ? { xs: 2, md: 3 } : 4 }}>
      <Box sx={{ maxWidth: LARGURA_CONTEUDO }}>{props.children}</Box>
    </Box>
  );
}
