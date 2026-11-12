import { tokenizar } from './tokenizer.js';

/** Variável que mudou de código e a meta cuja fórmula será reescrita (RF-21). */
export interface Renomeacao {
  /** Código do setor da meta: resolve as referências sem prefixo. */
  readonly setorDaMeta: string;
  /** Código do setor dono da variável. */
  readonly setorDaVariavel: string;
  readonly antigo: string;
  readonly novo: string;
}

/**
 * Reescreve a fórmula trocando o código de uma variável (RF-21). Usa os tokens, não busca de
 * texto: troca `ANTIGO` quando a meta é do setor da variável e `SETOR.ANTIGO` em qualquer
 * setor, sem tocar em funções, em outras variáveis com nome parecido (`ANTIGO_2`) nem no resto do
 * texto (espaços, vírgulas e a forma como foi digitado ficam iguais).
 *
 * Devolve o texto original quando nada muda. Fórmula inválida lança `FormulaErro`.
 */
export function renomearVariavel(formula: string, renomeacao: Renomeacao): string {
  const antigo = renomeacao.antigo.toUpperCase();
  const setorDaVariavel = renomeacao.setorDaVariavel.toUpperCase();
  const setorDaMeta = renomeacao.setorDaMeta.toUpperCase();
  const tokens = tokenizar(formula);

  let resultado = '';
  let copiadoAte = 0;
  tokens.forEach((token, indice) => {
    if (token.tipo !== 'nome' || token.nome !== antigo) return;
    if (tokens[indice + 1]?.tipo === 'abre') return; // chamada de função
    if ((token.setor ?? setorDaMeta) !== setorDaVariavel) return;

    const inicio = token.posicao - 1;
    const substituto = token.setor === null ? renomeacao.novo : `${token.setor}.${renomeacao.novo}`;
    resultado += formula.slice(copiadoAte, inicio) + substituto;
    copiadoAte = inicio + token.texto.length;
  });
  return copiadoAte === 0 ? formula : resultado + formula.slice(copiadoAte);
}
