import { Acumulacao, ModoApuracao, Operador, RegraPontuacao } from '@metas/tipos';

import {
  chaveVariavel,
  type Decimal,
  type MetaEntrada,
  parse,
  type VariavelEntrada,
  variaveisUsadas,
} from '../../src/index.js';

/**
 * Variável com valores a partir de janeiro. `null` = mês vazio; meses depois da lista ficam
 * vazios. Ex.: `variavel('A', 'SOMA', ['16', '20'])` = jan 16, fev 20.
 */
export function variavel(
  id: string,
  acumulacao: Acumulacao,
  valores: readonly (string | null)[],
  mesInicial = 1,
): VariavelEntrada {
  const porMes: Record<number, string | null> = {};
  valores.forEach((valor, i) => {
    porMes[mesInicial + i] = valor;
  });
  return { id, acumulacao, valores: porMes };
}

/** Repete um valor `vezes` vezes, para montar meses iguais. */
export const repetir = (valor: string, vezes: number): string[] =>
  Array.from({ length: vezes }, () => valor);

type OpcoesMeta = Partial<Omit<MetaEntrada, 'formula'>> & { formula?: string | null };

/**
 * Meta com padrões: período jan–dez, fórmula sobre acumulados, operador ≥, tudo ou nada.
 * As variáveis da fórmula são mapeadas para variáveis de mesmo id (`A` → variável `A`).
 */
export function meta(opcoes: OpcoesMeta = {}): MetaEntrada {
  const { formula: texto = 'A', ...resto } = opcoes;
  const formula = texto === null ? null : parse(texto);
  const variaveis: Record<string, string> = {};
  if (formula !== null) {
    for (const ref of variaveisUsadas(formula)) {
      const chave = chaveVariavel(ref);
      variaveis[chave] = chave;
    }
  }
  return {
    id: 'META',
    formula,
    ...(texto === null ? {} : { formulaTexto: texto }),
    variaveis,
    modoApuracao: ModoApuracao.FORMULA_SOBRE_ACUMULADOS,
    operador: Operador.GE,
    tolerancia: null,
    mesInicio: 1,
    mesFim: 12,
    objetivos: { 0: '1' },
    regraPontuacao: RegraPontuacao.TUDO_OU_NADA,
    pesoInterno: null,
    submetas: [],
    ...resto,
  };
}

/** Decimal com 6 casas (como no banco), para comparar com os números da especificação. */
export const seis = (valor: Decimal | null): string | null =>
  valor === null ? null : valor.toDecimalPlaces(6).toString();
