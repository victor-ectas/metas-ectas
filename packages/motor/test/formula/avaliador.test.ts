import { Decimal as DecimalGlobal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { avaliar, Decimal, type Escopo, FormulaErro, parse } from '../../src/index.js';

/** Avalia o texto e devolve o valor como texto (ou null) e os avisos. */
function calcular(texto: string, escopo: Escopo = {}) {
  const { valor, avisos } = avaliar(parse(texto), escopo);
  return { valor: valor === null ? null : valor.toString(), avisos };
}

const valor = (texto: string, escopo: Escopo = {}): string | null => calcular(texto, escopo).valor;

describe('avaliador', () => {
  describe('aritmética decimal exata', () => {
    it('0.1 + 0.2 = 0.3 exato', () => {
      expect(valor('0.1 + 0.2')).toBe('0.3');
      expect(valor('0,1 + 0,2 = 0,3')).toBe('1');
      const resultado = avaliar(parse('A + B'), { A: '0.1', B: '0.2' }).valor;
      expect(resultado?.eq(new Decimal('0.3'))).toBe(true);
    });

    it.each([
      ['7 + 3', '10'],
      ['7 - 10', '-3'],
      ['2,5 * 4', '10'],
      ['10 / 4', '2.5'],
      ['1 + 2 * 3', '7'],
      ['(1 + 2) * 3', '9'],
      ['-5 + 2', '-3'],
      ['--5', '5'],
      ['2 - -3', '5'],
      ['103080,27 - 152946,99', '-49866.72'],
    ])('%s = %s', (texto, esperado) => {
      expect(valor(texto)).toBe(esperado);
    });

    it('divisão com 40 dígitos significativos, sem arredondar no meio', () => {
      expect(valor('1 / 3')).toBe('0.' + '3'.repeat(40));
      expect(valor('2 / 3')).toBe('0.' + '6'.repeat(39) + '7');
      expect(valor('ARRED(1 / 3 * 3; 2)')).toBe('1');
    });

    it('não usa notação científica', () => {
      expect(valor('1 / 10000000000')).toBe('0.0000000001');
      expect(valor('100000000000 * 100000000000')).toBe('10000000000000000000000');
    });

    it('fórmulas reais das planilhas (CT-01, CT-04, CT-07)', () => {
      expect(valor('REQ_ATENDIDOS / TOTAL_REQ', { REQ_ATENDIDOS: '36', TOTAL_REQ: '45' })).toBe(
        '0.8',
      );
      expect(
        valor('ARRED((REALIZADO - ORCADO) / ORCADO * 100; 2)', {
          REALIZADO: '103080.27',
          ORCADO: '152946.99',
        }),
      ).toBe('-32.6');
      expect(valor('ARRED(RETRABALHO / NFS * 100; 2)', { RETRABALHO: '99', NFS: '707' })).toBe(
        '14',
      );
    });
  });

  describe('comparações devolvem 1 ou 0', () => {
    it.each([
      ['2 = 2', '1'],
      ['2 = 2,0', '1'],
      ['2 = 3', '0'],
      ['2 <> 3', '1'],
      ['2 <> 2', '0'],
      ['2 < 3', '1'],
      ['3 < 2', '0'],
      ['3 > 2', '1'],
      ['2 > 3', '0'],
      ['2 <= 2', '1'],
      ['3 <= 2', '0'],
      ['2 >= 2', '1'],
      ['2 >= 3', '0'],
      ['(2 > 1) + (3 > 1)', '2'],
    ])('%s → %s', (texto, esperado) => {
      expect(valor(texto)).toBe(esperado);
    });
  });

  describe('variáveis', () => {
    it('lê do escopo pelo código e por SETOR.CODIGO', () => {
      expect(valor('A + RH.A', { A: '1', 'RH.A': '10' })).toBe('11');
    });

    it('aceita texto, Decimal do motor e Decimal de outra configuração', () => {
      expect(valor('A + B + C', { A: '1', B: new Decimal(2), C: new DecimalGlobal(3) })).toBe('6');
    });

    it('recria Decimal de outra configuração para manter os 40 dígitos', () => {
      // O decimal.js global usa 20 dígitos; o motor deve usar os seus 40.
      expect(valor('A / B', { A: new DecimalGlobal(1), B: new DecimalGlobal(3) })).toBe(
        '0.' + '3'.repeat(40),
      );
    });

    it('variável vazia (null) deixa o resultado vazio, sem aviso (RN-16)', () => {
      expect(calcular('A + B', { A: '1', B: null })).toEqual({ valor: null, avisos: [] });
    });

    it('variável ausente do escopo também é vazia', () => {
      expect(valor('A + B', { A: '1' })).toBeNull();
      expect(valor('A + B', { A: '1', B: undefined })).toBeNull();
    });

    it('zero não é vazio (RN-08)', () => {
      expect(valor('A + B', { A: '1', B: '0' })).toBe('1');
    });

    it('vazio em qualquer variável usada deixa vazio, mesmo no ramo do SE não escolhido', () => {
      expect(valor('SE(A > 0; A; B)', { A: '1', B: null })).toBeNull();
    });

    it('não lê propriedades herdadas do objeto de escopo', () => {
      expect(valor('CONSTRUCTOR + 1', {})).toBeNull();
      expect(valor('TOSTRING', Object.create({ TOSTRING: '1' }) as Escopo)).toBeNull();
    });
  });

  describe('divisão por zero (RN-18)', () => {
    it('resultado vazio com aviso e posição do operador', () => {
      expect(
        calcular('CHECKLISTS / PROC_CRITICOS', { CHECKLISTS: '5', PROC_CRITICOS: '0' }),
      ).toEqual({
        valor: null,
        avisos: [{ codigo: 'DIVISAO_POR_ZERO', posicao: 12 }],
      });
    });

    it('o vazio se propaga pela fórmula e pelas funções', () => {
      expect(calcular('1 + 1 / 0').valor).toBeNull();
      expect(calcular('-(1 / 0)').valor).toBeNull();
      expect(calcular('ARRED(1 / 0; 2)').valor).toBeNull();
      expect(calcular('MAX(1; 1 / 0)').valor).toBeNull();
      expect(calcular('1 / 0 > 1').valor).toBeNull();
      expect(calcular('1 > 1 / 0').valor).toBeNull();
    });

    it('registra um aviso por divisão por zero avaliada', () => {
      expect(calcular('1 / 0 + 2 / 0').avisos).toEqual([
        { codigo: 'DIVISAO_POR_ZERO', posicao: 3 },
        { codigo: 'DIVISAO_POR_ZERO', posicao: 11 },
      ]);
    });

    it('zero dividido por número é zero', () => {
      expect(valor('0 / 5')).toBe('0');
    });
  });

  describe('SE', () => {
    it.each([
      ['SE(1; 10; 20)', '10'],
      ['SE(0; 10; 20)', '20'],
      ['SE(-0,5; 10; 20)', '10'],
      ['SE(2 > 1; 10; 20)', '10'],
      ['SE(IMPLANTADO = 1; 1; 0)', '1'],
    ])('%s → %s', (texto, esperado) => {
      expect(valor(texto, { IMPLANTADO: '1' })).toBe(esperado);
    });

    it('só avalia o ramo escolhido: SE(B = 0; 0; A / B) sem aviso', () => {
      expect(calcular('SE(B = 0; 0; A / B)', { A: '5', B: '0' })).toEqual({
        valor: '0',
        avisos: [],
      });
      expect(calcular('SE(B <> 0; A / B; 0)', { A: '5', B: '2' }).valor).toBe('2.5');
    });

    it('condição vazia deixa o resultado vazio', () => {
      expect(calcular('SE(1 / 0; 1; 2)')).toEqual({
        valor: null,
        avisos: [{ codigo: 'DIVISAO_POR_ZERO', posicao: 6 }],
      });
    });
  });

  describe('funções lógicas', () => {
    it.each([
      ['E(1; 1)', '1'],
      ['E(1; 0)', '0'],
      ['E(2; -3; 0,1)', '1'],
      ['E(0)', '0'],
      ['OU(0; 0)', '0'],
      ['OU(0; 5)', '1'],
      ['OU(1)', '1'],
      ['NAO(0)', '1'],
      ['NAO(7)', '0'],
      ['NAO(E(1; 0))', '1'],
    ])('%s → %s', (texto, esperado) => {
      expect(valor(texto)).toBe(esperado);
    });

    it('argumento vazio deixa o resultado vazio', () => {
      expect(valor('E(1; 1 / 0)')).toBeNull();
      expect(valor('OU(1 / 0; 1)')).toBeNull();
    });
  });

  describe('MIN, MAX, ABS', () => {
    it.each([
      ['MIN(3; 1; 2)', '1'],
      ['MIN(-1)', '-1'],
      ['MAX(3; 1; 2)', '3'],
      ['MAX(-5; -2)', '-2'],
      ['ABS(-2,5)', '2.5'],
      ['ABS(4)', '4'],
      ['1 - REALIZADO / ABS(ORCADO)', '-1'],
    ])('%s → %s', (texto, esperado) => {
      expect(valor(texto, { REALIZADO: '4', ORCADO: '-2' })).toBe(esperado);
    });
  });

  describe('ARRED (meio para cima)', () => {
    it.each([
      ['ARRED(2,675; 2)', '2.68'],
      ['ARRED(2,674; 2)', '2.67'],
      ['ARRED(2,5; 0)', '3'],
      ['ARRED(-2,5; 0)', '-3'],
      ['ARRED(0,799074; 4)', '0.7991'],
      ['ARRED(2,63875; 2)', '2.64'],
      ['ARRED(1250; -2)', '1300'],
      ['ARRED(1249; -2)', '1200'],
      ['ARRED(-1250; -2)', '-1300'],
      ['ARRED(3,14159; 2,9)', '3.14'],
      ['ARRED(3,14159; -0,5)', '3'],
      ['ARRED(1,5; 5000)', '1.5'],
      ['ARRED(123456; -5000)', '0'],
    ])('%s → %s', (texto, esperado) => {
      expect(valor(texto)).toBe(esperado);
    });
  });

  describe('AST não validada', () => {
    it('função desconhecida lança FormulaErro', () => {
      expect(() => avaliar(parse('SOMASE(1)'), {})).toThrow(
        new FormulaErro('Função desconhecida: SOMASE', 1),
      );
    });

    it('aridade errada lança FormulaErro', () => {
      expect(() => avaliar(parse('1 + ARRED(1)'), {})).toThrow('ARRED espera 2 argumentos');
    });
  });
});
