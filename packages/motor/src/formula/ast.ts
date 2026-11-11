/**
 * Árvore sintática (AST) das fórmulas. Só objetos, textos, números e listas: é serializável em
 * JSON e fica guardada em `meta.formula_ast` (jsonb).
 *
 * `posicao` é a coluna (a partir de 1) do início do elemento no texto original, para mensagens.
 */

export type OperadorAritmetico = '+' | '-' | '*' | '/';
export type OperadorComparacao = '=' | '<>' | '<' | '>' | '<=' | '>=';
export type OperadorBinario = OperadorAritmetico | OperadorComparacao;

/** Número literal. `valor` usa ponto decimal ("0,5" vira "0.5") e é lido com `Decimal`. */
export interface NoNumero {
  tipo: 'numero';
  valor: string;
  posicao: number;
}

/** Variável. `setor` é `null` quando a fórmula usa só o código (setor da própria meta). */
export interface NoVariavel {
  tipo: 'variavel';
  setor: string | null;
  codigo: string;
  posicao: number;
}

export interface NoUnario {
  tipo: 'unario';
  operador: '-';
  operando: No;
  posicao: number;
}

export interface NoBinario {
  tipo: 'binario';
  operador: OperadorBinario;
  esquerda: No;
  direita: No;
  posicao: number;
}

/** Chamada de função genérica; nomes e aridade são conferidos pelo validador. */
export interface NoFuncao {
  tipo: 'funcao';
  nome: string;
  argumentos: No[];
  posicao: number;
}

export type No = NoNumero | NoVariavel | NoUnario | NoBinario | NoFuncao;
