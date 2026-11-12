import { CodigoErro, SessaoSchema } from '@metas/tipos';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { criarClienteApi } from '../src/api/cliente';
import { ErroApi, mensagemDeErro } from '../src/api/erro-api';
import { API, erroJson, fetchFalso, sessaoDe } from './utilitarios';

function cliente(
  respostas: Parameters<typeof fetchFalso>[0],
  aoPerderSessao?: (erro: ErroApi) => void,
) {
  const { fetch, chamadas } = fetchFalso(respostas);
  return {
    api: criarClienteApi({
      apiUrl: API,
      cabecalhosAutenticacao: () => Promise.resolve({ Authorization: 'Bearer abc' }),
      aoPerderSessao,
      fetch,
    }),
    chamadas,
  };
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroApi> {
  try {
    await promessa;
  } catch (erro) {
    if (erro instanceof ErroApi) return erro;
    throw erro;
  }
  throw new Error('Esperava ErroApi.');
}

describe('criarClienteApi', () => {
  it('injeta a autenticação e valida a resposta com o schema', async () => {
    const sessao = sessaoDe('GESTOR');
    const { api, chamadas } = cliente({ '/me': { status: 200, corpo: sessao } });
    await expect(api.get('/me', SessaoSchema)).resolves.toEqual(sessao);
    expect(chamadas).toEqual([
      {
        url: `${API}/me`,
        metodo: 'GET',
        cabecalhos: { Accept: 'application/json', Authorization: 'Bearer abc' },
      },
    ]);
  });

  it('envia JSON no corpo', async () => {
    const { api, chamadas } = cliente({ '/coisas': { status: 200, corpo: { ok: true } } });
    await api.enviar('PUT', '/coisas', { valor: '1.5' }, z.object({ ok: z.boolean() }));
    expect(chamadas[0]?.metodo).toBe('PUT');
    expect(chamadas[0]?.cabecalhos['Content-Type']).toBe('application/json');
  });

  it('204 sem corpo', async () => {
    const api = criarClienteApi({
      apiUrl: API,
      cabecalhosAutenticacao: () => Promise.resolve({}),
      fetch: () => Promise.resolve(new Response(null, { status: 204 })),
    });
    await expect(api.enviar('DELETE', '/x', undefined, z.undefined())).resolves.toBeUndefined();
  });

  it('erro no formato 5.3 vira ErroApi com código, mensagem, detalhes e status', async () => {
    const { api } = cliente({
      '/lancamentos': {
        status: 422,
        corpo: {
          codigo: 'MES_FECHADO',
          mensagem: 'Outubro/2026 fechou em 24/11/2026.',
          detalhes: { mes: 10 },
        },
      },
    });
    const erro = await erroDe(api.get('/lancamentos', z.unknown()));
    expect(erro).toMatchObject({
      codigo: CodigoErro.MES_FECHADO,
      mensagem: 'Outubro/2026 fechou em 24/11/2026.',
      detalhes: { mes: 10 },
      status: 422,
    });
    expect(erro.motivo).toBeUndefined();
    expect(mensagemDeErro(erro)).toBe('Outubro/2026 fechou em 24/11/2026.');
  });

  it('401 avisa que a sessão foi perdida, com o motivo da API', async () => {
    const aoPerderSessao = vi.fn();
    const { api } = cliente(
      {
        '/me': {
          status: 401,
          corpo: {
            ...erroJson('NAO_AUTENTICADO', 'Sessão expirada.'),
            detalhes: { motivo: 'TOKEN_EXPIRADO' },
          },
        },
      },
      aoPerderSessao,
    );
    const erro = await erroDe(api.get('/me', SessaoSchema));
    expect(erro.motivo).toBe('TOKEN_EXPIRADO');
    expect(aoPerderSessao).toHaveBeenCalledWith(erro);
  });

  it('401 fora do formato também vira NAO_AUTENTICADO', async () => {
    const { api } = cliente({ '/me': { status: 401, corpo: 'não autorizado' } });
    const erro = await erroDe(api.get('/me', SessaoSchema));
    expect(erro.codigo).toBe(CodigoErro.NAO_AUTENTICADO);
    expect(erro.mensagem).toBe('Sua sessão terminou. Entre de novo.');
  });

  it('403 não pede novo login', async () => {
    const aoPerderSessao = vi.fn();
    const { api } = cliente(
      { '/x': { status: 403, corpo: erroJson('SEM_PERMISSAO', 'Sem permissão.') } },
      aoPerderSessao,
    );
    expect((await erroDe(api.get('/x', z.unknown()))).codigo).toBe(CodigoErro.SEM_PERMISSAO);
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });

  it('resposta de erro fora do formato (ex.: página do IIS) não vaza detalhes', async () => {
    const api = criarClienteApi({
      apiUrl: API,
      cabecalhosAutenticacao: () => Promise.resolve({}),
      fetch: () => Promise.resolve(new Response('<html>502 Bad Gateway</html>', { status: 502 })),
    });
    const erro = await erroDe(api.get('/me', SessaoSchema));
    expect(erro).toMatchObject({ codigo: CodigoErro.ERRO_INTERNO, status: 502 });
    expect(erro.motivo).toBe('RESPOSTA_INESPERADA');
    expect(erro.mensagem).not.toContain('502');
  });

  it('resposta de sucesso fora do schema é tratada como erro', async () => {
    const { api } = cliente({ '/me': { status: 200, corpo: { usuario: 'x' } } });
    expect((await erroDe(api.get('/me', SessaoSchema))).motivo).toBe('RESPOSTA_INESPERADA');
  });

  it('sem rede: mensagem orientando a conferir a rede da empresa', async () => {
    const { api } = cliente({ '/me': new TypeError('Failed to fetch') });
    const erro = await erroDe(api.get('/me', SessaoSchema));
    expect(erro).toMatchObject({ codigo: CodigoErro.ERRO_INTERNO, status: null });
    expect(erro.motivo).toBe('SEM_CONEXAO');
    expect(erro.mensagem).toContain('rede da empresa');
  });

  it('erro desconhecido tem mensagem genérica', () => {
    expect(mensagemDeErro(new Error('stack interna'))).toBe(
      'Algo deu errado. Tente de novo em instantes.',
    );
  });
});
