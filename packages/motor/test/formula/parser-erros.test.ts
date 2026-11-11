import { describe, expect, it } from 'vitest';

import { FormulaErro, parse } from '../../src/index.js';

/** Executa o parse esperando erro e devolve o erro. */
function erroDe(texto: string): FormulaErro {
  try {
    parse(texto);
  } catch (erro) {
    if (erro instanceof FormulaErro) return erro;
    throw erro;
  }
  throw new Error(`Era esperado erro em: ${texto}`);
}

describe('parser: entradas inválidas', () => {
  it.each([
    // Exemplo exato da especificação (CLAUDE.md 8.1)
    ['(PRESENCAS / 100 EVENTOS)', 'Esperava ")" na posição 18, perto de "EVENTOS"', 18],
    ['', 'A fórmula está vazia', null],
    ['   ', 'A fórmula está vazia', null],
    ['A +', 'Esperava um valor na posição 4, no fim da fórmula', 4],
    ['(A + B', 'Esperava ")" na posição 7, no fim da fórmula', 7],
    ['A + B)', '")" sem "(" correspondente na posição 6', 6],
    ['A B', 'Esperava um operador na posição 3, perto de "B"', 3],
    ['2A', 'Esperava um operador na posição 2, perto de "A"', 2],
    ['A $ B', 'Caractere inválido "$" na posição 3', 3],
    ['A ^ 2', 'Caractere inválido "^" na posição 3', 3],
    ['PRESENÇAS', 'Caractere inválido "Ç" na posição 7', 7],
    ['1.2.3', 'Número inválido na posição 1: "1.2.3". Use, por exemplo, 0,5 ou 0.5', 1],
    ['A + 5.', 'Número inválido na posição 5: "5.". Use, por exemplo, 0,5 ou 0.5', 5],
    ['.5', 'Número inválido na posição 1: ".5". Use, por exemplo, 0,5 ou 0.5', 1],
    ['SE(A > 1; 2', 'Esperava ")" na posição 12, no fim da fórmula', 12],
    ['SE(A; ; B)', 'Esperava um valor na posição 7, perto de ";"', 7],
    ['SE(A;)', 'Esperava um valor na posição 6, perto de ")"', 6],
    ['MIN(A B)', 'Esperava ";" ou ")" na posição 7, perto de "B"', 7],
    ['A ;B', 'Separador ";" fora de função na posição 3', 3],
    ['1,5,2', 'Separador "," fora de função na posição 4', 4],
    ['RH.', 'Esperava o código da variável depois de "RH." na posição 4', 4],
    ['RH.1X', 'Esperava o código da variável depois de "RH." na posição 4', 4],
    ['RH.X.Y + 1', 'Nome inválido na posição 1: "RH.X.Y". Use SETOR.VARIAVEL', 1],
    ['RH.SOMA(1)', 'Função com prefixo de setor na posição 1: "RH.SOMA"', 1],
    ['()', 'Esperava um valor na posição 2, perto de ")"', 2],
    ['A =< B', 'Esperava um valor na posição 4, perto de "<"', 4],
    ['A */ B', 'Esperava um valor na posição 4, perto de "/"', 4],
    ['+A', 'Esperava um valor na posição 1, perto de "+"', 1],
    ['A + ;', 'Esperava um valor na posição 5, perto de ";"', 5],
  ])('%j → %s', (texto, mensagem, posicao) => {
    const erro = erroDe(texto);
    expect(erro.message).toBe(mensagem);
    expect(erro.posicao).toBe(posicao);
  });

  it('o erro tem código FORMULA_INVALIDA e nome FormulaErro', () => {
    const erro = erroDe('A +');
    expect(erro).toBeInstanceOf(Error);
    expect(erro.codigo).toBe('FORMULA_INVALIDA');
    expect(erro.name).toBe('FormulaErro');
  });

  it('recusa aninhamento acima do limite, sem estourar a pilha', () => {
    expect(erroDe('('.repeat(101) + 'A' + ')'.repeat(101)).message).toBe(
      'A fórmula tem parênteses ou funções aninhados demais (máximo 100)',
    );
    expect(erroDe('-'.repeat(5000) + 'A').message).toBe(
      'A fórmula tem parênteses ou funções aninhados demais (máximo 100)',
    );
    // A 101ª chamada aninhada passa do limite; o erro aponta o que vem depois do seu "(".
    expect(erroDe('ABS('.repeat(200) + 'A' + ')'.repeat(200)).posicao).toBe(405);
  });
});
