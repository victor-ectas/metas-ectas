/**
 * Casos de teste obrigatórios CT-01 a CT-17 (CLAUDE.md 8.7), com os dados reais das planilhas
 * de 2026. CT-18 (calendário) é do passo P06.
 */
import { Acumulacao, Bloco, ModoApuracao, Operador, RegraPontuacao, Situacao } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import {
  acumular,
  arredondarAtendimento,
  arredondarExibicao,
  arredondarPontos,
  calcularCiclo,
  calcularMeta,
  calcularPontos,
  Decimal,
  validarMeta,
  validarPesosGestor,
} from '../../src/index.js';
import { meta, repetir, seis, variavel } from './construtores.js';

const { SOMA, MEDIA, ULTIMO } = Acumulacao;

describe('casos de teste obrigatórios (CLAUDE.md 8.7)', () => {
  it('CT-01: REQ_ATENDIDOS / TOTAL_REQ, soma, ≥ 80% → 80,00%, Batida', () => {
    const r = calcularMeta(
      meta({ formula: 'REQ_ATENDIDOS / TOTAL_REQ', objetivos: { 0: '0.80' } }),
      [variavel('REQ_ATENDIDOS', SOMA, ['16', '20']), variavel('TOTAL_REQ', SOMA, ['20', '25'])],
    );
    expect(r.acumulado?.toString()).toBe('0.8');
    expect(arredondarExibicao(r.acumulado as Decimal, 'PERCENTUAL').toString()).toBe('0.8');
    expect(r.atendimento.toString()).toBe('1');
    expect(r.situacao).toBe(Situacao.BATIDA);
  });

  it('CT-02: CHECKLISTS / PROC_CRITICOS com último valor → 100,00%, Batida (planilha: 681,82%)', () => {
    const r = calcularMeta(
      meta({ formula: 'CHECKLISTS / PROC_CRITICOS', objetivos: { 0: '0.90' } }),
      [
        variavel('CHECKLISTS', ULTIMO, ['0', '0', '0', '5', '5', '5', '10', '10', '10', '10']),
        variavel('PROC_CRITICOS', ULTIMO, repetir('10', 10)),
      ],
    );
    expect(r.acumulado?.toString()).toBe('1');
    expect(r.situacao).toBe(Situacao.BATIDA);
    expect(r.memoria.variaveis.map((v) => v.acumulado)).toEqual(['10', '10']);
  });

  describe('CT-03: MEDIA_DIAS, média dos resultados, ≤ 2 dias, peso 10', () => {
    const entrada = (regra: RegraPontuacao) =>
      calcularMeta(
        meta({
          formula: 'MEDIA_DIAS',
          modoApuracao: ModoApuracao.MEDIA_RESULTADOS,
          operador: Operador.LE,
          objetivos: { 0: '2' },
          regraPontuacao: regra,
        }),
        [variavel('MEDIA_DIAS', MEDIA, ['5.2', '0.43', '3', '1.17', '1.14', '2', '1.67', '6.5'])],
      );

    it('2,63875 → 2,64 dias; atendimento 0,757935 → 75,79%', () => {
      const r = entrada(RegraPontuacao.TUDO_OU_NADA);
      expect(r.acumulado?.toString()).toBe('2.63875');
      expect(arredondarExibicao(r.acumulado as Decimal, 'DIAS').toString()).toBe('2.64');
      expect(seis(r.atendimento)).toBe('0.757935');
      expect(arredondarAtendimento(r.atendimento).toString()).toBe('0.7579');
      expect(r.situacao).toBe(Situacao.ABAIXO);
    });

    it('tudo ou nada: 0,00 pts; proporcional: 7,58 pts', () => {
      const peso = new Decimal(10);
      const tudo = entrada(RegraPontuacao.TUDO_OU_NADA);
      const prop = entrada(RegraPontuacao.PROPORCIONAL);
      expect(calcularPontos(tudo.regraPontuacao, tudo.atendimento, peso).toString()).toBe('0');
      expect(
        arredondarPontos(calcularPontos(prop.regraPontuacao, prop.atendimento, peso)).toString(),
      ).toBe('7.58');
    });
  });

  it('CT-04: (REALIZADO - ORCADO) / ORCADO, soma, faixa 0 ± 0,05 → −32,60%, Fora da faixa, 0 pts', () => {
    const r = calcularMeta(
      meta({
        formula: '(REALIZADO - ORCADO) / ORCADO',
        operador: Operador.FAIXA,
        tolerancia: '0.05',
        objetivos: { 0: '0' },
        regraPontuacao: RegraPontuacao.PROPORCIONAL,
      }),
      [
        variavel('REALIZADO', SOMA, [
          '14695.68',
          '11004.8',
          '11866.35',
          '11197.99',
          '11148.44',
          '9859.63',
          '8223.26',
          '8210.82',
          '8350.4',
          '7458.19',
          '1064.71',
        ]),
        variavel('ORCADO', SOMA, [
          '16477.22',
          '12164.83',
          '12160.04',
          '11768.95',
          '12648.31',
          '11547.72',
          '19230.17',
          '17449.68',
          '17796.95',
          '17196.91',
          '4506.21',
        ]),
      ],
    );
    expect(r.memoria.variaveis.map((v) => v.acumulado)).toEqual(['103080.27', '152946.99']);
    expect(arredondarExibicao(r.acumulado as Decimal, 'PERCENTUAL').toString()).toBe('-0.326');
    expect(r.situacao).toBe(Situacao.FORA_DA_FAIXA);
    expect(r.regraPontuacao).toBe(RegraPontuacao.TUDO_OU_NADA);
    expect(calcularPontos(r.regraPontuacao, r.atendimento, new Decimal(10)).toString()).toBe('0');
  });

  const comite = (valores: string[]) =>
    calcularMeta(
      meta({
        formula: 'IMPLANTADO',
        mesInicio: 1,
        mesFim: 5,
        modoApuracao: ModoApuracao.MAXIMO_RESULTADOS,
        operador: Operador.EQ,
        objetivos: { 0: '1' },
      }),
      [variavel('IMPLANTADO', ULTIMO, valores)],
    );

  it('CT-05: SIM/NÃO, período jan–mai, máximo, = 1; SIM em maio → 1, Batida', () => {
    const r = comite(['0', '0', '0', '0', '1']);
    expect(r.acumulado?.toString()).toBe('1');
    expect(r.situacao).toBe(Situacao.BATIDA);
  });

  it('CT-06: SIM só em junho → acumulado 0, Abaixo; junho fora do período', () => {
    const r = comite(['0', '0', '0', '0', '0', '1']);
    expect(r.acumulado?.toString()).toBe('0');
    expect(r.situacao).toBe(Situacao.ABAIXO);
    expect(r.mensal[5]).toMatchObject({ mes: 6, foraPeriodo: true });
    expect(r.mensal[5]?.resultado?.toString()).toBe('1');
    expect(r.mensal[4]?.foraPeriodo).toBe(false);
  });

  it('CT-07: RETRABALHO / NFS, soma, ≤ 5%, proporcional, peso 10 → 14,00%; 35,71%; 3,57 pts', () => {
    const r = calcularMeta(
      meta({
        formula: 'RETRABALHO / NFS',
        operador: Operador.LE,
        objetivos: { 0: '0.05' },
        regraPontuacao: RegraPontuacao.PROPORCIONAL,
      }),
      [
        variavel('RETRABALHO', SOMA, ['11', '19', '18', '0', '9', '11', '11', '8', '12']),
        variavel('NFS', SOMA, ['72', '73', '75', '60', '81', '77', '101', '81', '87']),
      ],
    );
    expect(r.memoria.variaveis.map((v) => v.acumulado)).toEqual(['99', '707']);
    expect(arredondarExibicao(r.acumulado as Decimal, 'PERCENTUAL').toString()).toBe('0.14');
    expect(seis(r.atendimento)).toBe('0.357071');
    expect(arredondarAtendimento(r.atendimento).toString()).toBe('0.3571');
    expect(
      arredondarPontos(calcularPontos(r.regraPontuacao, r.atendimento, new Decimal(10))).toString(),
    ).toBe('3.57');
  });

  describe('CT-08: PCT_IMPL, último resultado, = 100%, peso 15; nov 90%', () => {
    const entrada = (regra: RegraPontuacao) =>
      calcularMeta(
        meta({
          formula: 'PCT_IMPL',
          modoApuracao: ModoApuracao.ULTIMO_RESULTADO,
          operador: Operador.EQ,
          objetivos: { 0: '1' },
          regraPontuacao: regra,
        }),
        [
          variavel('PCT_IMPL', ULTIMO, [
            '0.1',
            '0.2',
            '0.3',
            '0.4',
            '0.5',
            '0.6',
            '0.7',
            '0.8',
            '0.85',
            '0.88',
            '0.90',
          ]),
        ],
      );

    it('90,00%; atendimento 0,90; tudo ou nada 0 pts; proporcional 13,50 pts', () => {
      const tudo = entrada(RegraPontuacao.TUDO_OU_NADA);
      const prop = entrada(RegraPontuacao.PROPORCIONAL);
      const peso = new Decimal(15);
      expect(tudo.acumulado?.toString()).toBe('0.9');
      expect(tudo.atendimento.toString()).toBe('0.9');
      expect(calcularPontos(tudo.regraPontuacao, tudo.atendimento, peso).toString()).toBe('0');
      expect(
        arredondarPontos(calcularPontos(prop.regraPontuacao, prop.atendimento, peso)).toString(),
      ).toBe('13.5');
    });
  });

  it('CT-09: PCT_REDUCAO, último resultado, ≤ −10%; set −19,79% → Batida; proporcional é recusado', () => {
    const configuracao = meta({
      formula: 'PCT_REDUCAO',
      modoApuracao: ModoApuracao.ULTIMO_RESULTADO,
      operador: Operador.LE,
      objetivos: { 0: '-0.10' },
    });
    const r = calcularMeta(configuracao, [variavel('PCT_REDUCAO', ULTIMO, ['-0.197886'], 9)]);
    expect(r.situacao).toBe(Situacao.BATIDA);
    expect(validarMeta(configuracao)).toEqual([]);
    expect(validarMeta({ ...configuracao, regraPontuacao: RegraPontuacao.PROPORCIONAL })).toEqual([
      {
        codigo: 'VALIDACAO',
        mensagem:
          'Pontuação proporcional não é permitida com objetivo menor ou igual a zero; use tudo ou nada',
        metaId: 'META',
      },
    ]);
  });

  it('CT-10: MEDIA_DIAS, média, ≤ 3 dias → −6,41 dias, Batida', () => {
    const r = calcularMeta(
      meta({
        formula: 'MEDIA_DIAS',
        modoApuracao: ModoApuracao.MEDIA_RESULTADOS,
        operador: Operador.LE,
        objetivos: { 0: '3' },
      }),
      [
        variavel('MEDIA_DIAS', MEDIA, [
          '-6',
          '-12.8',
          '-11.7',
          '-9.5',
          '-2.5',
          '-6.5',
          '0.5',
          '-3',
          '-10.3',
          '-2.3',
        ]),
      ],
    );
    expect(r.acumulado?.toString()).toBe('-6.41');
    expect(r.situacao).toBe(Situacao.BATIDA);
  });

  it('CT-11: RELATORIOS / VISITAS, ≥ 95%, peso 10 → 100%; atendimento 1 (teto); 10,00 pts, não 10,53', () => {
    const r = calcularMeta(
      meta({
        formula: 'RELATORIOS / VISITAS',
        objetivos: { 0: '0.95' },
        regraPontuacao: RegraPontuacao.PROPORCIONAL,
      }),
      [variavel('RELATORIOS', SOMA, ['15', '10']), variavel('VISITAS', SOMA, ['15', '10'])],
    );
    expect(r.acumulado?.toString()).toBe('1');
    expect(r.atendimento.toString()).toBe('1');
    expect(calcularPontos(r.regraPontuacao, r.atendimento, new Decimal(10)).toString()).toBe('10');
  });

  it('CT-12: Engajamento, 5 submetas × 20%, proporcional, peso 10 → 79,91%; 7,99 pts', () => {
    const submeta = (id: string, opcoes: Parameters<typeof meta>[0]) =>
      meta({ id, pesoInterno: '0.2', modoApuracao: ModoApuracao.ULTIMO_RESULTADO, ...opcoes });
    const engajamento = meta({
      id: 'ENGAJAMENTO',
      formula: null,
      regraPontuacao: RegraPontuacao.PROPORCIONAL,
      submetas: [
        submeta('PARTICIPACAO', {
          formula: 'EVENTOS_PART / EVENTOS_TOTAL',
          modoApuracao: ModoApuracao.FORMULA_SOBRE_ACUMULADOS,
          objetivos: { 0: '0.90' },
        }),
        submeta('TURNOVER', {
          formula: '(ADMISSOES + DEMISSOES) / 2 / TOTAL_COLAB',
          modoApuracao: ModoApuracao.FORMULA_SOBRE_ACUMULADOS,
          operador: Operador.LE,
          objetivos: { 0: '0.10' },
        }),
        submeta('JORNADA', {
          formula: 'JORNADA_PCT',
          operador: Operador.LE,
          objetivos: { 0: '0.03' },
        }),
        submeta('PROJETO', { formula: 'PCT_PROJETO', objetivos: { 0: '1' } }),
        submeta('LIDERANCA', { formula: 'NOTA_LIDERANCA', objetivos: { 0: '3' } }),
      ],
    });
    const r = calcularMeta(engajamento, [
      variavel('EVENTOS_PART', SOMA, ['20', '23']),
      variavel('EVENTOS_TOTAL', SOMA, ['24', '24']),
      variavel('ADMISSOES', SOMA, ['1', '1']),
      variavel('DEMISSOES', SOMA, ['1', '0']),
      variavel('TOTAL_COLAB', ULTIMO, ['80', '80']),
      variavel('JORNADA_PCT', ULTIMO, ['0.0056']),
      variavel('PCT_PROJETO', ULTIMO, ['0']),
      variavel('NOTA_LIDERANCA', ULTIMO, ['3.04']),
    ]);
    expect(r.submetas.map((s) => seis(s.atendimento))).toEqual(['0.99537', '1', '1', '0', '1']);
    expect(seis(r.atendimento)).toBe('0.799074');
    expect(arredondarAtendimento(r.atendimento).toString()).toBe('0.7991');
    expect(r.situacao).toBe(Situacao.ABAIXO);
    expect(
      arredondarPontos(calcularPontos(r.regraPontuacao, r.atendimento, new Decimal(10))).toString(),
    ).toBe('7.99');
    expect(
      calcularPontos(RegraPontuacao.TUDO_OU_NADA, r.atendimento, new Decimal(10)).toString(),
    ).toBe('0');
  });

  it('CT-13: média de variável ignora mês vazio → 3, não 2', () => {
    expect(acumular([new Decimal(2), null, new Decimal(4)], MEDIA)?.toString()).toBe('3');
    const r = calcularMeta(meta({ formula: 'X', objetivos: { 0: '3' } }), [
      variavel('X', MEDIA, ['2', null, '4']),
    ]);
    expect(r.acumulado?.toString()).toBe('3');
  });

  describe('CT-14: CHECKLISTS / PROC_CRITICOS com PROC_CRITICOS = 0 num mês', () => {
    const variaveis = [
      variavel('CHECKLISTS', ULTIMO, ['5', '5', '10']),
      variavel('PROC_CRITICOS', ULTIMO, ['10', '0', '10']),
    ];

    it('resultado do mês vazio com aviso DIVISAO_POR_ZERO', () => {
      const r = calcularMeta(meta({ formula: 'CHECKLISTS / PROC_CRITICOS' }), variaveis);
      expect(r.mensal[1]).toMatchObject({
        mes: 2,
        resultado: null,
        situacao: Situacao.SEM_DADOS,
        avisos: ['DIVISAO_POR_ZERO'],
      });
      expect(r.mensal[0]?.avisos).toEqual([]);
      expect(r.acumulado?.toString()).toBe('1');
    });

    it('o acumulado ignora o mês (média dos resultados: 0,75, não 0,5)', () => {
      const r = calcularMeta(
        meta({
          formula: 'CHECKLISTS / PROC_CRITICOS',
          modoApuracao: ModoApuracao.MEDIA_RESULTADOS,
        }),
        variaveis,
      );
      expect(r.acumulado?.toString()).toBe('0.75');
      expect(r.memoria.resultadosMensais.slice(0, 3)).toEqual([
        { mes: 1, resultado: '0.5' },
        { mes: 2, resultado: null },
        { mes: 3, resultado: '1' },
      ]);
    });
  });

  it('CT-15: meta corporativa atribuída a 2 gestores (pesos 15 e 10) → mesmo atendimento; 15×A e 10×A', () => {
    const saldo = {
      ...meta({
        id: 'SALDO_CAIXA',
        formula: 'RETRABALHO / NFS',
        operador: Operador.LE,
        objetivos: { 0: '0.05' },
        regraPontuacao: RegraPontuacao.PROPORCIONAL,
      }),
      bloco: Bloco.CORPORATIVO,
    };
    const r = calcularCiclo({
      metas: [saldo],
      variaveis: [variavel('RETRABALHO', SOMA, ['99']), variavel('NFS', SOMA, ['707'])],
      atribuicoes: [
        { id: 'AT-JULIA', metaId: 'SALDO_CAIXA', usuarioId: 'JULIA', peso: '15' },
        { id: 'AT-OUTRO', metaId: 'SALDO_CAIXA', usuarioId: 'OUTRO', peso: '10' },
      ],
    });
    const a = r.metas[0]?.atendimento as Decimal;
    expect(r.atribuicoes.map((x) => x.pontos.toString())).toEqual([
      a.times(15).toString(),
      a.times(10).toString(),
    ]);
    expect(r.atribuicoes.map((x) => arredondarPontos(x.pontos).toString())).toEqual([
      '5.36',
      '3.57',
    ]);
    expect(r.notas.map((n) => [n.usuarioId, n.pontos.toString()])).toEqual([
      ['JULIA', a.times(15).toString()],
      ['OUTRO', a.times(10).toString()],
    ]);
  });

  it('CT-16: período jul–dez, objetivo mensal jul 50% … dez 100% → compara com 100%; atendimento 0,80', () => {
    const r = calcularMeta(
      meta({
        formula: 'A / B',
        mesInicio: 7,
        mesFim: 12,
        objetivos: { 7: '0.5', 8: '0.6', 9: '0.7', 10: '0.8', 11: '0.9', 12: '1.0' },
      }),
      [
        variavel('A', SOMA, [...repetir('1', 6), ...repetir('8', 6)]),
        variavel('B', SOMA, [...repetir('1', 6), ...repetir('10', 6)]),
      ],
    );
    expect(r.mensal.slice(0, 6).every((m) => m.foraPeriodo)).toBe(true);
    expect(r.mensal.slice(6).every((m) => !m.foraPeriodo)).toBe(true);
    expect(r.acumulado?.toString()).toBe('0.8');
    expect(r.objetivo?.toString()).toBe('1');
    expect(r.mesObjetivo).toBe(12);
    expect(r.atendimento.toString()).toBe('0.8');
    expect(r.mensal[6]).toMatchObject({ mes: 7, situacao: Situacao.BATIDA });
    expect(r.mensal[6]?.objetivo?.toString()).toBe('0.5');
    expect(r.mensal[0]).toMatchObject({
      mes: 1,
      objetivo: null,
      atendimento: null,
      situacao: null,
    });
  });

  it('CT-17: gestor sem corporativas com departamentais somando 90 → PESOS_INCONSISTENTES', () => {
    expect(
      validarPesosGestor([
        { bloco: Bloco.DEPARTAMENTAL, peso: '40' },
        { bloco: Bloco.DEPARTAMENTAL, peso: '50' },
      ]),
    ).toEqual([
      {
        codigo: 'PESOS_INCONSISTENTES',
        mensagem: 'Os pesos do bloco Departamental somam 90,00; deveriam somar 100,00',
        metaId: null,
      },
    ]);
  });
});
