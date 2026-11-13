import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  FiltroResultadosGestorSchema,
  MemoriaCalculoSchema,
  PendenciasSchema,
  ResultadoMetaSchema,
  ResultadosGestorSchema,
} from '../src/index.js';

const id = () => randomUUID();

/** Memória do CT-01 como o motor grava (RF-38). */
const memoria = {
  formula: 'REQ_ATENDIDOS / TOTAL_REQ',
  modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
  periodo: { mesInicio: 1, mesFim: 12 },
  variaveis: [
    {
      chave: 'REQ_ATENDIDOS',
      variavelId: id(),
      acumulacao: 'SOMA',
      valores: [
        { mes: 1, valor: '16' },
        { mes: 2, valor: '20' },
      ],
      acumulado: '36',
    },
  ],
  resultadosMensais: [],
  resultado: '0.8',
  objetivo: '0.8',
  mesObjetivo: 0,
  operador: 'GE',
  tolerancia: null,
  atendimento: '1',
  situacao: 'BATIDA',
  regraPontuacao: 'PROPORCIONAL',
  componentes: null,
  avisos: [],
};

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
      memoria,
      variaveis: [{ id: id(), codigo: 'REQ_ATENDIDOS', nome: 'Atendidas', tipo: 'NUMERO' }],
      cicloId: id(),
      ciclo: { id: id(), ano: 2027, status: 'ATIVO' },
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
    const ciclo = { id: id(), ano: 2027, status: 'ATIVO' };
    const base = { ciclo, ciclos: [ciclo], usuario: { id: id(), nome: 'Julia' }, metas: [] };
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

  it('gestor sem metas em ciclo visível: ciclo nulo (P20)', () => {
    const vazio = { ciclo: null, ciclos: [], usuario: { id: id(), nome: 'Julia' }, notas: null };
    expect(ResultadosGestorSchema.parse({ ...vazio, metas: [] }).ciclo).toBeNull();
  });

  it('ciclo opcional na consulta do gestor (sem ele, o ativo; P20)', () => {
    expect(FiltroResultadosGestorSchema.safeParse({}).success).toBe(true);
    expect(FiltroResultadosGestorSchema.safeParse({ ciclo: id() }).success).toBe(true);
    expect(FiltroResultadosGestorSchema.safeParse({ ciclo: 'x' }).success).toBe(false);
  });

  it('memória de cálculo: situação e operador do domínio', () => {
    expect(MemoriaCalculoSchema.parse(memoria)).toEqual(memoria);
    expect(MemoriaCalculoSchema.safeParse({ ...memoria, situacao: 'OTIMA' }).success).toBe(false);
  });

  it('pendências do Início: total por mês e ciclo nulo sem ciclo ativo (RF-28)', () => {
    expect(PendenciasSchema.parse({ ciclo: null, meses: [] }).meses).toEqual([]);
    const mes = {
      mes: 10,
      status: 'ABERTO',
      fechaEm: '2026-11-25T02:59:59.999Z',
      diasUteisRestantes: 7,
      pendentes: 3,
    };
    const ciclo = { id: id(), ano: 2026, status: 'ATIVO' };
    expect(PendenciasSchema.safeParse({ ciclo, meses: [mes] }).success).toBe(false);
    expect(PendenciasSchema.parse({ ciclo, meses: [{ ...mes, total: 5 }] }).meses[0]?.total).toBe(
      5,
    );
  });
});
