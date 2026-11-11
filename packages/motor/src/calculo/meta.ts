import { ModoApuracao, Situacao } from '@metas/tipos';

import type { No } from '../formula/ast.js';
import { avaliar, type Escopo } from '../formula/avaliador.js';
import { Decimal, paraDecimal, ZERO } from '../formula/decimal.js';
import { chaveVariavel, variaveisUsadas } from '../formula/variaveis.js';
import { acumular, AGREGACAO_DO_MODO } from './acumulacao.js';
import { calcularAtendimento, situacaoPorAtendimento } from './atendimento.js';
import { regraEfetiva } from './pontuacao.js';
import type {
  CodigoAvisoCalculo,
  MemoriaCalculo,
  MemoriaComponente,
  MemoriaVariavel,
  MetaEntrada,
  ResultadoMes,
  ResultadoMeta,
  VariavelEntrada,
} from './tipos.js';

export const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Variáveis indexadas por id, para as funções internas. */
type MapaVariaveis = ReadonlyMap<string, VariavelEntrada>;

/**
 * Calcula uma meta e suas submetas (CLAUDE.md 8.3 a 8.6, RN-13 a RN-30):
 *
 * 1. Resultado de cada mês de 1 a 12 (meses fora do período ficam marcados como histórico).
 * 2. Acumulado do período pelo modo de apuração.
 * 3. Atendimento contra o objetivo do último mês do período (ou o único).
 * 4. Numa meta-mãe, atendimento composto pelas submetas (e pelo resultado próprio, se houver).
 *
 * Os pontos dependem do peso de cada atribuição e são calculados em `calcularCiclo`.
 */
export function calcularMeta(
  meta: MetaEntrada,
  variaveis: readonly VariavelEntrada[] | MapaVariaveis,
): ResultadoMeta {
  const mapa: MapaVariaveis =
    variaveis instanceof Map ? variaveis : new Map(lista(variaveis).map((v) => [v.id, v]));
  return calcular(meta, mapa);
}

const lista = (
  variaveis: readonly VariavelEntrada[] | MapaVariaveis,
): readonly VariavelEntrada[] => [...variaveis.values()];

function calcular(meta: MetaEntrada, variaveis: MapaVariaveis): ResultadoMeta {
  const propria = meta.formula === null ? null : calcularPropria(meta, meta.formula, variaveis);
  const submetas = meta.submetas.map((submeta) => calcular(submeta, variaveis));
  const componentes: Componente[] = meta.submetas.map((submeta, i) => ({
    meta: submeta,
    proprio: false,
    resultado: submetas[i] as ResultadoMeta,
  }));
  const temSubmetas = submetas.length > 0;
  const regra = regraEfetiva(meta.regraPontuacao, meta.operador, temSubmetas);

  let atendimento: Decimal;
  let situacao: Situacao;
  let memoriaComponentes: MemoriaComponente[] | null = null;

  if (temSubmetas) {
    if (propria !== null) componentes.push({ meta, proprio: true, resultado: propria });
    atendimento = atendimentoComposto(componentes);
    situacao = componentes.every((c) => c.resultado.situacao === Situacao.SEM_DADOS)
      ? Situacao.SEM_DADOS
      : atendimento.eq(1)
        ? Situacao.BATIDA
        : Situacao.ABAIXO;
    memoriaComponentes = componentes.map((c) => ({
      metaId: c.meta.id,
      proprio: c.proprio,
      pesoInterno: pesoInterno(c.meta).toString(),
      atendimento: c.resultado.atendimento.toString(),
    }));
  } else if (propria !== null) {
    atendimento = propria.atendimento;
    situacao = propria.situacao;
  } else {
    // Meta sem fórmula e sem submetas: configuração inválida (validarMeta acusa).
    atendimento = ZERO;
    situacao = Situacao.SEM_DADOS;
  }

  const avisos = propria?.avisos ?? [];
  const memoria: MemoriaCalculo = {
    formula: meta.formulaTexto ?? null,
    modoApuracao: meta.modoApuracao,
    periodo: { mesInicio: meta.mesInicio, mesFim: meta.mesFim },
    variaveis: propria?.memoriaVariaveis ?? [],
    resultadosMensais: propria?.memoriaResultados ?? [],
    resultado: texto(propria?.acumulado ?? null),
    objetivo: texto(propria?.objetivo ?? null),
    mesObjetivo: propria?.mesObjetivo ?? null,
    operador: meta.operador,
    tolerancia: meta.tolerancia === null ? null : paraDecimal(meta.tolerancia).toString(),
    atendimento: atendimento.toString(),
    situacao,
    regraPontuacao: regra,
    componentes: memoriaComponentes,
    avisos,
  };

  return {
    metaId: meta.id,
    mensal: propria?.mensal ?? [],
    acumulado: propria?.acumulado ?? null,
    objetivo: propria?.objetivo ?? null,
    mesObjetivo: propria?.mesObjetivo ?? null,
    atendimento,
    situacao,
    regraPontuacao: regra,
    avisos,
    submetas,
    memoria,
  };
}

