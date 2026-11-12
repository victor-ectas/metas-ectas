import { arredondarExibicao, Decimal, paraDecimal } from '@metas/motor';
import { Unidade } from '@metas/tipos';

/**
 * Formatação de números em pt-BR (CLAUDE.md 5.4 e RNF-12). A API devolve decimais como texto; aqui
 * eles viram `Decimal` do motor, são arredondados pela mesma regra do motor (2 casas na unidade
 * exibida, meio para cima) e só então viram texto. Nenhum `number` no caminho.
 */

/** Exibido no lugar de um valor vazio: vazio não é zero (RN-08). */
export const VAZIO = '—';

/** Espaço sem quebra: "R$ 10,00" e "2,64 dias" nunca quebram de linha no meio. */
const NBSP = ' ';

export type ValorExibivel = Decimal | string | null | undefined;

function decimal(valor: Decimal | string): Decimal {
  return paraDecimal(valor);
}

/** Agrupa os milhares com ponto e usa vírgula decimal: 103080.27 → "103.080,27". */
function agrupar(valor: Decimal, casas: number): string {
  const arredondado = valor.toDecimalPlaces(casas, Decimal.ROUND_HALF_UP);
  // "-0,00" não existe: um valor que arredonda para zero é exibido sem sinal.
  const negativo = arredondado.isNegative() && !arredondado.isZero();
  const [inteiro = '0', fracao] = arredondado.abs().toFixed(casas).split('.');
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}${milhares}${fracao === undefined ? '' : `,${fracao}`}`;
}

/** Número com `casas` casas decimais (padrão 2): "1.234,57". Vazio vira "—". */
export function formatarNumero(valor: ValorExibivel, casas = 2): string {
  if (valor === null || valor === undefined) return VAZIO;
  return agrupar(decimal(valor), casas);
}

/** Moeda em reais: "R$ 1.234,57"; negativo "-R$ 1.234,57". */
export function formatarMoeda(valor: ValorExibivel): string {
  if (valor === null || valor === undefined) return VAZIO;
  const texto = agrupar(decimal(valor), 2);
  return texto.startsWith('-') ? `-R$${NBSP}${texto.slice(1)}` : `R$${NBSP}${texto}`;
}

/**
 * Percentual guardado como fração (25% → 0,25), exibido com 2 casas em pontos percentuais:
 * 0,79912 → "79,91%" (CLAUDE.md 5.4).
 */
export function formatarPercentual(fracao: ValorExibivel): string {
  if (fracao === null || fracao === undefined) return VAZIO;
  return `${agrupar(arredondarExibicao(decimal(fracao), Unidade.PERCENTUAL).times(100), 2)}%`;
}

/** SIM/NÃO guardado como 1/0 (RN-10). Qualquer valor diferente de zero é "Sim". */
export function formatarSimNao(valor: ValorExibivel): string {
  if (valor === null || valor === undefined) return VAZIO;
  return decimal(valor).isZero() ? 'Não' : 'Sim';
}

function comUnidade(valor: Decimal | string, singular: string, plural: string): string {
  const texto = agrupar(decimal(valor), 2);
  const umExato = decimal(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).abs().equals(1);
  return `${texto}${NBSP}${umExato ? singular : plural}`;
}

/** Valor na unidade da meta ou da variável: "79,91%", "R$ 10,00", "2,64 dias", "Sim". */
export function formatarValor(valor: ValorExibivel, unidade: Unidade): string {
  if (valor === null || valor === undefined) return VAZIO;
  switch (unidade) {
    case Unidade.PERCENTUAL:
      return formatarPercentual(valor);
    case Unidade.MOEDA:
      return formatarMoeda(valor);
    case Unidade.DIAS:
      return comUnidade(valor, 'dia', 'dias');
    case Unidade.HORAS:
      return comUnidade(valor, 'hora', 'horas');
    case Unidade.SIM_NAO:
      return formatarSimNao(valor);
    case Unidade.NUMERO:
      return formatarNumero(valor);
  }
}
