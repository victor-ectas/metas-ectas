import { Operador, Situacao } from '@metas/tipos';

import { Decimal, UM, ZERO } from '../formula/decimal.js';

/** Diferença máxima para o operador "=" considerar o objetivo atingido (RN-21). */
export const TOLERANCIA_IGUALDADE = new Decimal('0.005');

/**
 * Atendimento entre 0 e 1 (RN-21), com R = resultado, O = objetivo e T = tolerância:
 *
 * - GE: R ≥ O → 1; senão R/O se R > 0 e O > 0; senão 0.
 * - LE: R ≤ O → 1; senão O/R se R > 0 e O > 0; senão 0.
 * - EQ: |R − O| ≤ 0,005 → 1; senão min/max se ambos > 0; senão 0.
 * - FAIXA: O − T ≤ R ≤ O + T → 1; senão 0. Sem tolerância, T = 0.
 */
export function calcularAtendimento(
  operador: Operador,
  resultado: Decimal,
  objetivo: Decimal,
  tolerancia: Decimal | null,
): Decimal {
  const ambosPositivos = resultado.gt(0) && objetivo.gt(0);
  switch (operador) {
    case Operador.GE:
      if (resultado.gte(objetivo)) return UM;
      return ambosPositivos ? resultado.div(objetivo) : ZERO;
    case Operador.LE:
      if (resultado.lte(objetivo)) return UM;
      return ambosPositivos ? objetivo.div(resultado) : ZERO;
    case Operador.EQ:
      if (resultado.minus(objetivo).abs().lte(TOLERANCIA_IGUALDADE)) return UM;
      return ambosPositivos
        ? Decimal.min(resultado, objetivo).div(Decimal.max(resultado, objetivo))
        : ZERO;
    case Operador.FAIXA: {
      const t = tolerancia ?? ZERO;
      return resultado.gte(objetivo.minus(t)) && resultado.lte(objetivo.plus(t)) ? UM : ZERO;
    }
  }
}

/** Situação de uma meta pelo atendimento (RN-25). Atendimento `null` = sem dados. */
export function situacaoPorAtendimento(operador: Operador, atendimento: Decimal | null): Situacao {
  if (atendimento === null) return Situacao.SEM_DADOS;
  if (atendimento.eq(1)) return Situacao.BATIDA;
  return operador === Operador.FAIXA ? Situacao.FORA_DA_FAIXA : Situacao.ABAIXO;
}
