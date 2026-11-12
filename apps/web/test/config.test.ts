import { describe, expect, it } from 'vitest';

import { ConfigInvalida, lerConfig } from '../src/config';

const ENTRA = {
  VITE_ENTRA_CLIENT_ID: '11111111-1111-1111-1111-111111111111',
  VITE_ENTRA_TENANT_ID: '22222222-2222-2222-2222-222222222222',
  VITE_API_SCOPE: 'api://metas/acesso',
};

function problemas(acao: () => unknown): readonly string[] {
  try {
    acao();
  } catch (erro) {
    if (erro instanceof ConfigInvalida) return erro.problemas;
    throw erro;
  }
  throw new Error('Esperava ConfigInvalida.');
}

describe('lerConfig', () => {
  it('Entra ID com todas as variáveis', () => {
    expect(lerConfig({ ...ENTRA, VITE_API_URL: 'https://metas.local/api/v1/' }, false)).toEqual({
      apiUrl: 'https://metas.local/api/v1',
      auth: {
        modo: 'ENTRA',
        clientId: ENTRA.VITE_ENTRA_CLIENT_ID,
        tenantId: ENTRA.VITE_ENTRA_TENANT_ID,
        escopoApi: 'api://metas/acesso',
      },
    });
  });

  it('sem VITE_API_URL usa /api/v1 (mesmo endereço do site, atrás do IIS)', () => {
    expect(lerConfig({ ...ENTRA, VITE_API_URL: '' }, false).apiUrl).toBe('/api/v1');
  });

  it('modo DEV só no servidor de desenvolvimento', () => {
    expect(lerConfig({ VITE_AUTH_DEV: 'true' }, true)).toEqual({
      apiUrl: '/api/v1',
      auth: { modo: 'DEV' },
    });
  });

  it('no build de produção VITE_AUTH_DEV=true é ignorado e o Entra ID é exigido', () => {
    expect(lerConfig({ ...ENTRA, VITE_AUTH_DEV: 'true' }, false).auth.modo).toBe('ENTRA');
    expect(problemas(() => lerConfig({ VITE_AUTH_DEV: 'true' }, false))).toHaveLength(3);
  });

  it('VITE_AUTH_DEV=false no desenvolvimento usa o Entra ID', () => {
    expect(lerConfig({ ...ENTRA, VITE_AUTH_DEV: 'false' }, true).auth.modo).toBe('ENTRA');
  });

  it('lista cada variável do Entra ID que falta (vazia conta como ausente)', () => {
    expect(problemas(() => lerConfig({ ...ENTRA, VITE_ENTRA_TENANT_ID: ' ' }, false))).toEqual([
      'VITE_ENTRA_TENANT_ID é obrigatória para o login pelo Entra ID.',
    ]);
  });

  it('VITE_AUTH_DEV com valor inválido', () => {
    expect(problemas(() => lerConfig({ ...ENTRA, VITE_AUTH_DEV: 'sim' }, true))).toEqual([
      'VITE_AUTH_DEV deve ser "true" ou "false".',
    ]);
  });

  it('a mensagem do erro junta os problemas', () => {
    expect(() => lerConfig({}, false)).toThrow(
      /Configuração da web inválida:\n- VITE_ENTRA_CLIENT_ID/,
    );
  });
});
