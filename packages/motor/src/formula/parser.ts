import type { No, OperadorBinario } from './ast.js';
import { FormulaErro } from './erros.js';
import { type Token, tokenizar } from './tokenizer.js';

/**
 * Limite de parênteses e funções aninhados. Proteção técnica contra estouro de pilha em textos
 * patológicos; fórmulas reais ficam muito abaixo disso.
 */
export const PROFUNDIDADE_MAXIMA = 100;

const COMPARACOES: readonly OperadorBinario[] = ['=', '<>', '<', '>', '<=', '>='];
const ADITIVOS: readonly OperadorBinario[] = ['+', '-'];
const MULTIPLICATIVOS: readonly OperadorBinario[] = ['*', '/'];

/**
 * Converte o texto de uma fórmula em AST (CLAUDE.md 8.1).
 *
 * Gramática, da menor para a maior precedência:
 *
 * ```
 * formula        := comparacao FIM
 * comparacao     := aditiva (("=" | "<>" | "<" | ">" | "<=" | ">=") aditiva)*
 * aditiva        := multiplicativa (("+" | "-") multiplicativa)*
 * multiplicativa := unaria (("*" | "/") unaria)*
 * unaria         := "-" unaria | primaria
 * primaria       := NUMERO | NOME | NOME "(" argumentos? ")" | "(" comparacao ")"
 * argumentos     := comparacao (SEPARADOR comparacao)*
 * ```
 *
 * Lança `FormulaErro` com a posição do problema. Não confere se variáveis e funções existem:
 * isso é papel do validador.
 */
export function parse(texto: string): No {
  if (texto.trim() === '') {
    throw new FormulaErro('A fórmula está vazia', null);
  }
  return new Parser(tokenizar(texto)).formula();
}

class Parser {
  private indice = 0;
  private profundidade = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  formula(): No {
    const no = this.comparacao();
    const token = this.atual();
    if (token.tipo === 'fim') return no;
    if (token.tipo === 'fecha') {
      throw new FormulaErro(
        `")" sem "(" correspondente na posição ${String(token.posicao)}`,
        token.posicao,
      );
    }
    if (token.tipo === 'separador') {
      throw new FormulaErro(
        `Separador "${token.texto}" fora de função na posição ${String(token.posicao)}`,
        token.posicao,
      );
    }
    throw this.esperava('um operador', token);
  }

  private comparacao(): No {
    return this.binaria(COMPARACOES, () => this.aditiva());
  }

  private aditiva(): No {
    return this.binaria(ADITIVOS, () => this.multiplicativa());
  }

  private multiplicativa(): No {
    return this.binaria(MULTIPLICATIVOS, () => this.unaria());
  }

  /** Operadores binários de um nível de precedência, associativos à esquerda. */
  private binaria(operadores: readonly OperadorBinario[], proximo: () => No): No {
    let esquerda = proximo();
    for (;;) {
      const token = this.atual();
      if (token.tipo !== 'operador' || !operadores.includes(token.operador)) return esquerda;
      this.avancar();
      const direita = proximo();
      esquerda = {
        tipo: 'binario',
        operador: token.operador,
        esquerda,
        direita,
        posicao: token.posicao,
      };
    }
  }

  private unaria(): No {
    const token = this.atual();
    if (token.tipo === 'operador' && token.operador === '-') {
      this.avancar();
      const operando = this.aninhado(() => this.unaria());
      return { tipo: 'unario', operador: '-', operando, posicao: token.posicao };
    }
    return this.primaria();
  }

  private primaria(): No {
    const token = this.atual();

    switch (token.tipo) {
      case 'numero':
        this.avancar();
        return { tipo: 'numero', valor: token.valor, posicao: token.posicao };

      case 'nome': {
        this.avancar();
        if (this.atual().tipo !== 'abre') {
          return {
            tipo: 'variavel',
            setor: token.setor,
            codigo: token.nome,
            posicao: token.posicao,
          };
        }
        if (token.setor !== null) {
          throw new FormulaErro(
            `Função com prefixo de setor na posição ${String(token.posicao)}: "${token.texto}"`,
            token.posicao,
          );
        }
        this.avancar();
        const argumentos = this.aninhado(() => this.argumentos());
        return { tipo: 'funcao', nome: token.nome, argumentos, posicao: token.posicao };
      }

      case 'abre': {
        this.avancar();
        const no = this.aninhado(() => this.comparacao());
        this.esperarFecha();
        return no;
      }

      default:
        throw this.esperava('um valor', token);
    }
  }

  /** Lê os argumentos de uma função depois do "(" e consome o ")". */
  private argumentos(): No[] {
    if (this.atual().tipo === 'fecha') {
      this.avancar();
      return [];
    }
    const argumentos = [this.comparacao()];
    for (;;) {
      const token = this.atual();
      if (token.tipo === 'separador') {
        this.avancar();
        argumentos.push(this.comparacao());
      } else if (token.tipo === 'fecha') {
        this.avancar();
        return argumentos;
      } else if (token.tipo === 'fim') {
        throw this.esperava('")"', token);
      } else {
        throw this.esperava('";" ou ")"', token);
      }
    }
  }

  private esperarFecha(): void {
    const token = this.atual();
    if (token.tipo !== 'fecha') throw this.esperava('")"', token);
    this.avancar();
  }

  private aninhado<T>(ler: () => T): T {
    this.profundidade++;
    if (this.profundidade > PROFUNDIDADE_MAXIMA) {
      const { posicao } = this.atual();
      throw new FormulaErro(
        `A fórmula tem parênteses ou funções aninhados demais (máximo ${String(PROFUNDIDADE_MAXIMA)})`,
        posicao,
      );
    }
    try {
      return ler();
    } finally {
      this.profundidade--;
    }
  }

  private esperava(oque: string, token: Token): FormulaErro {
    const onde = token.tipo === 'fim' ? 'no fim da fórmula' : `perto de "${token.texto}"`;
    return new FormulaErro(
      `Esperava ${oque} na posição ${String(token.posicao)}, ${onde}`,
      token.posicao,
    );
  }

  private atual(): Token {
    // O último token é sempre `fim` e o parser nunca avança além dele.
    return this.tokens[this.indice] as Token;
  }

  private avancar(): void {
    this.indice++;
  }
}
