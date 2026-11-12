import { describe, expect, it } from 'vitest';

import {
  CodigoMetaSchema,
  MetaAlteracaoSchema,
  MetaEntradaSchema,
  PesoAtribuicaoSchema,
  PesoInternoSchema,
  SubmetaEntradaSchema,
  ValidarFormulaEntradaSchema,
} from '../src/index.js';

const A = '7c0e4b8a-5f0f-4a43-9d1b-1f6a2b3c4d5e';
const B = 'a1b2c3d4-0000-4000-8000-000000000002';

function mensagens(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues.map((problema) => problema.message) ?? [];
}

const submeta = {
  codigo: 'sub_1',
  indicador: 'Presença',
  metrica: 'Presenças',
  unidade: 'NUMERO',
  formula: 'PRESENCAS',
  modoApuracao: 'SOMA_RESULTADOS',
  operador: 'GE',
  mesInicio: 1,
  mesFim: 12,
  objetivos: [{ mes: 0, valor: '10' }],
  pesoInterno: '1',
} as const;

const meta = {
  setorId: A,
  codigo: 'fiscal_prazo',
  indicador: 'Requisições no prazo',
  metrica: 'Atendidas / total',
  unidade: 'PERCENTUAL',
  formula: ' REQ_ATENDIDOS / TOTAL_REQ ',
  modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
  operador: 'GE',
  mesInicio: 1,
  mesFim: 12,
  objetivos: [{ mes: 0, valor: '0.8' }],
  responsavelId: B,
  atribuicoes: [{ usuarioId: B, peso: '10' }],
} as const;

describe('MetaEntradaSchema', () => {
  it('aceita o mínimo, normaliza e aplica os padrões', () => {
    expect(MetaEntradaSchema.parse(meta)).toMatchObject({
      codigo: 'FISCAL_PRAZO',
      formula: 'REQ_ATENDIDOS / TOTAL_REQ',
      tolerancia: null,
      regraPontuacao: 'TUDO_OU_NADA',
      pesoInterno: null,
      ordem: 0,
      ativo: true,
      submetas: [],
    });
  });

  it('fórmula vazia vira null (mãe que só agrega)', () => {
    expect(MetaEntradaSchema.parse({ ...meta, formula: '  ' }).formula).toBeNull();
  });

  it.each([
    [{ mesInicio: 6, mesFim: 3 }, 'O mês final precisa ser igual ou depois do mês inicial.'],
    [
      {
        objetivos: [
          { mes: 0, valor: '1' },
          { mes: 12, valor: '1' },
        ],
      },
      'Use um objetivo único ou objetivos por mês, não os dois.',
    ],
    [
      { mesInicio: 7, objetivos: [{ mes: 3, valor: '1' }] },
      'Os objetivos mensais precisam estar dentro do período da meta.',
    ],
    [
      {
        objetivos: [
          { mes: 5, valor: '1' },
          { mes: 5, valor: '2' },
        ],
      },
      'Cada mês pode ter só um objetivo.',
    ],
    [{ atribuicoes: [] }, 'Atribua a meta a pelo menos um gestor.'],
    [
      {
        atribuicoes: [
          { usuarioId: B, peso: '1' },
          { usuarioId: B, peso: '2' },
        ],
      },
      'Cada gestor pode aparecer só uma vez nas atribuições.',
    ],
    [
      { submetas: [{ ...submeta, codigo: 'FISCAL_PRAZO' }] },
      'A meta e as submetas precisam de códigos diferentes.',
    ],
  ])('recusa %o', (alteracao, mensagem) => {
    expect(mensagens(MetaEntradaSchema.safeParse({ ...meta, ...alteracao }))).toEqual([mensagem]);
  });
});

describe('SubmetaEntradaSchema', () => {
  it('recusa submeta com submetas (RN-26)', () => {
    expect(mensagens(SubmetaEntradaSchema.safeParse({ ...submeta, submetas: [submeta] }))).toEqual([
      'Uma submeta não pode ter submetas (máximo de 2 níveis).',
    ]);
    expect(SubmetaEntradaSchema.safeParse({ ...submeta, submetas: [] }).success).toBe(true);
  });
});

describe('pesos', () => {
  it.each([
    [PesoAtribuicaoSchema, '0', 'O peso precisa ser maior que zero.'],
    [PesoAtribuicaoSchema, '100.5', 'O peso pode ser no máximo 100.'],
    [PesoInternoSchema, '-0.2', 'O peso interno precisa ser maior que zero.'],
    [PesoInternoSchema, '1.01', 'O peso interno pode ser no máximo 100%.'],
  ])('recusa %#', (schema, valor, mensagem) => {
    expect(mensagens(schema.safeParse(valor))).toEqual([mensagem]);
  });

  it('aceita os limites', () => {
    expect(PesoAtribuicaoSchema.parse('100')).toBe('100');
    expect(PesoInternoSchema.parse('1')).toBe('1');
  });
});

describe('outros', () => {
  it('código da meta em maiúsculas', () => {
    expect(CodigoMetaSchema.parse('rh_treino')).toBe('RH_TREINO');
    expect(CodigoMetaSchema.safeParse('RH TREINO').success).toBe(false);
  });

  it('alteração exige a versão', () => {
    expect(MetaAlteracaoSchema.safeParse({ meta }).success).toBe(false);
    expect(MetaAlteracaoSchema.parse({ versao: 3, meta }).versao).toBe(3);
  });

  it('validar fórmula aceita valores vazios', () => {
    expect(
      ValidarFormulaEntradaSchema.parse({
        cicloId: A,
        setorId: B,
        formula: 'X',
        valores: { X: null },
      }),
    ).toMatchObject({ valores: { X: null } });
  });
});
