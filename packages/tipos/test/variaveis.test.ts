import { describe, expect, it } from 'vitest';

import {
  CodigoVariavelSchema,
  FiltroVariaveisSchema,
  NOMES_RESERVADOS,
  VariavelEntradaSchema,
} from '../src/index.js';

const SETOR = '7c0e4b8a-5f0f-4a43-9d1b-1f6a2b3c4d5e';

function mensagens(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues.map((problema) => problema.message) ?? [];
}

describe('CodigoVariavelSchema', () => {
  it('normaliza para maiúsculas e tira espaços', () => {
    expect(CodigoVariavelSchema.parse(' total_req ')).toBe('TOTAL_REQ');
  });

  it.each([
    ['', 'O código é obrigatório.'],
    ['1ABC', 'Use letras sem acento, números e _, começando por letra (ex.: TOTAL_REQ).'],
    ['PRESENÇAS', 'Use letras sem acento, números e _, começando por letra (ex.: TOTAL_REQ).'],
    ['RH.TOTAL', 'Use letras sem acento, números e _, começando por letra (ex.: TOTAL_REQ).'],
    ['A'.repeat(41), 'O código pode ter no máximo 40 caracteres.'],
    ['max', 'Este código é o nome de uma função das fórmulas. Escolha outro.'],
  ])('recusa "%s"', (codigo, mensagem) => {
    expect(mensagens(CodigoVariavelSchema.safeParse(codigo))).toEqual([mensagem]);
  });

  it('reserva todos os nomes de função, inclusive os da Fase 2', () => {
    for (const nome of NOMES_RESERVADOS) {
      expect(CodigoVariavelSchema.safeParse(nome).success).toBe(false);
    }
    expect(NOMES_RESERVADOS).toContain('ANTERIOR');
  });
});

describe('VariavelEntradaSchema', () => {
  const minimo = {
    setorId: SETOR,
    codigo: 'presencas',
    nome: ' Presenças ',
    tipo: 'NUMERO',
    acumulacao: 'SOMA',
  } as const;

  it('aceita o mínimo e aplica os padrões', () => {
    expect(VariavelEntradaSchema.parse(minimo)).toEqual({
      setorId: SETOR,
      codigo: 'PRESENCAS',
      nome: 'Presenças',
      tipo: 'NUMERO',
      acumulacao: 'SOMA',
      origem: 'DIGITADA',
      responsavelId: null,
      casasDecimais: 2,
      ativo: true,
    });
  });

  it('SIM/NÃO não tem casas decimais (RN-10)', () => {
    expect(
      VariavelEntradaSchema.parse({ ...minimo, tipo: 'SIM_NAO', casasDecimais: 4 }).casasDecimais,
    ).toBe(0);
  });

  it.each([
    [{ casasDecimais: 7 }, 'As casas decimais vão de 0 a 6.'],
    [{ casasDecimais: -1 }, 'As casas decimais vão de 0 a 6.'],
    [{ casasDecimais: 1.5 }, 'As casas decimais devem ser um número inteiro.'],
    [{ nome: 'A' }, 'O nome precisa ter ao menos 2 caracteres.'],
    [{ nome: 'A'.repeat(201) }, 'O nome pode ter no máximo 200 caracteres.'],
  ])('recusa %o', (alteracao, mensagem) => {
    expect(mensagens(VariavelEntradaSchema.safeParse({ ...minimo, ...alteracao }))).toEqual([
      mensagem,
    ]);
  });

  it('recusa tipo e acumulação fora dos enums', () => {
    expect(VariavelEntradaSchema.safeParse({ ...minimo, tipo: 'TEXTO' }).success).toBe(false);
    expect(VariavelEntradaSchema.safeParse({ ...minimo, acumulacao: 'MEDIANA' }).success).toBe(
      false,
    );
  });
});

describe('FiltroVariaveisSchema', () => {
  it('setor opcional, mas precisa ser uuid', () => {
    expect(FiltroVariaveisSchema.parse({})).toEqual({});
    expect(FiltroVariaveisSchema.safeParse({ setor: 'x' }).success).toBe(false);
  });
});
