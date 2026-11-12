import { Decimal } from '@metas/motor';
import { Unidade } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarSimNao,
  formatarValor,
  nomeMes,
  VAZIO,
} from '../src/formatacao';

const NBSP = ' ';

describe('formatarNumero', () => {
  it('usa vírgula decimal e ponto nos milhares', () => {
    expect(formatarNumero('103080.27')).toBe('103.080,27');
    expect(formatarNumero('152946.99')).toBe('152.946,99');
    expect(formatarNumero('1234567890.5')).toBe('1.234.567.890,50');
    expect(formatarNumero('999')).toBe('999,00');
    expect(formatarNumero('0')).toBe('0,00');
  });

  it('arredonda meio para cima, sem float (CLAUDE.md 5.4)', () => {
    expect(formatarNumero('2.63875')).toBe('2,64');
    expect(formatarNumero('1.005')).toBe('1,01');
    expect(formatarNumero('1.004999')).toBe('1,00');
    expect(formatarNumero(new Decimal('0.1').plus('0.2'))).toBe('0,30');
  });

  it('formata negativos e não mostra "-0,00"', () => {
    expect(formatarNumero('-6.41')).toBe('-6,41');
    expect(formatarNumero('-1234.5')).toBe('-1.234,50');
    expect(formatarNumero('-0.001')).toBe('0,00');
  });

  it('aceita outras quantidades de casas', () => {
    expect(formatarNumero('3.14159', 4)).toBe('3,1416');
    expect(formatarNumero('1234.5', 0)).toBe('1.235');
  });

  it('vazio não é zero (RN-08)', () => {
    expect(formatarNumero(null)).toBe(VAZIO);
    expect(formatarNumero(undefined)).toBe(VAZIO);
  });
});

describe('formatarMoeda', () => {
  it('formata reais', () => {
    expect(formatarMoeda('14695.68')).toBe(`R$${NBSP}14.695,68`);
    expect(formatarMoeda('-1064.705')).toBe(`-R$${NBSP}1.064,71`);
    expect(formatarMoeda(null)).toBe(VAZIO);
  });
});

describe('formatarPercentual', () => {
  it('fração → 2 casas em pontos percentuais', () => {
    expect(formatarPercentual('0.79912')).toBe('79,91%');
    expect(formatarPercentual('0.757935')).toBe('75,79%');
    expect(formatarPercentual('0.357071')).toBe('35,71%');
    expect(formatarPercentual('1')).toBe('100,00%');
    expect(formatarPercentual('0.25')).toBe('25,00%');
  });

  it('negativos e vazio', () => {
    expect(formatarPercentual('-0.326')).toBe('-32,60%');
    expect(formatarPercentual('-0.197886')).toBe('-19,79%');
    expect(formatarPercentual(null)).toBe(VAZIO);
  });
});

describe('formatarSimNao', () => {
  it('1 = Sim, 0 = Não (RN-10)', () => {
    expect(formatarSimNao('1')).toBe('Sim');
    expect(formatarSimNao('0')).toBe('Não');
    expect(formatarSimNao('0.000000')).toBe('Não');
    expect(formatarSimNao(null)).toBe(VAZIO);
  });
});

describe('formatarValor', () => {
  it('formata pela unidade', () => {
    expect(formatarValor('0.8', Unidade.PERCENTUAL)).toBe('80,00%');
    expect(formatarValor('10', Unidade.MOEDA)).toBe(`R$${NBSP}10,00`);
    expect(formatarValor('2.63875', Unidade.DIAS)).toBe(`2,64${NBSP}dias`);
    expect(formatarValor('1', Unidade.DIAS)).toBe(`1,00${NBSP}dia`);
    expect(formatarValor('-1.001', Unidade.DIAS)).toBe(`-1,00${NBSP}dia`);
    expect(formatarValor('7.5', Unidade.HORAS)).toBe(`7,50${NBSP}horas`);
    expect(formatarValor('1', Unidade.HORAS)).toBe(`1,00${NBSP}hora`);
    expect(formatarValor('1', Unidade.SIM_NAO)).toBe('Sim');
    expect(formatarValor('1234.5', Unidade.NUMERO)).toBe('1.234,50');
    expect(formatarValor(null, Unidade.DIAS)).toBe(VAZIO);
  });
});

describe('datas', () => {
  it('converte para o horário de São Paulo', () => {
    // 25/11/2026 00:00 em São Paulo é 03:00 em UTC.
    expect(formatarData('2026-11-25T02:59:59Z')).toBe('24/11/2026');
    expect(formatarData('2026-11-25T03:00:00Z')).toBe('25/11/2026');
    expect(formatarData(new Date('2027-01-22T15:00:00Z'))).toBe('22/01/2027');
    expect(formatarDataHora('2026-11-25T02:59:00Z')).toBe('24/11/2026 23:59');
    expect(formatarDataHora('2026-11-25T03:00:00.000Z')).toBe('25/11/2026 00:00');
  });

  it('data sem hora não muda de dia', () => {
    expect(formatarData('2026-11-02')).toBe('02/11/2026');
    expect(formatarData('2027-01-01')).toBe('01/01/2027');
  });

  it('vazio e inválido', () => {
    expect(formatarData(null)).toBe(VAZIO);
    expect(formatarData('não é data')).toBe(VAZIO);
    expect(formatarDataHora(undefined)).toBe(VAZIO);
    expect(formatarDataHora('xx')).toBe(VAZIO);
  });

  it('nome do mês', () => {
    expect(nomeMes(10, 2026)).toBe('Outubro/2026');
    expect(nomeMes(3)).toBe('Março');
    expect(() => nomeMes(13)).toThrow('Mês inválido: 13.');
    expect(() => nomeMes(0)).toThrow(RangeError);
  });
});
