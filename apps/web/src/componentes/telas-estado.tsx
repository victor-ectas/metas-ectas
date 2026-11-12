import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material';

import { SimboloEctas } from './marca';

/** Estados de carregamento e de erro, usados enquanto o sistema inteiro ou uma página carrega. */

export function TelaCarregando(props: { readonly mensagem?: string }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: 2,
        minHeight: '50vh',
        p: 3,
      }}
    >
      {/* O único movimento automático do sistema: as ondas sobem e descem devagar enquanto
          carrega. Parado para quem pede menos movimento. */}
      <Box
        sx={{
          '@keyframes mare': {
            '0%, 100%': { transform: 'translateY(0)', opacity: 1 },
            '50%': { transform: 'translateY(-6px)', opacity: 0.75 },
          },
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'mare 1.8s ease-in-out infinite',
          },
        }}
      >
        <SimboloEctas altura={48} decorativo />
      </Box>
      <Typography color="text.secondary">{props.mensagem ?? 'Carregando…'}</Typography>
    </Box>
  );
}

export function TelaErro(props: {
  readonly titulo: string;
  readonly mensagem: string;
  readonly acao?: { readonly rotulo: string; readonly aoClicar: () => void };
}) {
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', my: 4, px: 2 }}>
      <Alert
        severity="error"
        role="alert"
        action={
          props.acao === undefined ? undefined : (
            <Button color="inherit" onClick={props.acao.aoClicar}>
              {props.acao.rotulo}
            </Button>
          )
        }
      >
        <AlertTitle>{props.titulo}</AlertTitle>
        {props.mensagem}
      </Alert>
    </Box>
  );
}
