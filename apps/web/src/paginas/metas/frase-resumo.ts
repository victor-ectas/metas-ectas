import { ModoApuracao, Operador, RegraPontuacao, type Unidade } from '@metas/tipos';

import { formatarNumero, formatarValor, nomeMes } from '../../formatacao';
import { type CamposCalculo, lerNumero, paraApi } from './formulario';

/**
 * Frase-resumo da meta (RF-17): "Bate quando…", em português corrente, a partir do que está
 * digitado no editor. Serve para o Administrador conferir se a meta diz o que ele quis dizer.
 */

const COMO_APURA: Readonly<Record<ModoApuracao, string>> = {
  FORMULA_SOBRE_ACUMULADOS: 'com a fórmula aplicada ao acumulado de cada variável',
  SOMA_RESULTADOS: 'somando os resultados mensais',
  MEDIA_RESULTADOS: 'pela média dos resultados mensais',
  MAXIMO_RESULTADOS: 'pelo maior resultado mensal',
  ULTIMO_RESULTADO: 'pelo último resultado mensal',
};

function periodo(inicio: number, fim: number): string {
  const de = nomeMes(inicio).toLowerCase();
  const ate = nomeMes(fim).toLowerCase();
  return inicio === fim ? `em ${de}` : `de ${de} a ${ate}`;
}

/** Valor digitado exibido na unidade da meta, ou "…" enquanto não há número válido. */
function valor(texto: string, unidade: Unidade): string {
  const convertido = paraApi(texto, unidade);
  return typeof convertido === 'string' ? formatarValor(convertido, unidade) : '…';
}

function comparacao(item: CamposCalculo): string {
  // RN-15: o acumulado compara com o objetivo do último mês do período.
  const texto =
    item.tipoObjetivo === 'UNICO'
      ? item.objetivoUnico
      : (item.objetivosMensais[item.mesFim - 1] ?? '');
  const objetivo = valor(texto, item.unidade);
  const deQualMes =
    item.tipoObjetivo === 'MENSAL' ? ` (objetivo de ${nomeMes(item.mesFim).toLowerCase()})` : '';
  switch (item.operador) {
    case Operador.GE:
      return `for maior ou igual a ${objetivo}${deQualMes}`;
    case Operador.LE:
      return `for menor ou igual a ${objetivo}${deQualMes}`;
    case Operador.EQ:
      return `for igual a ${objetivo}${deQualMes}`;
    case Operador.FAIXA: {
      const centro = lerNumero(texto);
      const tolerancia = lerNumero(item.tolerancia);
      if (centro == null || tolerancia == null) {
        return `ficar dentro da faixa de ${objetivo} ± ${valor(item.tolerancia, item.unidade)}${deQualMes}`;
      }
      const minimo = centro.minus(tolerancia).toFixed().replace('.', ',');
      const maximo = centro.plus(tolerancia).toFixed().replace('.', ',');
      return `ficar entre ${valor(minimo, item.unidade)} e ${valor(maximo, item.unidade)}${deQualMes}`;
    }
  }
}

/** "Bate quando…" de uma meta ou submeta com fórmula. */
export function fraseBateQuando(item: CamposCalculo): string {
  const formula = item.formula.trim();
  const resultado = formula === '' ? 'o resultado da fórmula' : `o resultado de ${formula}`;
  return (
    `Bate quando ${resultado}, ${periodo(item.mesInicio, item.mesFim)} ` +
    `(${COMO_APURA[item.modoApuracao]}), ${comparacao(item)}.`
  );
}

/** Mãe que só agrega as submetas (RN-27, RN-28). */
export const FRASE_SO_AGREGA =
  'Bate quando o atendimento composto das submetas, pelos pesos internos, chegar a 100%.';

/**
 * Quanto vale (RN-22 a RN-24): "Vale 10 pontos para Julia Souza, proporcional ao atendimento."
 * Faixa é sempre tudo ou nada.
 */
export function fraseVale(
  regra: RegraPontuacao,
  operador: Operador,
  atribuicoes: readonly { nome: string; peso: string }[],
): string {
  if (atribuicoes.length === 0) return 'Ainda não foi atribuída a nenhum gestor.';
  const partes = atribuicoes.map((a) => {
    const peso = lerNumero(a.peso);
    const pontos = peso == null ? '…' : formatarNumero(peso.toFixed());
    return `${pontos} ${peso?.equals(1) === true ? 'ponto' : 'pontos'} para ${a.nome}`;
  });
  const lista =
    partes.length === 1
      ? (partes[0] ?? '')
      : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1) ?? ''}`;
  const tudoOuNada = regra === RegraPontuacao.TUDO_OU_NADA || operador === Operador.FAIXA;
  return `Vale ${lista}, ${tudoOuNada ? 'só se bater (tudo ou nada)' : 'proporcional ao atendimento'}.`;
}
