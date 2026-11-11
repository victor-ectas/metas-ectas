import { Unidade } from '@metas/tipos';

import type { Decimal } from '../formula/decimal.js';

/**
 * Arredondamento de exibição e de resultado final (CLAUDE.md 5.4): 2 casas na unidade exibida,
 * meio para cima. Percentual (guardado como fração) fica com 2 casas em pontos percentuais:
 * 0,79912 → 0,7991 (79,91%). Nada é arredondado no meio do cálculo.
 */
export function arredondarExibicao(valor: Decimal, unidade: Unidade): Decimal {
  return valor.toDecimalPlaces(unidade === Unidade.PERCENTUAL ? 4 : 2);
}

/** Atendimento é sempre percentual: 0,757935 → 0,7579 (75,79%). */
export function arredondarAtendimento(atendimento: Decimal): Decimal {
  return arredondarExibicao(atendimento, Unidade.PERCENTUAL);
}

/** Pontos com 2 casas: 7,57935 → 7,58. */
export function arredondarPontos(pontos: Decimal): Decimal {
  return pontos.toDecimalPlaces(2);
}
