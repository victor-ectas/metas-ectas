import { Bloco, Operador, RegraPontuacao } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import { type MetaEntrada, validarMeta, validarPesosGestor } from '../../src/index.js';
import { meta } from './construtores.js';

const mensagens = (m: MetaEntrada) => validarMeta(m).map((e) => [e.codigo, e.metaId, e.mensagem]);

describe('validarMeta', () => {
  it('meta bem configurada não tem erros', () => {
    expect(validarMeta(meta())).toEqual([]);
  });

  describe('período (RN-13)', () => {
    it.each([
      [0, 5],
      [1, 13],
      [6, 5],
      [1.5, 5],
      [1, 5.5],
    ])('%s a %s é inválido', (mesInicio, mesFim) => {
      expect(mensagens(meta({ mesInicio, mesFim }))).toEqual([
        [
          'VALIDACAO',
          'META',
          `Período inválido (${String(mesInicio)} a ${String(mesFim)}): use meses de 1 a 12, com o início antes do fim`,
        ],
      ]);
    });

    it('período de um mês só é válido', () => {
      expect(validarMeta(meta({ mesInicio: 5, mesFim: 5 }))).toEqual([]);
    });
  });

  it('sem fórmula e sem submetas', () => {
    expect(mensagens(meta({ formula: null }))).toEqual([
      ['VALIDACAO', 'META', 'A meta precisa de uma fórmula ou de submetas'],
    ]);
  });

  describe('objetivo (RN-15)', () => {
    it('sem objetivo único nem do último mês', () => {
      expect(mensagens(meta({ mesFim: 5, objetivos: { 4: '1' } }))).toEqual([
        [
          'VALIDACAO',
          'META',
          'Falta o objetivo: informe um objetivo único ou o objetivo de maio (último mês do período)',
        ],
      ]);
    });

    it('objetivo do último mês basta', () => {
      expect(validarMeta(meta({ mesFim: 3, objetivos: { 3: '1' } }))).toEqual([]);
    });
  });

  describe('faixa (RN-20)', () => {
    it.each([null, '-0.01'])('tolerância %s é recusada', (tolerancia) => {
      expect(mensagens(meta({ operador: Operador.FAIXA, tolerancia }))).toEqual([
        ['VALIDACAO', 'META', 'Informe a tolerância da faixa (maior ou igual a zero)'],
      ]);
    });

    it('tolerância 0 é aceita', () => {
      expect(validarMeta(meta({ operador: Operador.FAIXA, tolerancia: '0' }))).toEqual([]);
    });
  });

  describe('proporcional com objetivo ≤ 0 (RN-23)', () => {
    const erroRn23 = [
      'VALIDACAO',
      'META',
      'Pontuação proporcional não é permitida com objetivo menor ou igual a zero; use tudo ou nada',
    ];

    it.each(['0', '-0.1'])('objetivo %s é recusado', (objetivo) => {
      expect(
        mensagens(
          meta({ regraPontuacao: RegraPontuacao.PROPORCIONAL, objetivos: { 0: objetivo } }),
        ),
      ).toEqual([erroRn23]);
    });

    it('vale para qualquer objetivo mensal ≤ 0', () => {
      expect(
        mensagens(
          meta({ regraPontuacao: RegraPontuacao.PROPORCIONAL, objetivos: { 0: '1', 3: '0' } }),
        ),
      ).toEqual([erroRn23]);
    });

    it('ignora meses sem objetivo informado', () => {
      expect(
        validarMeta(
          meta({
            regraPontuacao: RegraPontuacao.PROPORCIONAL,
            objetivos: { 0: '1', 3: undefined },
          }),
        ),
      ).toEqual([]);
    });

    it('não se aplica a tudo ou nada, a faixa nem a submeta', () => {
      expect(validarMeta(meta({ objetivos: { 0: '-1' } }))).toEqual([]);
      expect(
        validarMeta(
          meta({
            operador: Operador.FAIXA,
            tolerancia: '0.05',
            regraPontuacao: RegraPontuacao.PROPORCIONAL,
            objetivos: { 0: '0' },
          }),
        ),
      ).toEqual([]);
      expect(
        validarMeta(
          meta({
            formula: null,
            submetas: [
              meta({
                id: 'F',
                pesoInterno: '1',
                regraPontuacao: RegraPontuacao.PROPORCIONAL,
                objetivos: { 0: '-1' },
              }),
            ],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('submetas', () => {
    const filha = (id: string, peso: string | null, extra: Parameters<typeof meta>[0] = {}) =>
      meta({ id, pesoInterno: peso, ...extra });

    it('pesos internos somando 100% são válidos', () => {
      expect(
        validarMeta(meta({ formula: null, submetas: [filha('F1', '0.6'), filha('F2', '0.4')] })),
      ).toEqual([]);
    });

    it('pesos internos com 2 casas em pontos percentuais: 33,333333% × 3 é aceito', () => {
      const terco = '0.33333333';
      expect(
        validarMeta(
          meta({
            formula: null,
            submetas: [filha('F1', terco), filha('F2', terco), filha('F3', terco)],
          }),
        ),
      ).toEqual([]);
    });

    it('pesos internos que não somam 100% (RN-04)', () => {
      expect(
        mensagens(meta({ formula: null, submetas: [filha('F1', '0.5'), filha('F2', '0.4999')] })),
      ).toEqual([
        ['PESOS_INCONSISTENTES', 'META', 'Os pesos internos somam 99,99%; deveriam somar 100,00%'],
      ]);
    });

    it('submeta sem peso interno ou com peso zero', () => {
      expect(
        mensagens(meta({ formula: null, submetas: [filha('F1', null), filha('F2', '0')] })),
      ).toEqual([
        ['PESOS_INCONSISTENTES', 'F1', 'Informe o peso interno da submeta (maior que zero)'],
        ['PESOS_INCONSISTENTES', 'F2', 'Informe o peso interno da submeta (maior que zero)'],
        ['PESOS_INCONSISTENTES', 'META', 'Os pesos internos somam 0,00%; deveriam somar 100,00%'],
      ]);
    });

    it('mãe com fórmula própria precisa de peso interno, somando com as filhas (RN-30)', () => {
      expect(validarMeta(meta({ pesoInterno: '0.2', submetas: [filha('F1', '0.8')] }))).toEqual([]);
      expect(mensagens(meta({ pesoInterno: null, submetas: [filha('F1', '1')] }))).toEqual([
        [
          'PESOS_INCONSISTENTES',
          'META',
          'Informe o peso interno do resultado próprio da meta-mãe (maior que zero)',
        ],
      ]);
    });

    it('período da submeta fora do período da mãe (RN-29)', () => {
      const erro = [
        'VALIDACAO',
        'F1',
        'O período da submeta precisa estar dentro do período da meta-mãe',
      ];
      expect(
        mensagens(
          meta({
            formula: null,
            mesInicio: 3,
            mesFim: 9,
            submetas: [filha('F1', '1', { mesInicio: 2, mesFim: 9 })],
          }),
        ),
      ).toEqual([erro]);
      expect(
        mensagens(
          meta({
            formula: null,
            mesInicio: 3,
            mesFim: 9,
            submetas: [filha('F1', '1', { mesInicio: 3, mesFim: 10 })],
          }),
        ),
      ).toEqual([erro]);
      expect(
        validarMeta(
          meta({
            formula: null,
            mesInicio: 3,
            mesFim: 9,
            submetas: [filha('F1', '1', { mesInicio: 3, mesFim: 9 })],
          }),
        ),
      ).toEqual([]);
    });

    it('submeta com período inválido não acusa também o período da mãe', () => {
      expect(
        mensagens(
          meta({ formula: null, submetas: [filha('F1', '1', { mesInicio: 9, mesFim: 3 })] }),
        ).map((e) => e[2]),
      ).toEqual(['Período inválido (9 a 3): use meses de 1 a 12, com o início antes do fim']);
    });

    it('submeta de submeta é proibida (RN-26)', () => {
      const neta = filha('NETA', '1');
      expect(
        mensagens(meta({ formula: null, submetas: [filha('F1', '1', { submetas: [neta] })] })),
      ).toEqual([['VALIDACAO', 'F1', 'Uma submeta não pode ter submetas (máximo de 2 níveis)']]);
    });
  });
});

describe('validarPesosGestor (RN-03)', () => {
  const corp = (peso: string) => ({ bloco: Bloco.CORPORATIVO, peso });
  const dep = (peso: string) => ({ bloco: Bloco.DEPARTAMENTAL, peso });

  it('com corporativas: 50 + 50, departamentais somando juntas de setores diferentes', () => {
    expect(validarPesosGestor([corp('30'), corp('20'), dep('20'), dep('15'), dep('15')])).toEqual(
      [],
    );
  });

  it('sem corporativas: departamental soma 100', () => {
    expect(validarPesosGestor([dep('60'), dep('40')])).toEqual([]);
  });

  it('com corporativas, os dois blocos são conferidos', () => {
    expect(validarPesosGestor([corp('40'), dep('50')]).map((e) => e.mensagem)).toEqual([
      'Os pesos do bloco Corporativo somam 40,00; deveriam somar 50,00',
    ]);
    expect(validarPesosGestor([corp('50')]).map((e) => e.mensagem)).toEqual([
      'Os pesos do bloco Departamental somam 0,00; deveriam somar 50,00',
    ]);
  });

  it('compara com 2 casas', () => {
    expect(validarPesosGestor([dep('33.333333'), dep('33.333333'), dep('33.333334')])).toEqual([]);
    expect(validarPesosGestor([dep('99.99')])).toHaveLength(1);
  });

  it('gestor sem nenhuma meta', () => {
    expect(validarPesosGestor([]).map((e) => e.mensagem)).toEqual([
      'Os pesos do bloco Departamental somam 0,00; deveriam somar 100,00',
    ]);
  });
});
