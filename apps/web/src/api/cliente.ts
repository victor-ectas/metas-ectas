import { CodigoErro, ErroApiSchema } from '@metas/tipos';
import type { z } from 'zod';

import { ErroApi } from './erro-api';

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpcoesCliente {
  /** Endereço base da API, sem barra no fim (ex.: `/api/v1`). */
  readonly apiUrl: string;
  /** Cabeçalhos de autenticação de cada requisição (token do Entra ID ou usuário do modo DEV). */
  readonly cabecalhosAutenticacao: () => Promise<Record<string, string>>;
  /** Chamado quando a API responde 401: o login precisa ser refeito. */
  readonly aoPerderSessao?: (erro: ErroApi) => void;
  readonly fetch?: typeof globalThis.fetch;
}

export interface ClienteApi {
  get<T>(caminho: string, schema: z.ZodType<T>): Promise<T>;
  enviar<T>(metodo: Metodo, caminho: string, corpo: unknown, schema: z.ZodType<T>): Promise<T>;
}

/**
 * Cliente HTTP da API (CLAUDE.md 5.2 e 5.3). Injeta a autenticação, valida a resposta com o schema
 * de `@metas/tipos` e transforma qualquer falha em `ErroApi` com mensagem em português.
 */
export function criarClienteApi(opcoes: OpcoesCliente): ClienteApi {
  const executarFetch = opcoes.fetch ?? globalThis.fetch.bind(globalThis);

  async function requisitar<T>(
    metodo: Metodo,
    caminho: string,
    corpo: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const cabecalhos: Record<string, string> = {
      Accept: 'application/json',
      ...(await opcoes.cabecalhosAutenticacao()),
    };
    if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

    let resposta: Response;
    try {
      resposta = await executarFetch(`${opcoes.apiUrl}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw ErroApi.semConexao();
    }

    const json = await lerJson(resposta);

    if (!resposta.ok) {
      const erro = paraErroApi(resposta.status, json);
      if (resposta.status === 401) opcoes.aoPerderSessao?.(erro);
      throw erro;
    }

    const lido = schema.safeParse(json);
    if (!lido.success) throw ErroApi.respostaInesperada(resposta.status);
    return lido.data;
  }

  return {
    get: (caminho, schema) => requisitar('GET', caminho, undefined, schema),
    enviar: (metodo, caminho, corpo, schema) => requisitar(metodo, caminho, corpo, schema),
  };
}

async function lerJson(resposta: Response): Promise<unknown> {
  if (resposta.status === 204) return undefined;
  try {
    return (await resposta.json()) as unknown;
  } catch {
    return undefined;
  }
}

function paraErroApi(status: number, json: unknown): ErroApi {
  const lido = ErroApiSchema.safeParse(json);
  if (lido.success) {
    return new ErroApi(lido.data.codigo, lido.data.mensagem, lido.data.detalhes, status);
  }
  if (status === 401) {
    return new ErroApi(
      CodigoErro.NAO_AUTENTICADO,
      'Sua sessão terminou. Entre de novo.',
      {},
      status,
    );
  }
  return ErroApi.respostaInesperada(status);
}
