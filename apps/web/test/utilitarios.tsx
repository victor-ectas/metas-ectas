import type { ErroApi as ErroApiJson, Perfil, Sessao } from '@metas/tipos';
import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { criarQueryClient } from '../src/api/consultas';
import type { Autenticacao } from '../src/auth/autenticacao';
import { criarAutenticacaoDev } from '../src/auth/dev';
import { Provedores } from '../src/app/provedores';
import { criarRotas } from '../src/app/rotas';
import { definirLarguraTela } from './preparar';

export const API = 'http://api.teste/api/v1';

export function sessaoDe(
  perfil: Perfil,
  extra: { ativo?: boolean; setores?: Sessao['setores'] } = {},
): Sessao {
  const todosOsSetores = perfil === 'ADMIN' || perfil === 'DIRETORIA';
  return {
    usuario: {
      id: '7c0e4b8a-5f0f-4a43-9d1b-1f6a2b3c4d5e',
      nome: 'Julia Martins Souza',
      email: 'julia@empresa.com.br',
      perfil,
      ativo: extra.ativo ?? true,
      gerenteGeral: false,
    },
    todosOsSetores,
    setores: todosOsSetores ? [] : (extra.setores ?? []),
  };
}

export interface RespostaFalsa {
  readonly status: number;
  readonly corpo: unknown;
}

export interface ChamadaFalsa {
  readonly url: string;
  readonly metodo: string;
  readonly cabecalhos: Record<string, string>;
}

/** `fetch` que responde por caminho (sem o endereço base) e registra as chamadas. */
export function fetchFalso(respostas: Readonly<Record<string, RespostaFalsa | Error>>) {
  const chamadas: ChamadaFalsa[] = [];
  const fetch = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof entrada === 'string'
        ? entrada
        : entrada instanceof URL
          ? entrada.toString()
          : entrada.url;
    chamadas.push({
      url,
      metodo: init?.method ?? 'GET',
      cabecalhos: { ...(init?.headers as Record<string, string> | undefined) },
    });
    const resposta = respostas[url.replace(API, '')];
    if (resposta === undefined) return Promise.reject(new Error(`Sem resposta para ${url}`));
    if (resposta instanceof Error) return Promise.reject(resposta);
    return Promise.resolve(
      new Response(JSON.stringify(resposta.corpo), {
        status: resposta.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { fetch, chamadas };
}

export function erroJson(codigo: ErroApiJson['codigo'], mensagem: string): ErroApiJson {
  return { codigo, mensagem, detalhes: {} };
}

/** Monta o sistema inteiro (rotas, layout, páginas) numa largura de tela e num endereço. */
export function renderizarApp(opcoes: {
  readonly respostas: Readonly<Record<string, RespostaFalsa | Error>>;
  readonly largura?: number;
  readonly caminho?: string;
  readonly autenticacao?: Autenticacao;
}): RenderResult & { chamadas: ChamadaFalsa[] } {
  definirLarguraTela(opcoes.largura ?? 1440);
  const { fetch, chamadas } = fetchFalso(opcoes.respostas);
  const queryClient = criarQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const roteador = createMemoryRouter(criarRotas(), { initialEntries: [opcoes.caminho ?? '/'] });
  const resultado = render(
    <Provedores
      apiUrl={API}
      autenticacao={opcoes.autenticacao ?? criarAutenticacaoDev(undefined)}
      queryClient={queryClient}
      fetch={fetch}
    >
      <RouterProvider router={roteador} />
    </Provedores>,
  );
  return { ...resultado, chamadas };
}
