import { Acumulacao, Operador, RegraPontuacao, Situacao, Unidade } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import {
  acumular,
  arredondarAtendimento,
  arredondarExibicao,
  arredondarPontos,
  calcularAtendimento,
  calcularPontos,
  Decimal,
  regraEfetiva,
  situacaoPorAtendimento,
} from '../../src/index.js';

const d = (valor: string) => new Decimal(valor);
const lista = (...valores: (string | null)[]) => valores.map((v) => (v === null ? null : d(v)));

describe('acumular (RN-09)', () => {
  it.each([
    [Acumulacao.SOMA, '9'],
    [Acumulacao.MEDIA, '3'],
    [Acumulacao.ULTIMO, '5'],
    [Acumulacao.MAXIMO, '5'],
  ])('%s de [1, vazio, 3, 5] → %s', (regra, esperado) => {
    expect(acumular(lista('1', null, '3', '5'), regra)?.toString()).toBe(esperado);
  });

  it('último ignora meses vazios no fim', () => {
    expect(acumular(lista('1', '2', null, null), Acumulacao.ULTIMO)?.toString()).toBe('2');
  });

  it('zero conta (RN-08)', () => {
    expect(acumular(lista('0', null, '4'), Acumulacao.MEDIA)?.toString()).toBe('2');
  });

  it.each(Object.values(Acumulacao))('%s sem nenhum valor → vazio', (regra) => {
    expect(acumular(lista(null, null), regra)).toBeNull();
    expect(acumular([], regra)).toBeNull();
  });
});

describe('calcularAtendimento (RN-21)', () => {
  const at = (op: Operador, r: string, o: string, t: string | null = null) =>
    calcularAtendimento(op, d(r), d(o), t === null ? null : d(t)).toString();

  it.each([
    ['R ≥ O', '0.9', '0.8', '1'],
    ['R = O', '0.8', '0.8', '1'],
    ['R < O, ambos > 0', '0.6', '0.8', '0.75'],
    ['R = 0', '0', '0.8', '0'],
    ['R < 0', '-1', '0.8', '0'],
    ['O < 0 e R < O', '-2', '-1', '0'],
  ])('≥: %s', (_caso, r, o, esperado) => {
    expect(at(Operador.GE, r, o)).toBe(esperado);
  });

  it.each([
    ['R ≤ O', '1', '2', '1'],
    ['R > O, ambos > 0', '4', '2', '0.5'],
    ['O = 0 e R > O', '1', '0', '0'],
    ['O < 0 e R > O', '-0.05', '-0.10', '0'],
  ])('≤: %s', (_caso, r, o, esperado) => {
    expect(at(Operador.LE, r, o)).toBe(esperado);
  });

  it.each([
    ['dentro de 0,005', '1.004', '1', '1'],
    ['no limite de 0,005', '0.995', '1', '1'],
    ['ambos > 0, R < O', '0.9', '1', '0.9'],
    ['ambos > 0, R > O', '1.25', '1', '0.8'],
    ['R = 0', '0', '1', '0'],
    ['O < 0', '-1', '-2', '0'],
  ])('=: %s', (_caso, r, o, esperado) => {
    expect(at(Operador.EQ, r, o)).toBe(esperado);
  });

  it.each([
    ['no centro', '0', '0', '0.05', '1'],
    ['no limite inferior', '-0.05', '0', '0.05', '1'],
    ['no limite superior', '0.05', '0', '0.05', '1'],
    ['abaixo', '-0.051', '0', '0.05', '0'],
    ['acima', '0.06', '0', '0.05', '0'],
    ['sem tolerância, igual', '5', '5', null, '1'],
    ['sem tolerância, diferente', '5.01', '5', null, '0'],
  ])('faixa: %s', (_caso, r, o, t, esperado) => {
    expect(at(Operador.FAIXA, r, o, t)).toBe(esperado);
  });
});

describe('situacaoPorAtendimento (RN-25)', () => {
  it.each([
    [Operador.GE, null, Situacao.SEM_DADOS],
    [Operador.GE, '1', Situacao.BATIDA],
    [Operador.GE, '0.5', Situacao.ABAIXO],
    [Operador.FAIXA, '1', Situacao.BATIDA],
    [Operador.FAIXA, '0', Situacao.FORA_DA_FAIXA],
  ])('%s com atendimento %s → %s', (op, valor, esperado) => {
    expect(situacaoPorAtendimento(op, valor === null ? null : d(valor))).toBe(esperado);
  });
});

describe('pontuação (RN-22, RN-24)', () => {
  it('faixa sem submetas é sempre tudo ou nada', () => {
    expect(regraEfetiva(RegraPontuacao.PROPORCIONAL, Operador.FAIXA, false)).toBe(
      RegraPontuacao.TUDO_OU_NADA,
    );
    expect(regraEfetiva(RegraPontuacao.PROPORCIONAL, Operador.FAIXA, true)).toBe(
      RegraPontuacao.PROPORCIONAL,
    );
    expect(regraEfetiva(RegraPontuacao.PROPORCIONAL, Operador.GE, false)).toBe(
      RegraPontuacao.PROPORCIONAL,
    );
  });

  it.each([
    [RegraPontuacao.PROPORCIONAL, '0.5', '5'],
    [RegraPontuacao.PROPORCIONAL, '1', '10'],
    [RegraPontuacao.PROPORCIONAL, '0', '0'],
    [RegraPontuacao.TUDO_OU_NADA, '1', '10'],
    [RegraPontuacao.TUDO_OU_NADA, '0.999999', '0'],
  ])('%s, atendimento %s, peso 10 → %s', (regra, atendimento, esperado) => {
    expect(calcularPontos(regra, d(atendimento), d('10')).toString()).toBe(esperado);
  });
});

describe('arredondamento de exibição (5.4)', () => {
  it.each([
    [Unidade.PERCENTUAL, '0.79912', '0.7991'],
    [Unidade.PERCENTUAL, '0.757935', '0.7579'],
    [Unidade.PERCENTUAL, '0.00005', '0.0001'],
    [Unidade.DIAS, '2.63875', '2.64'],
    [Unidade.MOEDA, '103080.275', '103080.28'],
    [Unidade.NUMERO, '-2.635', '-2.64'],
  ])('%s: %s → %s', (unidade, valor, esperado) => {
    expect(arredondarExibicao(d(valor), unidade).toString()).toBe(esperado);
  });

  it('atendimento e pontos', () => {
    expect(arredondarAtendimento(d('0.3570707')).toString()).toBe('0.3571');
    expect(arredondarPontos(d('7.579346')).toString()).toBe('7.58');
  });
});
