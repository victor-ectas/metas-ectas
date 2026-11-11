import type { OperadorBinario } from './ast.js';
import { FormulaErro } from './erros.js';

/**
 * Tokens da linguagem de fórmulas (CLAUDE.md 8.1). `texto` é o trecho como foi digitado (para
 * mensagens) e `posicao` é a coluna a partir de 1.
 */
export type Token =
  | { tipo: 'numero'; valor: string; texto: string; posicao: number }
  | { tipo: 'nome'; setor: string | null; nome: string; texto: string; posicao: number }
  | { tipo: 'operador'; operador: OperadorBinario; texto: string; posicao: number }
  | { tipo: 'abre'; texto: '('; posicao: number }
  | { tipo: 'fecha'; texto: ')'; posicao: number }
  | { tipo: 'separador'; texto: ';' | ','; posicao: number }
  | { tipo: 'fim'; texto: ''; posicao: number };

const ehDigito = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const ehInicioDeNome = (c: string | undefined): boolean => c !== undefined && /^[A-Za-z_]$/.test(c);
const ehParteDeNome = (c: string | undefined): boolean =>
  c !== undefined && /^[A-Za-z0-9_]$/.test(c);
const ehEspaco = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';

const OPERADORES_DUPLOS = ['<>', '<=', '>='] as const;
const OPERADORES_SIMPLES = ['+', '-', '*', '/', '=', '<', '>'] as const;

/**
 * Quebra o texto da fórmula em tokens. O último token é sempre `fim`.
 *
 * Vírgula: é decimal só quando está entre dois dígitos de um número que ainda não tem parte
 * decimal (`3,2`); nos demais casos separa argumentos (`ARRED(X,2)`, `ARRED(3, 2)`).
 */
export function tokenizar(texto: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < texto.length) {
    const c = texto.charAt(i);
    const posicao = i + 1;

    if (ehEspaco(c)) {
      i++;
      continue;
    }

    if (ehDigito(c)) {
      const inicio = i;
      while (ehDigito(texto[i])) i++;
      let valor = texto.slice(inicio, i);
      const sep = texto[i];
      if ((sep === '.' || sep === ',') && ehDigito(texto[i + 1])) {
        i++;
        const inicioDecimal = i;
        while (ehDigito(texto[i])) i++;
        valor += '.' + texto.slice(inicioDecimal, i);
      }
      if (texto[i] === '.') {
        throw numeroInvalido(texto, inicio);
      }
      tokens.push({ tipo: 'numero', valor, texto: texto.slice(inicio, i), posicao });
      continue;
    }

    if (c === '.' && ehDigito(texto[i + 1])) {
      throw numeroInvalido(texto, i);
    }

    if (ehInicioDeNome(c)) {
      const inicio = i;
      while (ehParteDeNome(texto[i])) i++;
      let setor: string | null = null;
      let nome = texto.slice(inicio, i);
      if (texto[i] === '.') {
        if (!ehInicioDeNome(texto[i + 1])) {
          throw new FormulaErro(
            `Esperava o código da variável depois de "${texto.slice(inicio, i + 1)}" na posição ${String(i + 2)}`,
            i + 2,
          );
        }
        i++;
        const inicioCodigo = i;
        while (ehParteDeNome(texto[i])) i++;
        setor = nome;
        nome = texto.slice(inicioCodigo, i);
        if (texto[i] === '.') {
          while (texto[i] === '.' || ehParteDeNome(texto[i])) i++;
          throw new FormulaErro(
            `Nome inválido na posição ${String(posicao)}: "${texto.slice(inicio, i)}". Use SETOR.VARIAVEL`,
            posicao,
          );
        }
      }
      tokens.push({
        tipo: 'nome',
        setor: setor === null ? null : setor.toUpperCase(),
        nome: nome.toUpperCase(),
        texto: texto.slice(inicio, i),
        posicao,
      });
      continue;
    }

    const duplo = OPERADORES_DUPLOS.find((op) => texto.startsWith(op, i));
    if (duplo !== undefined) {
      tokens.push({ tipo: 'operador', operador: duplo, texto: duplo, posicao });
      i += 2;
      continue;
    }

    const simples = OPERADORES_SIMPLES.find((op) => op === c);
    if (simples !== undefined) {
      tokens.push({ tipo: 'operador', operador: simples, texto: simples, posicao });
      i++;
      continue;
    }

    if (c === '(') {
      tokens.push({ tipo: 'abre', texto: '(', posicao });
    } else if (c === ')') {
      tokens.push({ tipo: 'fecha', texto: ')', posicao });
    } else if (c === ';' || c === ',') {
      tokens.push({ tipo: 'separador', texto: c, posicao });
    } else {
      throw new FormulaErro(`Caractere inválido "${c}" na posição ${String(posicao)}`, posicao);
    }
    i++;
  }

  tokens.push({ tipo: 'fim', texto: '', posicao: texto.length + 1 });
  return tokens;
}

/** Erro para números malformados: `1.2.3`, `5.`, `.5`. */
function numeroInvalido(texto: string, inicio: number): FormulaErro {
  let fim = inicio;
  while (ehDigito(texto[fim]) || texto[fim] === '.' || texto[fim] === ',') fim++;
  const posicao = inicio + 1;
  return new FormulaErro(
    `Número inválido na posição ${String(posicao)}: "${texto.slice(inicio, fim)}". Use, por exemplo, 0,5 ou 0.5`,
    posicao,
  );
}
