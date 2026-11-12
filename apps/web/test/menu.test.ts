import { describe, expect, it } from 'vitest';

import { itensDoUsuario } from '../src/app/menu';
import { sessaoDe } from './utilitarios';

function rotulos(...args: Parameters<typeof sessaoDe>): string[] {
  return itensDoUsuario(sessaoDe(...args).usuario).map((item) => item.rotulo);
}

describe('menu por perfil (especificação 10.2)', () => {
  it('Administrador', () => {
    expect(rotulos('ADMIN')).toEqual([
      'Início',
      'Importar',
      'Visão geral',
      'Metas',
      'Variáveis',
      'Catálogo de modelos',
      'Ciclos e consistência',
      'Fechamento',
      'Cadastros',
    ]);
  });

  it('Gestor', () => {
    expect(rotulos('GESTOR')).toEqual(['Início', 'Minhas metas', 'Lançamentos', 'Importar']);
  });

  it('Diretoria e Leitor', () => {
    expect(rotulos('DIRETORIA')).toEqual(['Início', 'Visão geral']);
    expect(rotulos('LEITOR')).toEqual(['Início', 'Visão geral']);
  });

  it('usuário inativo só vê o Início, qualquer que seja o perfil', () => {
    expect(rotulos('ADMIN', { ativo: false })).toEqual(['Início']);
    expect(rotulos('LEITOR', { ativo: false })).toEqual(['Início']);
  });
});
