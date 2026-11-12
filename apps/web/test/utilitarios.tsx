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
  /** Corpo enviado, já convertido do JSON. */
  readonly corpo: unknown;
}

/** Resposta fixa, ou função que decide pela chamada (ex.: devolver o que foi enviado). */
export type Resposta = RespostaFalsa | Error | ((chamada: ChamadaFalsa) => RespostaFalsa);

/**
 * `fetch` que responde por caminho (sem o endereço base) e registra as chamadas. A chave pode ter
 * o método (`POST /usuarios`) e a query (`/usuarios?pagina=1`); sem eles, vale para qualquer um.
 * Procura da mais específica para a mais geral.
 */
export function fetchFalso(respostas: Readonly<Record<string, Resposta>>) {
  const chamadas: ChamadaFalsa[] = [];
  const fetch = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof entrada === 'string'
        ? entrada
        : entrada instanceof URL
          ? entrada.toString()
          : entrada.url;
    const metodo = init?.method ?? 'GET';
    const chamada: ChamadaFalsa = {
      url,
      metodo,
      cabecalhos: { ...(init?.headers as Record<string, string> | undefined) },
      corpo: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    chamadas.push(chamada);
    const caminho = url.replace(API, '');
    const semQuery = caminho.split('?')[0] ?? caminho;
    const chaves = [`${metodo} ${caminho}`, caminho, `${metodo} ${semQuery}`, semQuery];
    const encontrada = chaves.map((chave) => respostas[chave]).find((r) => r !== undefined);
    if (encontrada === undefined) {
      return Promise.reject(new Error(`Sem resposta para ${metodo} ${url}`));
    }
    if (encontrada instanceof Error) return Promise.reject(encontrada);
    const resposta = typeof encontrada === 'function' ? encontrada(chamada) : encontrada;
    return Promise.resolve(
      resposta.status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(resposta.corpo), {
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
  readonly respostas: Readonly<Record<string, Resposta>>;
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
