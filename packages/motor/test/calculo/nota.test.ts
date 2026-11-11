import { Acumulacao, Bloco, RegraPontuacao } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import { calcularCiclo, type MetaRaizEntrada } from '../../src/index.js';
import { meta, variavel } from './construtores.js';

const raiz = (
  id: string,
  bloco: Bloco,
  regra: RegraPontuacao = RegraPontuacao.PROPORCIONAL,
): MetaRaizEntrada => ({
  ...meta({ id, formula: id, objetivos: { 0: '1' }, regraPontuacao: regra }),
  bloco,
});

describe('calcularCiclo (RN-31)', () => {
  const entrada = {
    metas: [
      raiz('CORP1', Bloco.CORPORATIVO),
      raiz('DEP1', Bloco.DEPARTAMENTAL),
      raiz('DEP2', Bloco.DEPARTAMENTAL, RegraPontuacao.TUDO_OU_NADA),
    ],
    variaveis: [
      variavel('CORP1', Acumulacao.ULTIMO, ['0.5']),
      variavel('DEP1', Acumulacao.ULTIMO, ['1']),
      variavel('DEP2', Acumulacao.ULTIMO, ['0.9']),
    ],
    atribuicoes: [
      { id: 'a1', metaId: 'DEP1', usuarioId: 'ANA', peso: '30' },
      { id: 'a2', metaId: 'CORP1', usuarioId: 'ANA', peso: '50' },
      { id: 'a3', metaId: 'DEP2', usuarioId: 'ANA', peso: '20' },
      { id: 'a4', metaId: 'DEP1', usuarioId: 'BRUNO', peso: '100' },
    ],
  };

  it('pontos por atribuição, com bloco e peso', () => {
    const r = calcularCiclo(entrada);
    expect(
      r.atribuicoes.map((a) => [a.atribuicaoId, a.bloco, a.peso.toString(), a.pontos.toString()]),
    ).toEqual([
      ['a1', Bloco.DEPARTAMENTAL, '30', '30'],
      ['a2', Bloco.CORPORATIVO, '50', '25'],
      ['a3', Bloco.DEPARTAMENTAL, '20', '0'],
      ['a4', Bloco.DEPARTAMENTAL, '100', '100'],
    ]);
  });

  it('nota por bloco (Corporativo antes de Departamental) e nota final', () => {
    const r = calcularCiclo(entrada);
    expect(
      r.notasPorBloco.map((n) => [
        n.usuarioId,
        n.bloco,
        n.pesoTotal.toString(),
        n.pontos.toString(),
      ]),
    ).toEqual([
      ['ANA', Bloco.CORPORATIVO, '50', '25'],
      ['ANA', Bloco.DEPARTAMENTAL, '50', '30'],
      ['BRUNO', Bloco.DEPARTAMENTAL, '100', '100'],
    ]);
    expect(r.notas.map((n) => [n.usuarioId, n.pontos.toString()])).toEqual([
      ['ANA', '55'],
      ['BRUNO', '100'],
    ]);
    expect(r.metas.map((m) => m.metaId)).toEqual(['CORP1', 'DEP1', 'DEP2']);
  });

  it('ciclo sem atribuições não tem notas', () => {
    const r = calcularCiclo({ ...entrada, atribuicoes: [] });
    expect(r.notas).toEqual([]);
    expect(r.notasPorBloco).toEqual([]);
  });

  it('atribuição para meta que não é meta sem pai do ciclo é erro de dados', () => {
    expect(() =>
      calcularCiclo({
        ...entrada,
        atribuicoes: [{ id: 'x', metaId: 'SUBMETA', usuarioId: 'ANA', peso: '10' }],
      }),
    ).toThrow('Atribuição x aponta para a meta SUBMETA, que não é uma meta sem pai do ciclo');
  });
});
