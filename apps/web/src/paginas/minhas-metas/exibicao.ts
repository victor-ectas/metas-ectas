import { Decimal, paraDecimal } from '@metas/motor';
import {
  type MemoriaCalculo,
  type NotasGestor,
  Operador,
  RegraPontuacao,
  type Unidade,
} from '@metas/tipos';

import {
  formatarNumero,
  formatarPercentual,
  formatarValor,
  nomeMes,
  VAZIO,
} from '../../formatacao';

/**
 * Textos de Minhas metas (P20): objetivo, pontos, nota e memória de cálculo. Funções puras, sem
 * React, testadas à parte. Os números vêm da API como texto e são formatados com o `Decimal` do
 * motor (CLAUDE.md 5.4).
 */

export const SIMBOLO_OPERADOR: Readonly<Record<Operador, string>> = {
  GE: '≥',
  LE: '≤',
  EQ: '=',
  FAIXA: '±',
};

/** Objetivo com o operador: "≥ 80,00%", "≤ 2,00 dias", "0,00% ± 5,00%". */
export function textoObjetivo(
  operador: Operador,
  objetivo: string | null,
  tolerancia: string | null,
  unidade: Unidade,
): string {
  if (objetivo === null) return VAZIO;
  const valor = formatarValor(objetivo, unidade);
  if (operador === Operador.FAIXA) {
    return `${valor} ± ${formatarValor(tolerancia ?? '0', unidade)}`;
  }
  return `${SIMBOLO_OPERADOR[operador]} ${valor}`;
}

/** Peso sem casas quando é inteiro: "10", "12,5". */
export function formatarPeso(peso: string): string {
  const d = paraDecimal(peso);
  return formatarNumero(d, d.isInteger() ? 0 : 2);
}

/** "7,99 de 10". Sem cálculo ainda: "— de 10". */
export function textoPontos(pontos: string | null, peso: string): string {
  return `${formatarNumero(pontos)} de ${formatarPeso(peso)}`;
}

export interface ResumoNota {
  /** Soma dos pontos dos blocos, 2 casas. */
  readonly total: string;
  /** Soma dos pesos dos blocos (100 num ciclo consistente). */
  readonly peso: string;
  /** Pontos ÷ peso total, de 0 a 100 com 2 casas (altura da água no `NivelAgua`). */
  readonly nivel: string;
  readonly blocos: readonly {
    readonly nome: string;
    readonly pontos: string;
    readonly peso: string;
    /** Pontos ÷ peso, de 0 a 100, para a largura da barra: "64.70". */
    readonly largura: string;
  }[];
}

/** Nota por bloco e total (RN-31): "62,35" de "100". Só os blocos que o gestor tem. */
export function resumoNota(notas: NotasGestor): ResumoNota {
  const blocos = [
    { nome: 'Corporativo', nota: notas.corporativo },
    { nome: 'Departamental', nota: notas.departamental },
  ].flatMap(({ nome, nota }) =>
    nota === null
      ? []
      : [
          {
            nome,
            pontos: formatarNumero(nota.pontos),
            peso: formatarPeso(nota.peso),
            largura: proporcao(nota.pontos, nota.peso),
          },
        ],
  );
  const peso = [notas.corporativo, notas.departamental].reduce(
    (soma, nota) => (nota === null ? soma : soma.plus(paraDecimal(nota.peso))),
    new Decimal(0),
  );
  return {
    total: formatarNumero(notas.total),
    peso: formatarPeso(peso.toFixed()),
    nivel: proporcao(notas.total, peso.toFixed()),
    blocos,
  };
}

function proporcao(pontos: string, peso: string): string {
  const total = paraDecimal(peso);
  if (total.lte(0)) return '0';
  return Decimal.min(1, Decimal.max(0, paraDecimal(pontos).div(total)))
    .times(100)
    .toFixed(2);
}

/** "objetivo único" ou "objetivo de dezembro" (RN-15: o do último mês do período). */
export function origemDoObjetivo(mesObjetivo: number | null): string {
  if (mesObjetivo === null) return 'sem objetivo cadastrado';
  if (mesObjetivo === 0) return 'objetivo único';
  return `objetivo de ${nomeMes(mesObjetivo).toLowerCase()}`;
}

/** "Janeiro a dezembro", "Julho a dezembro", "Só em maio". */
export function textoPeriodo(periodo: MemoriaCalculo['periodo']): string {
  if (periodo.mesInicio === periodo.mesFim)
    return `Só em ${nomeMes(periodo.mesInicio).toLowerCase()}`;
  return `${nomeMes(periodo.mesInicio)} a ${nomeMes(periodo.mesFim).toLowerCase()}`;
}

/**
 * Como os pontos saíram do atendimento (RN-22 a RN-24): "10 × 79,91% = 7,99" no proporcional;
 * no tudo ou nada, vale o peso inteiro só com 100%.
 */
export function explicacaoPontos(
  regra: RegraPontuacao,
  operador: Operador,
  peso: string,
  atendimento: string,
  pontos: string | null,
): string {
  const tudoOuNada = regra === RegraPontuacao.TUDO_OU_NADA || operador === Operador.FAIXA;
  if (tudoOuNada) {
    const batida = paraDecimal(atendimento).gte(1);
    return batida
      ? `Tudo ou nada: atendimento de 100%, vale os ${formatarPeso(peso)} pontos.`
      : `Tudo ou nada: atendimento abaixo de 100%, ${formatarNumero(pontos ?? '0')} pontos.`;
  }
  return `Proporcional: ${formatarPeso(peso)} × ${formatarPercentual(atendimento)} = ${formatarNumero(pontos)} pontos.`;
}

/** Avisos do cálculo (memória), ditos para quem lê. */
export const TEXTO_AVISO: Readonly<Record<string, string>> = {
  DIVISAO_POR_ZERO:
    'Algum mês teve divisão por zero e ficou sem resultado; o acumulado ignora esse mês.',
  SEM_OBJETIVO: 'A meta não tem objetivo cadastrado para o período.',
};

export const textoAviso = (codigo: string): string => TEXTO_AVISO[codigo] ?? codigo;

/** Abreviação do mês para listas compactas: "jan", "fev". */
export const mesCurto = (mes: number): string => nomeMes(mes).slice(0, 3).toLowerCase();
