import { Alert, Stack, Typography } from '@mui/material';

import type { ItemMenu } from '../app/menu';

/** Página reservada a uma tela que ainda será construída num passo do plano. */
export function EmConstrucao(props: { readonly item: ItemMenu }) {
  return (
    <Stack spacing={2} sx={{ pt: 3, maxWidth: 720 }}>
      <Typography variant="h1">{props.item.rotulo}</Typography>
      <Alert severity="info">
        Esta tela ainda está em construção
        {props.item.passo === null ? '' : ` (passo ${props.item.passo} do plano)`}.
      </Alert>
    </Stack>
  );
}
