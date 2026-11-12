import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { CORES } from '../app/tema';

/** Título da página (h1), uma frase do que se faz nela e a ação principal, à direita. */
export function CabecalhoPagina(props: {
  readonly titulo: string;
  readonly descricao?: string;
  readonly acao?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0, maxWidth: '62ch' }}>
        <Typography variant="h1" sx={{ color: CORES.marinho }}>
          {props.titulo}
        </Typography>
        {props.descricao !== undefined && (
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {props.descricao}
          </Typography>
        )}
      </Box>
      {props.acao}
    </Box>
  );
}

/** Título de uma seção dentro da página (h2), com ação opcional. */
export function CabecalhoSecao(props: {
  /** `id` do título, para a seção apontar com `aria-labelledby`. */
  readonly id?: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly acao?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        mb: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography id={props.id} variant="h2" sx={{ color: CORES.marinho }}>
          {props.titulo}
        </Typography>
        {props.descricao !== undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: '70ch' }}>
            {props.descricao}
          </Typography>
        )}
      </Box>
      {props.acao}
    </Box>
  );
}
