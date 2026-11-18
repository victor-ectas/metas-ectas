import { CssBaseline, ThemeProvider } from '@mui/material';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';

import { criarClienteApi } from '../api/cliente';
import { ClienteApiContexto } from '../api/contexto';
import { type Autenticacao, AutenticacaoContexto } from '../auth/autenticacao';
import { ProvedorAvisos } from '../componentes/avisos';
import { useModoTema, usePreferencias } from './preferencias';
import { criarTema } from './tema';

/**
 * Tema claro ou escuro, pela escolha da pessoa nas Configurações (ou pelo aparelho, no modo
 * automático), e o movimento reduzido.
 */
export function ProvedorTema(props: { readonly children: ReactNode }) {
  const modo = useModoTema();
  const { reduzirMovimento } = usePreferencias();
  const tema = useMemo(() => criarTema(modo, reduzirMovimento), [modo, reduzirMovimento]);
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {props.children}
    </ThemeProvider>
  );
}

/** Tema, autenticação, cliente da API e cache de consultas: tudo de que as páginas dependem. */
export function Provedores(props: {
  readonly apiUrl: string;
  readonly autenticacao: Autenticacao;
  readonly queryClient: QueryClient;
  readonly fetch?: typeof globalThis.fetch;
  readonly children: ReactNode;
}) {
  const { apiUrl, autenticacao, fetch } = props;
  const cliente = useMemo(
    () =>
      criarClienteApi({
        apiUrl,
        cabecalhosAutenticacao: () => autenticacao.cabecalhos(),
        aoPerderSessao: (erro) => {
          autenticacao.aoPerderSessao(erro);
        },
        fetch,
      }),
    [apiUrl, autenticacao, fetch],
  );
  return (
    <ProvedorTema>
      <AutenticacaoContexto.Provider value={autenticacao}>
        <ClienteApiContexto.Provider value={cliente}>
          <QueryClientProvider client={props.queryClient}>
            <ProvedorAvisos>{props.children}</ProvedorAvisos>
          </QueryClientProvider>
        </ClienteApiContexto.Provider>
      </AutenticacaoContexto.Provider>
    </ProvedorTema>
  );
}
