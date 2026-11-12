import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { CORES } from '../app/tema';
import { SimboloEctas } from '../componentes/marca';
import { Pagina } from '../componentes/pagina';

export function NaoEncontrada() {
  return (
    <Pagina>
      <Stack spacing={2} sx={{ alignItems: 'flex-start', pt: 2 }}>
        <SimboloEctas altura={40} decorativo />
        <Typography variant="h1" sx={{ color: CORES.marinho }}>
          Página não encontrada
        </Typography>
        <Typography color="text.secondary">
          Este endereço não existe no sistema. Confira o link ou volte para o Início.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Ir para o Início
        </Button>
      </Stack>
    </Pagina>
  );
}
