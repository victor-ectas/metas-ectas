import {
  calcularMeta,
  Decimal,
  type MetaEntrada,
  parse,
  type ResultadoMeta,
  type VariavelEntrada,
} from '@metas/motor';
import {
  type LancamentosMes,
  type MetaLancamento,
  StatusMes,
  TipoVariavel,
  type Unidade,
  type VariavelLancamento,
} from '@metas/tipos';

import { lerNumero, paraApi, paraDigitado } from '../metas/formulario';

/**
 * Camada pura da tela de lançamentos (P19): conversão do que o gestor digita, agrupamento das
 * variáveis por meta e prévia do resultado com o mesmo motor da API (RF-24).
 */

/** O tipo da variável usa os mesmos nomes da unidade (NUMERO, PERCENTUAL, MOEDA…). */
export const unidadeDaVariavel = (v: Pick<VariavelLancamento, 'tipo'>): Unidade => v.tipo;

/** Valor gravado (fração no percentual) → texto para o campo (0 a 100, vírgula decimal). */
export const valorParaCampo = (v: VariavelLancamento, valor: string | null): string =>
  v.tipo === TipoVariavel.SIM_NAO ? (valor ?? '') : paraDigitado(valor, unidadeDaVariavel(v));

export type Leitura =
  | { readonly ok: true; readonly valor: string | null }
  | { readonly ok: false; readonly mensagem: string };

/**
 * Texto do campo → valor da API, com as regras do lançamento (ADR-024): SIM/NÃO só 1 ou 0 e no
 * máximo as casas decimais da variável, contadas no valor digitado.
 */
export function lerCampo(v: VariavelLancamento, texto: string): Leitura {
  if (v.tipo === TipoVariavel.SIM_NAO) {
    if (texto === '') return { ok: true, valor: null };
    return texto === '1' || texto === '0'
      ? { ok: true, valor: texto }
      : { ok: false, mensagem: 'Escolha Sim ou Não.' };
  }
  const digitado = lerNumero(texto);
  if (digitado === undefined) {
    return { ok: false, mensagem: 'Número inválido. Use vírgula para os decimais, ex.: 12,5.' };
  }
  if (digitado === null) return { ok: true, valor: null };
  if (digitado.decimalPlaces() > v.casasDecimais) {
    return {
      ok: false,
      mensagem:
        v.casasDecimais === 0
          ? 'Use só números inteiros.'
          : `Use no máximo ${String(v.casasDecimais)} ${v.casasDecimais === 1 ? 'casa decimal' : 'casas decimais'}.`,
    };
  }
  return { ok: true, valor: paraApi(texto, unidadeDaVariavel(v)) ?? null };
}

/** Valor da API igual ao gravado? (`"20"` e `"20.0"` são iguais; vazio só é igual a vazio.) */
export function mesmoValor(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return new Decimal(a).eq(b);
}

/** O mês aceita digitação para esta variável. */
export const podeEditar = (v: VariavelLancamento): boolean =>
  v.editavel && (v.status === StatusMes.ABERTO || v.status === StatusMes.REABERTO);

// -------------------------------------------------------------------------------------------------
// Agrupamento por meta (RF-24): cada variável aparece uma vez, na primeira meta que a usa.
// -------------------------------------------------------------------------------------------------

export interface GrupoMeta {
  readonly meta: MetaLancamento | null;
  /** Variáveis que aparecem neste grupo (do usuário, na primeira meta em que surgem). */
  readonly variaveis: readonly VariavelLancamento[];
  /** Variáveis do usuário que esta meta usa mas que aparecem num grupo anterior. */
  readonly jaMostradas: readonly VariavelLancamento[];
  /** Variáveis de outros setores que a fórmula usa (só leitura). */
  readonly deOutros: readonly VariavelLancamento[];
}

const idsDaMeta = (meta: MetaLancamento): string[] => [
  ...new Set([meta, ...meta.submetas].flatMap((m) => Object.values(m.variaveis))),
];

export function agrupar(dados: LancamentosMes): GrupoMeta[] {
  const porId = new Map(dados.variaveis.map((v) => [v.id, v]));
  const mostradas = new Set<string>();
  const grupos: GrupoMeta[] = dados.metas.map((meta) => {
    const usadas = idsDaMeta(meta).flatMap((id) => {
      const v = porId.get(id);
      return v === undefined ? [] : [v];
    });
    const minhas = usadas.filter((v) => v.editavel);
    const novas = minhas.filter((v) => !mostradas.has(v.id));
    for (const v of novas) mostradas.add(v.id);
    return {
      meta,
      variaveis: novas,
      jaMostradas: minhas.filter((v) => !novas.includes(v)),
      deOutros: usadas.filter((v) => !v.editavel),
    };
  });
  const soltas = dados.variaveis.filter((v) => v.editavel && !mostradas.has(v.id));
  if (soltas.length > 0)
    grupos.push({ meta: null, variaveis: soltas, jaMostradas: [], deOutros: [] });
  return grupos;
}

// -------------------------------------------------------------------------------------------------
// Prévia com o motor (RF-24)
// -------------------------------------------------------------------------------------------------

function paraMotor(
  m: MetaLancamento | MetaLancamento['submetas'][number],
  submetas: MetaEntrada[],
) {
  return {
    id: m.id,
    formula: m.formula === null ? null : parse(m.formula),
    formulaTexto: m.formula ?? undefined,
    variaveis: m.variaveis,
    modoApuracao: m.modoApuracao,
    operador: m.operador,
    tolerancia: m.tolerancia,
    mesInicio: m.mesInicio,
    mesFim: m.mesFim,
    objetivos: Object.fromEntries(m.objetivos.map((o) => [o.mes, o.valor])),
    regraPontuacao: 'regraPontuacao' in m ? m.regraPontuacao : 'PROPORCIONAL',
    pesoInterno: m.pesoInterno,
    submetas,
  } satisfies MetaEntrada;
}

/**
 * Resultado da meta com os valores do ano, trocando os do mês pelo que está digitado
 * (`digitados`: id → valor da API; ausente = sem mudança). `null` quando a fórmula não pôde ser
 * lida (não deveria acontecer: a API grava só fórmula válida).
 */
export function previa(
  meta: MetaLancamento,
  variaveis: readonly VariavelLancamento[],
  mes: number,
  digitados: ReadonlyMap<string, string | null>,
): ResultadoMeta | null {
  const entrada: VariavelEntrada[] = variaveis.map((v) => ({
    id: v.id,
    acumulacao: v.acumulacao,
    valores: Object.fromEntries(
      v.valoresAno.map((valor, i) => [
        i + 1,
        i + 1 === mes && digitados.has(v.id) ? (digitados.get(v.id) ?? null) : valor,
      ]),
    ),
  }));
  try {
    return calcularMeta(
      paraMotor(
        meta,
        meta.submetas.map((s) => paraMotor(s, [])),
      ),
      entrada,
    );
  } catch {
    return null;
  }
}
