import { describe, expect, it } from 'vitest';

import { CABECALHO_USUARIO_DEV, criarAutenticacaoDev } from '../src/auth/dev';

describe('modo DEV de autenticação', () => {
  it('sem usuário escolhido não manda cabeçalho (vale o AUTH_DEV_EMAIL da API)', async () => {
    const auth = criarAutenticacaoDev(localStorage);
    expect(auth.modo).toBe('DEV');
    expect(auth.usuarioDev()).toBeNull();
    await expect(auth.cabecalhos()).resolves.toEqual({});
  });

  it('usuário escolhido vai no X-Usuario-Dev, em minúsculas, e fica guardado', async () => {
    const auth = criarAutenticacaoDev(localStorage);
    auth.trocarUsuarioDev('  Julia@Empresa.com.br ');
    await expect(auth.cabecalhos()).resolves.toEqual({
      [CABECALHO_USUARIO_DEV]: 'julia@empresa.com.br',
    });
    expect(criarAutenticacaoDev(localStorage).usuarioDev()).toBe('julia@empresa.com.br');
  });

  it('em branco volta ao padrão', () => {
    const auth = criarAutenticacaoDev(localStorage);
    auth.trocarUsuarioDev('a@b.com');
    auth.trocarUsuarioDev('   ');
    expect(auth.usuarioDev()).toBeNull();
    expect(criarAutenticacaoDev(localStorage).usuarioDev()).toBeNull();
    auth.trocarUsuarioDev('a@b.com');
    auth.trocarUsuarioDev(null);
    expect(auth.usuarioDev()).toBeNull();
  });

  it('funciona sem armazenamento, ou com um que falha', () => {
    const semArmazenamento = criarAutenticacaoDev(undefined);
    semArmazenamento.trocarUsuarioDev('a@b.com');
    expect(semArmazenamento.usuarioDev()).toBe('a@b.com');

    const quebrado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    } as unknown as Storage;
    const auth = criarAutenticacaoDev(quebrado);
    expect(auth.usuarioDev()).toBeNull();
    auth.trocarUsuarioDev('a@b.com');
    expect(auth.usuarioDev()).toBe('a@b.com');
  });

  it('401 no modo DEV não faz nada além de mostrar o erro', () => {
    const auth = criarAutenticacaoDev(undefined);
    expect(() => {
      auth.aoPerderSessao({} as never);
    }).not.toThrow();
  });
});