interface ResultadoProprio {
  mensal: ResultadoMes[];
  acumulado: Decimal | null;
  objetivo: Decimal | null;
  mesObjetivo: number | null;
  atendimento: Decimal;
  situacao: Situacao;
  avisos: CodigoAvisoCalculo[];
  memoriaVariaveis: MemoriaVariavel[];
  memoriaResultados: { mes: number; resultado: string | null }[];
}

/** Resultado da fórmula da própria meta: mês a mês, acumulado, atendimento e situação. */
function calcularPropria(
  meta: MetaEntrada,
  formula: No,
  variaveis: MapaVariaveis,
): ResultadoProprio {
  const chaves = variaveisUsadas(formula).map(chaveVariavel);
  const doPeriodo = (mes: number): boolean => mes >= meta.mesInicio && mes <= meta.mesFim;
  const valorDe = (chave: string, mes: number): Decimal | null => {
    const id = meta.variaveis[chave];
    const valor = id === undefined ? undefined : variaveis.get(id)?.valores[mes];
    return valor === undefined || valor === null ? null : paraDecimal(valor);
  };
  const tolerancia = meta.tolerancia === null ? null : paraDecimal(meta.tolerancia);

  // 1. Resultado de cada mês (RN-16), comparado ao objetivo do mês só para exibição (RN-15).
  const mensal: ResultadoMes[] = MESES.map((mes) => {
    const escopo: Record<string, Decimal | null> = {};
    for (const chave of chaves) escopo[chave] = valorDe(chave, mes);
    const { valor: resultado, avisos } = avaliar(formula, escopo);
    const objetivo = objetivoDoMes(meta, mes).valor;
    const atendimento =
      resultado === null || objetivo === null
        ? null
        : calcularAtendimento(meta.operador, resultado, objetivo, tolerancia);
    return {
      mes,
      resultado,
      objetivo,
      atendimento,
      situacao:
        resultado === null
          ? Situacao.SEM_DADOS
          : objetivo === null
            ? null
            : situacaoPorAtendimento(meta.operador, atendimento),
      foraPeriodo: !doPeriodo(mes),
      avisos: avisos.length > 0 ? ['DIVISAO_POR_ZERO'] : [],
    };
  });
  const mesesDoPeriodo = mensal.filter((m) => !m.foraPeriodo);

  // 2. Acumulado do período (RN-17).
  const avisos: CodigoAvisoCalculo[] = [];
  let acumulado: Decimal | null;
  const memoriaVariaveis: MemoriaVariavel[] = chaves.map((chave) => {
    const valores = mesesDoPeriodo.map(({ mes }) => ({ mes, valor: valorDe(chave, mes) }));
    const id = meta.variaveis[chave] ?? null;
    const acumulacao = id === null ? null : (variaveis.get(id)?.acumulacao ?? null);
    return {
      chave,
      variavelId: id,
      acumulacao,
      valores: valores.map(({ mes, valor }) => ({ mes, valor: texto(valor) })),
      acumulado:
        meta.modoApuracao === ModoApuracao.FORMULA_SOBRE_ACUMULADOS && acumulacao !== null
          ? texto(
              acumular(
                valores.map((v) => v.valor),
                acumulacao,
              ),
            )
          : null,
    };
  });

  if (meta.modoApuracao === ModoApuracao.FORMULA_SOBRE_ACUMULADOS) {
    const escopo: Escopo = Object.fromEntries(memoriaVariaveis.map((v) => [v.chave, v.acumulado]));
    const avaliacao = avaliar(formula, escopo);
    acumulado = avaliacao.valor;
    if (avaliacao.avisos.length > 0) avisos.push('DIVISAO_POR_ZERO');
  } else {
    const regra = AGREGACAO_DO_MODO[meta.modoApuracao];
    acumulado = acumular(
      mesesDoPeriodo.map((m) => m.resultado),
      regra,
    );
  }

  // 3. Atendimento contra o objetivo do último mês do período (RN-15, RN-21).
  const { valor: objetivo, mes: mesObjetivo } = objetivoDoMes(meta, meta.mesFim);
  let atendimento: Decimal;
  let situacao: Situacao;
  if (acumulado === null) {
    atendimento = ZERO;
    situacao = Situacao.SEM_DADOS;
  } else if (objetivo === null) {
    atendimento = ZERO;
    situacao = situacaoPorAtendimento(meta.operador, ZERO);
    avisos.push('SEM_OBJETIVO');
  } else {
    atendimento = calcularAtendimento(meta.operador, acumulado, objetivo, tolerancia);
    situacao = situacaoPorAtendimento(meta.operador, atendimento);
  }

  return {
    mensal,
    acumulado,
    objetivo,
    mesObjetivo,
    atendimento,
    situacao,
    avisos,
    memoriaVariaveis,
    memoriaResultados:
      meta.modoApuracao === ModoApuracao.FORMULA_SOBRE_ACUMULADOS
        ? []
        : mesesDoPeriodo.map((m) => ({ mes: m.mes, resultado: texto(m.resultado) })),
  };
}

