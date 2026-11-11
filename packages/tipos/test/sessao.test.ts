import { describe, expect, it } from 'vitest';

import { SessaoSchema } from '../src/index.js';

const SESSAO = {
  usuario: {
    id: '0b6f3c1e-2a4d-4f8b-9c7e-1d2e3f4a5b6c',
    nome: 'Julia',
    email: 'julia@empresa.com.br',
    perfil: 'GESTOR',
    ativo: true,
    gerenteGeral: false,
  },
  todosOsSetores: false,
  setores: [
    { id: '1c7a4d2f-3b5e-4a9c-8d1f-2e3a4b5c6d7e', codigo: 'RH', nome: 'RH', corporativo: false },
  ],
};

describe('SessaoSchema', () => {
  it('aceita a resposta de GET /me', () => {
    expect(SessaoSchema.parse(SESSAO)).toEqual(SESSAO);
  });

  it('recusa perfil desconhecido', () => {
    expect(
      SessaoSchema.safeParse({ ...SESSAO, usuario: { ...SESSAO.usuario, perfil: 'ROOT' } }).success,
    ).toBe(false);
  });
});
