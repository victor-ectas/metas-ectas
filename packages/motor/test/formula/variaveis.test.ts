import { Decimal as DecimalGlobal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { chaveVariavel, Decimal, paraDecimal, parse, variaveisUsadas } from '../../src/index.js';

describe('variaveisUsadas', () => {
  it('lista sem repetição, na ordem em que aparecem', () => {
    expect(variaveisUsadas(parse('(B + A) / B - A'))).toEqual([
      { setor: null, codigo: 'B' },
      { setor: null, codigo: 'A' },
    ]);
  });

  it('código simples e SETOR.CODIGO são variáveis diferentes', () => {
    expect(variaveisUsadas(parse('A + RH.A + RH.A'))).toEqual([
      { setor: null, codigo: 'A' },
      { setor: 'RH', codigo: 'A' },
    ]);
  });

  it('encontra variáveis dentro de funções, unários e comparações', () => {
    expect(variaveisUsadas(parse('SE(-A > 0; MAX(B; ABS(C)); 1)'))).toEqual([
      { setor: null, codigo: 'A' },
      { setor: null, codigo: 'B' },
      { setor: null, codigo: 'C' },
    ]);
  });

  it('fórmula sem variáveis', () => {
    expect(variaveisUsadas(parse('1 + 2'))).toEqual([]);
  });
});

describe('chaveVariavel', () => {
  it('CODIGO ou SETOR.CODIGO', () => {
    expect(chaveVariavel({ setor: null, codigo: 'PRESENCAS' })).toBe('PRESENCAS');
    expect(chaveVariavel({ setor: 'RH', codigo: 'TOTAL_COLAB' })).toBe('RH.TOTAL_COLAB');
  });
});

describe('paraDecimal', () => {
  it('converte texto', () => {
    expect(paraDecimal('0.25').toString()).toBe('0.25');
  });

  it('devolve o mesmo objeto quando já é Decimal do motor', () => {
    const d = new Decimal('1.5');
    expect(paraDecimal(d)).toBe(d);
  });

  it('recria Decimal de outra configuração com a configuração do motor', () => {
    const convertido = paraDecimal(new DecimalGlobal('1.5'));
    expect(convertido.constructor).toBe(Decimal);
    expect(convertido.toString()).toBe('1.5');
  });
});
