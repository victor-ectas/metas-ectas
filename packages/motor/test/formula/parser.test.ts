import { describe, expect, it } from 'vitest';

import { parse } from '../../src/index.js';
import { notacao } from './notacao.js';

const arvore = (texto: string): string => notacao(parse(texto));

describe('parser', () => {
  describe('valores', () => {
    it('número com ponto ou vírgula', () => {
      expect(parse('0,5')).toEqual({ tipo: 'numero', valor: '0.5', posicao: 1 });
      expect(parse('0.5')).toEqual({ tipo: 'numero', valor: '0.5', posicao: 1 });
    });

    it('variável', () => {
      expect(parse('PRESENCAS')).toEqual({
        tipo: 'variavel',
        setor: null,
        codigo: 'PRESENCAS',
        posicao: 1,
      });
    });

    it('variável de outro setor (SETOR.VAR)', () => {
      expect(parse('RH.TOTAL_COLAB')).toEqual({
        tipo: 'variavel',
        setor: 'RH',
        codigo: 'TOTAL_COLAB',
        posicao: 1,
      });
      expect(arvore('CORP.ENTRADAS_CAIXA / SALDO')).toBe('(/ CORP.ENTRADAS_CAIXA SALDO)');
    });

    it('normaliza variáveis e funções para maiúsculas', () => {
      expect(arvore('se(implantado = 1; 1; 0)')).toBe('SE[(= IMPLANTADO 1) 1 0]');
      expect(arvore('Rh.Total_Colab')).toBe('RH.TOTAL_COLAB');
    });
  });

  describe('precedência e associatividade', () => {
    it.each([
      ['1 + 2 * 3', '(+ 1 (* 2 3))'],
      ['1 * 2 + 3', '(+ (* 1 2) 3)'],
      ['A - B - C', '(- (- A B) C)'],
      ['A / B / C', '(/ (/ A B) C)'],
      ['A / B * C', '(* (/ A B) C)'],
      ['A + B > C - D', '(> (+ A B) (- C D))'],
      ['A * B = C / D', '(= (* A B) (/ C D))'],
      ['A < B < C', '(< (< A B) C)'],
      ['A <> B', '(<> A B)'],
      ['A <= B', '(<= A B)'],
      ['A >= B', '(>= A B)'],
    ])('%s → %s', (texto, esperado) => {
      expect(arvore(texto)).toBe(esperado);
    });
  });

  describe('parênteses', () => {
    it.each([
      ['(1 + 2) * 3', '(* (+ 1 2) 3)'],
      ['((A))', 'A'],
      [
        '(ADMISSOES + DEMISSOES) / 2 / TOTAL_COLAB',
        '(/ (/ (+ ADMISSOES DEMISSOES) 2) TOTAL_COLAB)',
      ],
      ['(REALIZADO - ORCADO) / ORCADO', '(/ (- REALIZADO ORCADO) ORCADO)'],
      ['(A > B) + 1', '(+ (> A B) 1)'],
    ])('%s → %s', (texto, esperado) => {
      expect(arvore(texto)).toBe(esperado);
    });
  });

  describe('menos unário', () => {
    it.each([
      ['-5', '(neg 5)'],
      ['-A * B', '(* (neg A) B)'],
      ['-A + B', '(+ (neg A) B)'],
      ['2 - -3', '(- 2 (neg 3))'],
      ['--A', '(neg (neg A))'],
      ['-(A + B)', '(neg (+ A B))'],
      ['A * -B', '(* A (neg B))'],
      ['-0,10', '(neg 0.10)'],
    ])('%s → %s', (texto, esperado) => {
      expect(arvore(texto)).toBe(esperado);
    });
  });

  describe('funções', () => {
    it('sem argumentos', () => {
      expect(parse('AGORA()')).toEqual({
        tipo: 'funcao',
        nome: 'AGORA',
        argumentos: [],
        posicao: 1,
      });
    });

    it.each([
      ['ABS(X)', 'ABS[X]'],
      ['ARRED(MEDIA_DIAS; 0)', 'ARRED[MEDIA_DIAS 0]'],
      ['SE(A > 0; B / A; 0)', 'SE[(> A 0) (/ B A) 0]'],
      ['MAX(A; B; C; D; E)', 'MAX[A B C D E]'],
      ['E(A > 0; B > 0)', 'E[(> A 0) (> B 0)]'],
      ['NAO(A)', 'NAO[A]'],
      ['1 - REALIZADO / ABS(ORCADO)', '(- 1 (/ REALIZADO ABS[ORCADO]))'],
      ['SE(OU(A = 1; B = 1); MIN(A; B); -1)', 'SE[OU[(= A 1) (= B 1)] MIN[A B] (neg 1)]'],
      ['ARRED ( X ; 2 )', 'ARRED[X 2]'],
      ['FUNCAO_NOVA(RH.X)', 'FUNCAO_NOVA[RH.X]'],
    ])('%s → %s', (texto, esperado) => {
      expect(arvore(texto)).toBe(esperado);
    });

    it('guarda a posição da função e dos argumentos', () => {
      expect(parse('1 + MIN(A; 2)')).toEqual({
        tipo: 'binario',
        operador: '+',
        posicao: 3,
        esquerda: { tipo: 'numero', valor: '1', posicao: 1 },
        direita: {
          tipo: 'funcao',
          nome: 'MIN',
          posicao: 5,
          argumentos: [
            { tipo: 'variavel', setor: null, codigo: 'A', posicao: 9 },
            { tipo: 'numero', valor: '2', posicao: 12 },
          ],
        },
      });
    });
  });

  describe('vírgula: separador ou decimal', () => {
    it('ARRED(X,2): a vírgula separa, porque X não é número', () => {
      expect(arvore('ARRED(X,2)')).toBe('ARRED[X 2]');
    });

    it('ARRED(3,2): a vírgula é decimal e há um só argumento (3,2)', () => {
      expect(arvore('ARRED(3,2)')).toBe('ARRED[3.2]');
    });

    it('ARRED(3, 2): com espaço a vírgula separa', () => {
      expect(arvore('ARRED(3, 2)')).toBe('ARRED[3 2]');
    });

    it('ARRED(3,2;1): decimal e depois separador', () => {
      expect(arvore('ARRED(3,2;1)')).toBe('ARRED[3.2 1]');
    });

    it('ARRED(X,2,5): separa e depois é decimal', () => {
      expect(arvore('ARRED(X,2,5)')).toBe('ARRED[X 2.5]');
    });

    it('MIN(1.5,2): ponto já é decimal, a vírgula separa', () => {
      expect(arvore('MIN(1.5,2)')).toBe('MIN[1.5 2]');
    });

    it('vírgula entre dígitos é sempre decimal, mesmo onde o autor quis separar', () => {
      // "SE(A>0,1;0)" é lido como SE(A > 0,1; 0). Por isso a mensagem de aridade sugere ";".
      expect(arvore('SE(A>0,1;0)')).toBe('SE[(> A 0.1) 0]');
      expect(arvore('SE(A>0;1;0)')).toBe('SE[(> A 0) 1 0]');
    });
  });

  it('produz AST serializável em JSON, sem perda', () => {
    const ast = parse('SE(RH.A >= 0,5; -ARRED(B / C; 2); MAX(1; 2))');
    expect(JSON.parse(JSON.stringify(ast))).toEqual(ast);
  });

  it('aceita aninhamento até o limite', () => {
    expect(arvore('('.repeat(99) + 'A' + ')'.repeat(99))).toBe('A');
  });
});
