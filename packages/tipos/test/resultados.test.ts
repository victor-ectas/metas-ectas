import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  FiltroResultadosGestorSchema,
  ResultadoMetaSchema,
  ResultadosGestorSchema,
} from '../src/index.js';

const id = () => randomUUID();

describe('resultados (P17)', () => {
  it('resultado da meta com mês a mês, submeta, pontos e memória', () => {
    const resultado = {
      metaId: id(),
      codigo: 'FISCAL_PRAZO',
      indicador: 'Requisições no prazo',
      unidade: 'PERCENTUAL',
      modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
      operador: 'GE',
      formula: 'REQ_ATENDIDOS / TOTAL_REQ',
      resultado: {
        acumulado: '0.8',
        objetivo: '0.8',
        atendimento: '1',
        situacao: 'BATIDA',
        calculadoEm: '2027-01-10T12:00:00.000Z',
      },
      mensal: [
        {
          mes: 1,
          resultado: '0.8',
          objetivo: '0.8',
          atendimento: '1',
          situacao: 'BATIDA',
          foraPeriodo: false,
          aviso: null,
        },
      ],
      memoria: { formula: 'REQ_ATENDIDOS / TOTAL_REQ' },
      cicloId: id(),
      setorId: id(),
      setorNome: 'Fiscal',
      bloco: 'DEPARTAMENTAL',
      regraPontuacao: 'PROPORCIONAL',
      ativo: true,
      submetas: [],
      atribuicoes: [{ usuarioId: id(), usuarioNome: 'Julia', peso: '10', pontos: '10' }],
    };
    expect(ResultadoMetaSchema.parse(resultado)).toEqual(resultado);
    expect(
      ResultadoMetaSchema.safeParse({ ...resultado, mensal: [{ ...resultado.mensal[0], mes: 13 }] })
        .success,
    ).toBe(false);
  });

  it('resultados do gestor: notas nulas para o Leitor', () => {
    const base = { cicloId: id(), usuario: { id: id(), nome: 'Julia' }, metas: [] };
    expect(ResultadosGestorSchema.parse({ ...base, notas: null }).notas).toBeNull();
    expect(
      ResultadosGestorSchema.parse({
        ...base,
        notas: {
          corporativo: null,
          departamental: { peso: '100', pontos: '87.5' },
          total: '87.5',
          calculadoEm: null,
        },
      }).notas?.total,
    ).toBe('87.5');
  });

  it('o ciclo é obrigatório na consulta do gestor', () => {
    expect(FiltroResultadosGestorSchema.safeParse({}).success).toBe(false);
    expect(FiltroResultadosGestorSchema.safeParse({ ciclo: id() }).success).toBe(true);
  });
});
