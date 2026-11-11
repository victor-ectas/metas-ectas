import type { No } from '../../src/index.js';

/**
 * Escreve a AST em notação prefixada, para os testes compararem estrutura e precedência sem
 * repetir objetos grandes. Ex.: `1 + 2 * 3` → `(+ 1 (* 2 3))`.
 */
export function notacao(no: No): string {
  switch (no.tipo) {
    case 'numero':
      return no.valor;
    case 'variavel':
      return no.setor === null ? no.codigo : `${no.setor}.${no.codigo}`;
    case 'unario':
      return `(neg ${notacao(no.operando)})`;
    case 'binario':
      return `(${no.operador} ${notacao(no.esquerda)} ${notacao(no.direita)})`;
    case 'funcao':
      return `${no.nome}[${no.argumentos.map(notacao).join(' ')}]`;
  }
}
