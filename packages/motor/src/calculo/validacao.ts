import { Bloco, CodigoErro, MES_OBJETIVO_UNICO, Operador, RegraPontuacao } from '@metas/tipos';

import { Decimal, paraDecimal, type ValorDecimal, ZERO } from '../formula/decimal.js';
import type { ErroConsistencia, MetaEntrada } from './tipos.js';

const NOMES_MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** Nome do mês de 1 a 12 (chamado só com período válido). */
const nomeMes = (mes: number): string => NOMES_MESES[mes - 1] as string;

/** Número com 2 casas e vírgula decimal, para mensagens: 99.995 → "100,00". */
const doisDecimais = (valor: Decimal): string => valor.toFixed(2).replace('.', ',');

/**
 * Valida a configuração de uma meta e de suas submetas antes de salvar ou ativar o ciclo.
 * Devolve todos os problemas encontrados (lista vazia = ok):
 *
 * - período de 1 a 12, com início ≤ fim (RN-13);
 * - fórmula própria ou submetas;
 * - objetivo para o último mês do período ou objetivo único (RN-15);
 * - tolerância ≥ 0 no operador FAIXA (RN-20);
 * - pontuação proporcional só com objetivo > 0 (RN-23), em meta pontuada que não seja de faixa;
 * - submetas: no máximo 2 níveis (RN-26), período contido no da mãe (RN-29) e pesos internos
 *   (das submetas e do componente próprio da mãe) somando 100,00% (RN-04, RN-30).
 */
export function validarMeta(meta: MetaEntrada): ErroConsistencia[] {
  const erros: ErroConsistencia[] = [];
  validarNivel(meta, null, erros);
  return erros;
}

function validarNivel(meta: MetaEntrada, mae: MetaEntrada | null, erros: ErroConsistencia[]): void {
  const erro = (codigo: CodigoErro, mensagem: string): void => {
    erros.push({ codigo, mensagem, metaId: meta.id });
  };

  const periodoValido =
    Number.isInteger(meta.mesInicio) &&
    Number.isInteger(meta.mesFim) &&
    meta.mesInicio >= 1 &&
    meta.mesFim <= 12 &&
    meta.mesInicio <= meta.mesFim;
  if (!periodoValido) {
    erro(
      CodigoErro.VALIDACAO,
      `Período inválido (${String(meta.mesInicio)} a ${String(meta.mesFim)}): use meses de 1 a 12, com o início antes do fim`,
    );
  }

  if (
    mae !== null &&
    periodoValido &&
    (meta.mesInicio < mae.mesInicio || meta.mesFim > mae.mesFim)
  ) {
    erro(CodigoErro.VALIDACAO, 'O período da submeta precisa estar dentro do período da meta-mãe');
  }

  const temSubmetas = meta.submetas.length > 0;
  if (meta.formula === null && !temSubmetas) {
    erro(CodigoErro.VALIDACAO, 'A meta precisa de uma fórmula ou de submetas');
  }

  if (meta.formula !== null) {
    if (
      periodoValido &&
      meta.objetivos[meta.mesFim] === undefined &&
      meta.objetivos[MES_OBJETIVO_UNICO] === undefined
    ) {
      erro(
        CodigoErro.VALIDACAO,
        `Falta o objetivo: informe um objetivo único ou o objetivo de ${nomeMes(meta.mesFim)} (último mês do período)`,
      );
    }

    if (
      meta.operador === Operador.FAIXA &&
      (meta.tolerancia === null || paraDecimal(meta.tolerancia).lt(0))
    ) {
      erro(CodigoErro.VALIDACAO, 'Informe a tolerância da faixa (maior ou igual a zero)');
    }

    const pontuada = mae === null && !temSubmetas;
    if (
      pontuada &&
      meta.regraPontuacao === RegraPontuacao.PROPORCIONAL &&
      meta.operador !== Operador.FAIXA &&
      Object.values(meta.objetivos).some((o) => o !== undefined && paraDecimal(o).lte(0))
    ) {
      erro(
        CodigoErro.VALIDACAO,
        'Pontuação proporcional não é permitida com objetivo menor ou igual a zero; use tudo ou nada',
      );
    }
  }

  if (!temSubmetas) return;

  if (mae !== null) {
    erro(CodigoErro.VALIDACAO, 'Uma submeta não pode ter submetas (máximo de 2 níveis)');
    return;
  }

  const componentes = [...meta.submetas];
  if (meta.formula !== null) componentes.push(meta);
  let soma = ZERO;
  for (const componente of componentes) {
    const proprio = componente === meta;
    if (componente.pesoInterno === null || paraDecimal(componente.pesoInterno).lte(0)) {
      erros.push({
        codigo: CodigoErro.PESOS_INCONSISTENTES,
        mensagem: proprio
          ? 'Informe o peso interno do resultado próprio da meta-mãe (maior que zero)'
          : 'Informe o peso interno da submeta (maior que zero)',
        metaId: componente.id,
      });
    } else {
      soma = soma.plus(paraDecimal(componente.pesoInterno));
    }
  }
  // Pesos internos são frações: 100,00% = 1,0000 (2 casas em pontos percentuais).
  if (!soma.toDecimalPlaces(4).eq(1)) {
    erro(
      CodigoErro.PESOS_INCONSISTENTES,
      `Os pesos internos somam ${doisDecimais(soma.times(100))}%; deveriam somar 100,00%`,
    );
  }

  for (const submeta of meta.submetas) validarNivel(submeta, meta, erros);
}

/** Peso de uma meta atribuída ao gestor, com o bloco da meta. */
export interface PesoAtribuido {
  bloco: Bloco;
  peso: ValorDecimal;
}

/** Pontos que cada bloco deve somar (RN-03). */
export const PESO_BLOCO_COM_CORPORATIVAS = new Decimal(50);
export const PESO_TOTAL = new Decimal(100);

/**
 * Pesos de um gestor no ciclo (RN-03): Corporativo soma 50 e Departamental soma 50; sem metas
 * corporativas, Departamental soma 100. Os pesos departamentais somam juntos, não por setor.
 * Comparação com 2 casas.
 */
export function validarPesosGestor(atribuicoes: readonly PesoAtribuido[]): ErroConsistencia[] {
  const soma = (bloco: Bloco): Decimal =>
    atribuicoes
      .filter((a) => a.bloco === bloco)
      .reduce((total, a) => total.plus(paraDecimal(a.peso)), ZERO);
  const temCorporativas = atribuicoes.some((a) => a.bloco === Bloco.CORPORATIVO);

  const esperado: [Bloco, string, Decimal][] = temCorporativas
    ? [
        [Bloco.CORPORATIVO, 'Corporativo', PESO_BLOCO_COM_CORPORATIVAS],
        [Bloco.DEPARTAMENTAL, 'Departamental', PESO_BLOCO_COM_CORPORATIVAS],
      ]
    : [[Bloco.DEPARTAMENTAL, 'Departamental', PESO_TOTAL]];

  const erros: ErroConsistencia[] = [];
  for (const [bloco, nome, alvo] of esperado) {
    const total = soma(bloco);
    if (!total.toDecimalPlaces(2).eq(alvo)) {
      erros.push({
        codigo: CodigoErro.PESOS_INCONSISTENTES,
        mensagem: `Os pesos do bloco ${nome} somam ${doisDecimais(total)}; deveriam somar ${doisDecimais(alvo)}`,
        metaId: null,
      });
    }
  }
  return erros;
}
