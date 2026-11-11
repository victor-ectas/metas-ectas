import { Decimal as DecimalBase } from 'decimal.js';

/**
 * `Decimal` do motor: um clone do decimal.js com configuração própria, para não depender nem
 * alterar a configuração global usada por outros módulos (CLAUDE.md 5.4).
 *
 * - 40 dígitos significativos: só a divisão não é exata, e o resultado final é arredondado a
 *   2 casas na exibição, então nenhum arredondamento intermediário aparece.
 * - Arredondamento meio para cima (comercial): `ROUND_HALF_UP`.
 * - `toString()` sem notação científica.
 */
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});
export type Decimal = InstanceType<typeof Decimal>;

/**
 * Valor aceito na entrada do motor: `Decimal` de qualquer configuração ou cópia do decimal.js
 * (como o `Prisma.Decimal`) ou texto decimal.
 */
export type ValorDecimal = Decimal | string;

export const ZERO = new Decimal(0);
export const UM = new Decimal(1);

/**
 * Converte a entrada para o `Decimal` do motor. Um `Decimal` de outra configuração é recriado:
 * no decimal.js as operações usam a configuração do construtor do operando, e os clones
 * compartilham o protótipo (então `instanceof` não basta).
 */
export function paraDecimal(valor: ValorDecimal): Decimal {
  if (typeof valor !== 'string' && valor.constructor === Decimal) return valor;
  return new Decimal(valor.toString());
}
