import { Alert, AlertTitle, Box, Button, CircularProgress, Typography } from '@mui/material';

/** Estados de carregamento e de erro, usados enquanto o sistema inteiro ou uma página carrega. */

export function TelaCarregando(props: { readonly mensagem?: string }) {
  return (
    <Box
      role="status"
      sx={{ display: 'grid', placeItems: 'center', gap: 2, minHeight: '50vh', p: 3 }}
    >
      <CircularProgress aria-hidden />
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
