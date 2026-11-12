import { Alert, Stack, Typography } from '@mui/material';

import { CORES } from '../app/tema';
import type { ItemMenu } from '../app/menu';
import { Pagina } from '../componentes/pagina';

/** Página reservada a uma tela que ainda será construída num passo do plano. */
export function EmConstrucao(props: { readonly item: ItemMenu }) {
  return (
    <Pagina>
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        <Typography variant="h1" sx={{ color: CORES.marinho }}>
          {props.item.rotulo}
        </Typography>
        <Alert severity="info">
          Esta tela ainda está em construção
          {props.item.passo === null ? '' : ` (passo ${props.item.passo} do plano)`}.
        </Alert>
      </Stack>
    </Pagina>
  );
}
