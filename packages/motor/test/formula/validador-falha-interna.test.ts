import { describe, expect, it, vi } from 'vitest';

// Simula uma falha inesperada (não FormulaErro) dentro do parser.
vi.mock('../../src/formula/parser.js', () => ({
  parse: () => {
    throw new TypeError('falha interna');
  },
}));

const { validar } = await import('../../src/formula/validador.js');

describe('validar com falha interna', () => {
  it('não mascara erros que não são de fórmula', () => {
    expect(() => validar('A', ['A'])).toThrow(new TypeError('falha interna'));
  });
});
