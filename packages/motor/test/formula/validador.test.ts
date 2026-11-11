import { describe, expect, it } from 'vitest';

import { FUNCOES, parse, validar } from '../../src/index.js';

const DISPONIVEIS = ['PRESENCAS', 'EVENTOS', 'X', 'RH.TOTAL_COLAB'];

/** Mensagens de erro da validação (lista vazia se for válida). */
function erros(texto: string, disponiveis: Iterable<string> = DISPONIVEIS): string[] {
  const resultado = validar(texto, disponiveis);
  return resultado.valida ? [] : resultado.erros.map((e) => e.mensagem);
}

describe('validar', () => {
  it('fórmula válida devolve a AST e as variáveis usadas', () => {
    const resultado = validar('PRESENCAS / EVENTOS + RH.TOTAL_COLAB', DISPONIVEIS);
    expect(resultado).toEqual({
      valida: true,
      ast: parse('PRESENCAS / EVENTOS + RH.TOTAL_COLAB'),
      variaveis: [
        { setor: null, codigo: 'PRESENCAS' },
        { setor: null, codigo: 'EVENTOS' },
        { setor: 'RH', codigo: 'TOTAL_COLAB' },
      ],
    });
  });

  it('não diferencia maiúsculas na fórmula nem na lista de disponíveis', () => {
    expect(erros('presencas + rh.total_colab', ['Presencas', 'rh.Total_Colab'])).toEqual([]);
  });

  it('fórmula só com números é válida e não usa variáveis', () => {
    expect(validar('ARRED(1 / 3; 2)', [])).toMatchObject({ valida: true, variaveis: [] });
  });

  it('todas as funções da Fase 1 com a aridade certa são válidas', () => {
    expect(
      erros('SE(E(X; 1); OU(X; 0); NAO(X)) + ARRED(X; 2) + MIN(X; 1; 2) + MAX(X) + ABS(X)'),
    ).toEqual([]);
    expect(Object.keys(FUNCOES)).toEqual(['SE', 'E', 'OU', 'NAO', 'ARRED', 'MIN', 'MAX', 'ABS']);
  });

  describe('variáveis', () => {
    it('variável desconhecida, com a mensagem da especificação e a posição', () => {
      expect(validar('PRESENCAS / TOTAL', DISPONIVEIS)).toEqual({
        valida: false,
        erros: [{ mensagem: 'Variável desconhecida: TOTAL', posicao: 13 }],
      });
    });

    it('variável de outro setor desconhecida', () => {
      expect(erros('FISCAL.TOTAL_COLAB')).toEqual(['Variável desconhecida: FISCAL.TOTAL_COLAB']);
    });

    it('código simples não casa com SETOR.CODIGO, e vice-versa', () => {
      expect(erros('TOTAL_COLAB')).toEqual(['Variável desconhecida: TOTAL_COLAB']);
      expect(erros('RH.PRESENCAS')).toEqual(['Variável desconhecida: RH.PRESENCAS']);
    });

    it('a mesma variável desconhecida aparece uma vez só', () => {
      expect(erros('TOTAL + TOTAL * 2')).toEqual(['Variável desconhecida: TOTAL']);
    });
  });

  describe('funções', () => {
    it('função desconhecida', () => {
      expect(validar('SOMASE(X)', DISPONIVEIS)).toEqual({
        valida: false,
        erros: [{ mensagem: 'Função desconhecida: SOMASE', posicao: 1 }],
      });
    });

    it('funções da Fase 2 ainda são desconhecidas', () => {
      expect(erros('1 - X / ANTERIOR(X)')).toEqual(['Função desconhecida: ANTERIOR']);
    });

    it.each([
      ['ARRED(X)', 'ARRED espera 2 argumentos'],
      ['ARRED(X; 1; 2)', 'ARRED espera 2 argumentos'],
      ['ABS(X; 1)', 'ABS espera 1 argumento'],
      ['NAO()', 'NAO espera 1 argumento'],
      ['SE(X; 1)', 'SE espera 3 argumentos'],
      ['MIN()', 'MIN espera pelo menos 1 argumento'],
      ['E()', 'E espera pelo menos 1 argumento'],
    ])('%s → %s', (texto, mensagem) => {
      expect(erros(texto)).toEqual([mensagem]);
    });
  });

  describe('vírgula decimal e aridade', () => {
    it('ARRED(3,2): erro de aridade sugere usar ";"', () => {
      expect(validar('ARRED(3,2)', [])).toEqual({
        valida: false,
        erros: [
          {
            mensagem:
              'ARRED espera 2 argumentos. "3,2" foi lido como número decimal; use ";" para separar os argumentos',
            posicao: 1,
          },
        ],
      });
    });

    it('ARRED(X,2) é válido: a vírgula separa', () => {
      expect(erros('ARRED(X,2)')).toEqual([]);
    });

    it('sem número com vírgula, não há sugestão', () => {
      expect(erros('ARRED(3.2)')).toEqual(['ARRED espera 2 argumentos']);
      expect(erros('ARRED(X)')).toEqual(['ARRED espera 2 argumentos']);
    });

    it('a sugestão olha o argumento digitado com vírgula, mesmo depois de outro', () => {
      expect(erros('SE(X; 0,5)')).toEqual([
        'SE espera 3 argumentos. "0,5" foi lido como número decimal; use ";" para separar os argumentos',
      ]);
    });
  });

  it('junta vários erros, na ordem do texto', () => {
    expect(validar('SOMASE(TOTAL) + ARRED(X) + OUTRA', DISPONIVEIS)).toEqual({
      valida: false,
      erros: [
        { mensagem: 'Função desconhecida: SOMASE', posicao: 1 },
        { mensagem: 'Variável desconhecida: TOTAL', posicao: 8 },
        { mensagem: 'ARRED espera 2 argumentos', posicao: 17 },
        { mensagem: 'Variável desconhecida: OUTRA', posicao: 28 },
      ],
    });
  });

  it('erro de sintaxe vira um erro com a posição', () => {
    expect(validar('(PRESENCAS / 100 EVENTOS)', DISPONIVEIS)).toEqual({
      valida: false,
      erros: [{ mensagem: 'Esperava ")" na posição 18, perto de "EVENTOS"', posicao: 18 }],
    });
  });

  it('fórmula vazia', () => {
    expect(validar('', DISPONIVEIS)).toEqual({
      valida: false,
      erros: [{ mensagem: 'A fórmula está vazia', posicao: null }],
    });
  });

  it('aceita qualquer iterável de disponíveis', () => {
    expect(erros('X', new Set(['X']))).toEqual([]);
  });
});
