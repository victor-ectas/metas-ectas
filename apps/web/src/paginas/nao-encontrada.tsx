import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

export function NaoEncontrada() {
  return (
    <Stack spacing={2} sx={{ pt: 3, alignItems: 'flex-start' }}>
      <Typography variant="h1">Página não encontrada</Typography>
      <Typography color="text.secondary">O endereço aberto não existe no sistema.</Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Ir para o Início
      </Button>
    </Stack>
  );
}
