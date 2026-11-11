import { describe, expect, it } from 'vitest';

import { tokenizar, type Token } from '../../src/index.js';

/** Tokens sem o `fim`, só com os campos que interessam ao teste. */
function resumo(texto: string): unknown[] {
  return tokenizar(texto)
    .filter((t) => t.tipo !== 'fim')
    .map((t: Token) => {
      switch (t.tipo) {
        case 'numero':
          return ['numero', t.valor];
        case 'nome':
          return ['nome', t.setor, t.nome];
        case 'operador':
          return ['operador', t.operador];
        default:
          return [t.tipo, t.texto];
      }
    });
}

describe('tokenizador', () => {
  describe('números', () => {
    it.each([
      ['0', '0'],
      ['42', '42'],
      ['0.5', '0.5'],
      ['0,5', '0.5'],
      ['103080,27', '103080.27'],
      ['007', '007'],
    ])('"%s" vira número %s', (texto, valor) => {
      expect(resumo(texto)).toEqual([['numero', valor]]);
    });

    it('guarda o texto original e a posição', () => {
      const [token] = tokenizar('  3,25');
      expect(token).toEqual({ tipo: 'numero', valor: '3.25', texto: '3,25', posicao: 3 });
    });

    it('vírgula depois de um número que já tem decimal separa argumentos', () => {
      expect(resumo('1.5,2')).toEqual([
        ['numero', '1.5'],
        ['separador', ','],
        ['numero', '2'],
      ]);
    });

    it('vírgula seguida de espaço separa argumentos', () => {
      expect(resumo('3, 2')).toEqual([
        ['numero', '3'],
        ['separador', ','],
        ['numero', '2'],
      ]);
    });
  });

  describe('nomes', () => {
    it('variável simples, normalizada para maiúsculas', () => {
      expect(resumo('presencas')).toEqual([['nome', null, 'PRESENCAS']]);
    });

    it('aceita letras, números e _', () => {
      expect(resumo('Total_Colab2')).toEqual([['nome', null, 'TOTAL_COLAB2']]);
      expect(resumo('_X')).toEqual([['nome', null, '_X']]);
    });

    it('SETOR.VAR, normalizado para maiúsculas', () => {
      expect(resumo('rh.Total_Colab')).toEqual([['nome', 'RH', 'TOTAL_COLAB']]);
    });

    it('guarda o texto original e a posição', () => {
      const [token] = tokenizar(' rh.x');
      expect(token).toEqual({
        tipo: 'nome',
        setor: 'RH',
        nome: 'X',
        texto: 'rh.x',
        posicao: 2,
      });
    });
  });

  describe('operadores e pontuação', () => {
    it.each(['+', '-', '*', '/', '=', '<>', '<', '>', '<=', '>='])('operador %s', (op) => {
      expect(resumo(`A ${op} B`)).toEqual([
        ['nome', null, 'A'],
        ['operador', op],
        ['nome', null, 'B'],
      ]);
    });

    it('parênteses e separadores', () => {
      expect(resumo('( ) ; ,')).toEqual([
        ['abre', '('],
        ['fecha', ')'],
        ['separador', ';'],
        ['separador', ','],
      ]);
    });

    it('operadores sem espaços', () => {
      expect(resumo('A<=B<>C>=D')).toEqual([
        ['nome', null, 'A'],
        ['operador', '<='],
        ['nome', null, 'B'],
        ['operador', '<>'],
        ['nome', null, 'C'],
        ['operador', '>='],
        ['nome', null, 'D'],
      ]);
    });
  });

  it('ignora espaços, tabulações e quebras de linha', () => {
    expect(resumo(' A\t+\r\nB ')).toEqual([
      ['nome', null, 'A'],
      ['operador', '+'],
      ['nome', null, 'B'],
    ]);
  });

  it('termina sempre com o token fim, na posição depois do último caractere', () => {
    expect(tokenizar('AB').at(-1)).toEqual({ tipo: 'fim', texto: '', posicao: 3 });
    expect(tokenizar('')).toEqual([{ tipo: 'fim', texto: '', posicao: 1 }]);
  });
});