/** Objetivo do mês; sem objetivo mensal, o único (mês 0). */
function objetivoDoMes(
  meta: MetaEntrada,
  mes: number,
): { valor: Decimal | null; mes: number | null } {
  const mensal = meta.objetivos[mes];
  if (mensal !== undefined) return { valor: paraDecimal(mensal), mes };
  const unico = meta.objetivos[0];
  if (unico !== undefined) return { valor: paraDecimal(unico), mes: 0 };
  return { valor: null, mes: null };
}

/** Componente do atendimento composto: uma submeta ou o resultado próprio da mãe. */
interface Componente {
  meta: MetaEntrada;
  proprio: boolean;
  resultado: { atendimento: Decimal; situacao: Situacao };
}

/**
 * Atendimento da mãe = Σ(pᵢ × atᵢ) / Σpᵢ (RN-27, RN-30). Cada atᵢ já está entre 0 e 1. Com os
 * pesos somando 100%, é a fórmula da especificação; dividir pela soma evita que pesos como
 * 33,33% × 3 impeçam a mãe de chegar a 100%. Sem pesos, o atendimento é 0.
 */
function atendimentoComposto(componentes: readonly Componente[]): Decimal {
  let somaPesos = ZERO;
  let ponderado = ZERO;
  for (const { meta, resultado } of componentes) {
    const peso = pesoInterno(meta);
    somaPesos = somaPesos.plus(peso);
    ponderado = ponderado.plus(peso.times(resultado.atendimento));
  }
  return somaPesos.lte(0) ? ZERO : ponderado.div(somaPesos);
}

/** Peso interno como fração; sem peso cadastrado, 0 (validarMeta acusa). */
function pesoInterno(meta: MetaEntrada): Decimal {
  return meta.pesoInterno === null ? ZERO : paraDecimal(meta.pesoInterno);
}

function texto(valor: Decimal | null): string | null {
  return valor === null ? null : valor.toString();
}
