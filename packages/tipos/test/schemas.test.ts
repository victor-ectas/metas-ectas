import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  DecimalStringSchema,
  MES_OBJETIVO_UNICO,
  MesObjetivoSchema,
  MesSchema,
  PaginacaoSchema,
  UuidSchema,
} from '../src/index.js';

/** Primeira mensagem de erro de uma validação que deve falhar. */
function mensagemDeErro(schema: z.ZodType, valor: unknown): string | undefined {
  const resultado = schema.safeParse(valor);
  expect(resultado.success).toBe(false);
  return resultado.error?.issues[0]?.message;
}

describe('MesSchema', () => {
  it.each([1, 6, 12])('aceita %d', (mes) => {
    expect(MesSchema.parse(mes)).toBe(mes);
  });

  it.each([0, 13, -1])('recusa %d com mensagem em português', (mes) => {
    expect(mensagemDeErro(MesSchema, mes)).toBe('O mês deve estar entre 1 e 12.');
  });

  it('recusa mês fracionado', () => {
    expect(mensagemDeErro(MesSchema, 1.5)).toBe('O mês deve ser um número inteiro.');
  });

  it.each(['1', null, undefined])('recusa %s (não é número)', (mes) => {
    expect(mensagemDeErro(MesSchema, mes)).toBe('O mês deve ser um número.');
  });
});

describe('MesObjetivoSchema', () => {
  it('aceita 0 como objetivo único', () => {
    expect(MES_OBJETIVO_UNICO).toBe(0);
    expect(MesObjetivoSchema.parse(0)).toBe(0);
  });

  it.each([1, 12])('aceita %d', (mes) => {
    expect(MesObjetivoSchema.parse(mes)).toBe(mes);
  });

  it.each([-1, 13])('recusa %d', (mes) => {
    expect(mensagemDeErro(MesObjetivoSchema, mes)).toBe(
      'O mês do objetivo deve estar entre 0 (único) e 12.',
    );
  });
});

describe('DecimalStringSchema', () => {
  it.each([
    '0',
    '1',
    '-1',
    '0.25',
    '-0.197886',
    '103080.27',
    '999999999999.999999',
    '-999999999999.999999',
    '000000000000001.5',
  ])('aceita "%s"', (valor) => {
    expect(DecimalStringSchema.parse(valor)).toBe(valor);
  });

  it.each(['', '1,5', '1.000,50', '1e3', '.5', '5.', '+1', ' 1', '1 ', 'abc', '--1', 'NaN'])(
    'recusa "%s" por formato',
    (valor) => {
      expect(mensagemDeErro(DecimalStringSchema, valor)).toBe(
        'Número decimal inválido. Use ponto como separador decimal, sem separador de milhar.',
      );
    },
  );

  it('recusa mais de 12 dígitos inteiros', () => {
    expect(mensagemDeErro(DecimalStringSchema, '1000000000000')).toBe(
      'O número pode ter no máximo 12 dígitos inteiros.',
    );
  });

  it('recusa mais de 6 casas decimais', () => {
    expect(mensagemDeErro(DecimalStringSchema, '0.1234567')).toBe(
      'O número pode ter no máximo 6 casas decimais.',
    );
  });

  it('recusa número do JavaScript (decimais trafegam como texto)', () => {
    expect(mensagemDeErro(DecimalStringSchema, 0.25)).toBe(
      'O valor deve ser um texto com número decimal.',
    );
  });

  it('com .nullable() aceita null, porque vazio não é zero', () => {
    expect(DecimalStringSchema.nullable().parse(null)).toBeNull();
  });
});

describe('UuidSchema', () => {
  it('aceita UUID', () => {
    const id = '3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e';
    expect(UuidSchema.parse(id)).toBe(id);
  });

  it('recusa texto que não é UUID', () => {
    expect(mensagemDeErro(UuidSchema, 'abc')).toBe('Identificador inválido.');
  });
});

describe('PaginacaoSchema', () => {
  it('usa página 1 e tamanho 50 por padrão', () => {
    expect(PaginacaoSchema.parse({})).toEqual({ pagina: 1, tamanho: 50 });
  });

  it('converte os valores da query string', () => {
    expect(PaginacaoSchema.parse({ pagina: '3', tamanho: '20' })).toEqual({
      pagina: 3,
      tamanho: 20,
    });
  });

  it('recusa página 0', () => {
    expect(mensagemDeErro(PaginacaoSchema, { pagina: '0' })).toBe('A página começa em 1.');
  });

  it('recusa tamanho acima de 200', () => {
    expect(mensagemDeErro(PaginacaoSchema, { tamanho: '201' })).toBe(
      'O tamanho da página pode ser no máximo 200.',
    );
  });

  it('recusa texto que não é número', () => {
    expect(mensagemDeErro(PaginacaoSchema, { pagina: 'abc' })).toBe('A página deve ser um número.');
  });
});
