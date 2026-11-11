import type { No } from './ast.js';
import { FormulaErro } from './erros.js';
import { aridadeValida, ehFuncaoConhecida, mensagemAridade } from './funcoes.js';
import { parse } from './parser.js';
import { chaveVariavel, type ReferenciaVariavel, variaveisUsadas, visitar } from './variaveis.js';

export interface ErroValidacao {
  mensagem: string;
  /** Posição (a partir de 1) no texto, ou `null` quando não se aplica. */
  posicao: number | null;
}

export type ResultadoValidacao =
  | { valida: true; ast: No; variaveis: ReferenciaVariavel[] }
  | { valida: false; erros: ErroValidacao[] };

/**
 * Valida o texto de uma fórmula: sintaxe, funções conhecidas, quantidade de argumentos e
 * variáveis disponíveis (CLAUDE.md 8.1). Devolve todos os erros encontrados, na ordem do texto.
 *
 * `variaveisDisponiveis` usa as mesmas chaves do escopo: `CODIGO` para as variáveis do setor
 * da meta e `SETOR.CODIGO` para as de outros setores. Maiúsculas e minúsculas não importam.
 */
export function validar(texto: string, variaveisDisponiveis: Iterable<string>): ResultadoValidacao {
  let ast: No;
  try {
    ast = parse(texto);
  } catch (erro) {
    if (erro instanceof FormulaErro) {
      return { valida: false, erros: [{ mensagem: erro.message, posicao: erro.posicao }] };
    }
    throw erro;
  }

  const disponiveis = new Set([...variaveisDisponiveis].map((chave) => chave.toUpperCase()));
  const erros: ErroValidacao[] = [];
  const desconhecidas = new Set<string>();

  visitar(ast, (no) => {
    if (no.tipo === 'variavel') {
      const chave = chaveVariavel(no);
      if (!disponiveis.has(chave) && !desconhecidas.has(chave)) {
        desconhecidas.add(chave);
        erros.push({ mensagem: `Variável desconhecida: ${chave}`, posicao: no.posicao });
      }
    } else if (no.tipo === 'funcao') {
      if (!ehFuncaoConhecida(no.nome)) {
        erros.push({ mensagem: `Função desconhecida: ${no.nome}`, posicao: no.posicao });
      } else if (!aridadeValida(no.nome, no.argumentos.length)) {
        erros.push({
          mensagem: mensagemAridade(no.nome) + sugestaoPontoEVirgula(texto, no.argumentos),
          posicao: no.posicao,
        });
      }
    }
  });

  if (erros.length > 0) return { valida: false, erros };
  return { valida: true, ast, variaveis: variaveisUsadas(ast) };
}

/**
 * Quando a aridade falha e algum argumento é um número digitado com vírgula decimal
 * (ex.: `ARRED(3,2)` lido como 3,2), sugere separar os argumentos com `;`.
 */
function sugestaoPontoEVirgula(texto: string, argumentos: readonly No[]): string {
  for (const argumento of argumentos) {
    if (argumento.tipo !== 'numero') continue;
    const digitado = /^\d+,\d+/.exec(texto.slice(argumento.posicao - 1));
    if (digitado !== null) {
      return `. "${digitado[0]}" foi lido como número decimal; use ";" para separar os argumentos`;
    }
  }
  return '';
}
