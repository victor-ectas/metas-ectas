import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { useAutenticacao } from './autenticacao';

/**
 * Só no modo DEV: escolhe o usuário simulado (cabeçalho `X-Usuario-Dev`). Trocar de usuário
 * descarta os dados em cache, para nada do usuário anterior aparecer.
 */
export function SeletorUsuarioDev() {
  const autenticacao = useAutenticacao();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState('');

  if (autenticacao.modo !== 'DEV') return null;
  const atual = autenticacao.usuarioDev();

  function abrir(): void {
    setEmail(atual ?? '');
    setAberto(true);
  }

  function aplicar(novo: string | null): void {
    if (autenticacao.modo !== 'DEV') return;
    autenticacao.trocarUsuarioDev(novo);
    setAberto(false);
    // Volta todas as consultas ao estado inicial (sem dados) e refaz as que estão na tela.
    void queryClient.resetQueries();
  }

  function enviar(evento: FormEvent): void {
    evento.preventDefault();
    aplicar(email);
  }

  return (
    <>
      {/* No celular a barra é estreita: o chip mostra só "DEV"; o nome completo fica no
          aria-label, para leitores de tela. */}
      <Chip
        aria-label={`DEV: ${atual ?? 'usuário padrão'}`}
        label={
          <>
            DEV
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              : {atual ?? 'usuário padrão'}
            </Box>
          </>
        }
        color="warning"
        size="small"
        onClick={abrir}
        sx={{ maxWidth: 280, flexShrink: 0 }}
      />
      <Dialog
        open={aberto}
        onClose={() => {
          setAberto(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={enviar}>
          <DialogTitle>Usuário simulado (modo DEV)</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              A API responde como este usuário, que precisa existir no banco. Em branco, vale o
              AUTH_DEV_EMAIL da API.
            </DialogContentText>
            <TextField
              label="E-mail do usuário"
              name="usuario-dev"
              type="email"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ex.: gestor@ectas.com.br"
              value={email}
              onChange={(evento) => {
                setEmail(evento.target.value);
              }}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                aplicar(null);
              }}
            >
              Usar o padrão
            </Button>
            <Button type="submit" variant="contained">
              Usar este
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
