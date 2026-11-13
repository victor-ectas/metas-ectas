import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  FiltroLancamentosSchema,
  LancamentosEntradaSchema,
  MAXIMO_ITENS_LANCAMENTO,
} from '../src/index.js';

const item = (alteracoes: object = {}) => ({
  variavelId: randomUUID(),
  mes: 2,
  valor: '20',
  versao: 0,
  ...alteracoes,
});

describe('lançamentos (P18)', () => {
  it('filtro: mês vem da query string como texto', () => {
    expect(FiltroLancamentosSchema.parse({ ciclo: randomUUID(), mes: '2' }).mes).toBe(2);
    expect(FiltroLancamentosSchema.safeParse({ ciclo: randomUUID(), mes: '13' }).success).toBe(
      false,
    );
  });

  it('lote: vazio é null (RN-08), percentual como fração, versão por item', () => {
    const lote = {
      ciclo: randomUUID(),
      itens: [item({ valor: null }), item({ valor: '-0.1979', versao: 3 })],
    };
    expect(LancamentosEntradaSchema.parse(lote)).toEqual(lote);
  });

  it('recusa valor com vírgula, lote vazio, grande demais ou com item repetido', () => {
    const ciclo = randomUUID();
    expect(
      LancamentosEntradaSchema.safeParse({ ciclo, itens: [item({ valor: '1,5' })] }).success,
    ).toBe(false);
    expect(LancamentosEntradaSchema.safeParse({ ciclo, itens: [] }).success).toBe(false);
    expect(
      LancamentosEntradaSchema.safeParse({
        ciclo,
        itens: Array.from({ length: MAXIMO_ITENS_LANCAMENTO + 1 }, () => item()),
      }).success,
    ).toBe(false);
    const repetido = item();
    const r = LancamentosEntradaSchema.safeParse({ ciclo, itens: [repetido, { ...repetido }] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('A mesma variável e mês aparecem mais de uma vez.');
  });
});
