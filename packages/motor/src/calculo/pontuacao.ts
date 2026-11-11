import { Operador, RegraPontuacao } from '@metas/tipos';

import { type Decimal, ZERO } from '../formula/decimal.js';

/** Metas de faixa são sempre tudo ou nada (RN-22); as demais usam a regra cadastrada. */
export function regraEfetiva(
  regra: RegraPontuacao,
  operador: Operador,
  temSubmetas: boolean,
): RegraPontuacao {
  return operador === Operador.FAIXA && !temSubmetas ? RegraPontuacao.TUDO_OU_NADA : regra;
}

/**
 * Pontos de uma atribuição (RN-22, RN-24): proporcional = peso × atendimento; tudo ou nada =
 * peso se atendimento = 1, senão 0. Como o atendimento vai no máximo a 1, os pontos nunca
 * passam do peso.
 */
export function calcularPontos(
  regra: RegraPontuacao,
  atendimento: Decimal,
  peso: Decimal,
): Decimal {
  if (regra === RegraPontuacao.PROPORCIONAL) return peso.times(atendimento);
  return atendimento.eq(1) ? peso : ZERO;
}
