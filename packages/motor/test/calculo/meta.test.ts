import { Acumulacao, ModoApuracao, Operador, RegraPontuacao, Situacao } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import { calcularMeta, Decimal, MESES, type VariavelEntrada } from '../../src/index.js';
import { meta, seis, variavel } from './construtores.js';

const { SOMA, ULTIMO } = Acumulacao;

describe('calcularMeta', () => {
  describe('resultado mensal', () => {
    it('calcula os 12 meses, com objetivo do mês e situação', () => {
      const r = calcularMeta(meta({ formula: 'A', objetivos: { 0: '5' } }), [
        variavel('A', SOMA, ['6', '4']),
      ]);
      expect(r.mensal.map((m) => m.mes)).toEqual([...MESES]);
      expect(r.mensal[0]).toMatchObject({ situacao: Situacao.BATIDA, foraPeriodo: false });
      expect(r.mensal[0]?.atendimento?.toString()).toBe('1');
      expect(r.mensal[1]).toMatchObject({ situacao: Situacao.ABAIXO });
      expect(r.mensal[1]?.atendimento?.toString()).toBe('0.8');
      expect(r.mensal[2]).toMatchObject({
        resultado: null,
        atendimento: null,
        situacao: Situacao.SEM_DADOS,
      });
    });

    it('variável vazia no mês deixa o mês vazio (RN-16)', () => {
      const r = calcularMeta(meta({ formula: 'A + B' }), [
        variavel('A', SOMA, ['1', '1']),
        variavel('B', SOMA, ['1', null]),
      ]);
      expect(r.mensal[0]?.resultado?.toString()).toBe('2');
      expect(r.mensal[1]?.resultado).toBeNull();
    });

    it('mês de faixa fora da faixa', () => {
      const r = calcularMeta(
        meta({ formula: 'A', operador: Operador.FAIXA, tolerancia: '1', objetivos: { 0: '10' } }),
        [variavel('A', SOMA, ['10.5', '12'])],
      );
      expect(r.mensal[0]?.situacao).toBe(Situacao.BATIDA);
      expect(r.mensal[1]?.situacao).toBe(Situacao.FORA_DA_FAIXA);
    });
  });

  describe('acumulado e modos de apuração (RN-17)', () => {
    const variaveis = [variavel('A', SOMA, ['1', '4', null, '2'])];
    it.each([
      [ModoApuracao.SOMA_RESULTADOS, '7'],
      [ModoApuracao.MEDIA_RESULTADOS, '2.333333'],
      [ModoApuracao.MAXIMO_RESULTADOS, '4'],
      [ModoApuracao.ULTIMO_RESULTADO, '2'],
      [ModoApuracao.FORMULA_SOBRE_ACUMULADOS, '7'],
    ])('%s → %s', (modo, esperado) => {
      expect(seis(calcularMeta(meta({ modoApuracao: modo }), variaveis).acumulado)).toBe(esperado);
    });

    it('só os meses do período contam', () => {
      const r = calcularMeta(meta({ mesInicio: 2, mesFim: 3 }), [
        variavel('A', SOMA, ['100', '1', '2', '100']),
      ]);
      expect(r.acumulado?.toString()).toBe('3');
      expect(r.memoria.variaveis[0]?.valores).toEqual([
        { mes: 2, valor: '1' },
        { mes: 3, valor: '2' },
      ]);
    });

    it('sem dados no período → acumulado vazio, atendimento 0, Sem dados', () => {
      const r = calcularMeta(meta({ mesInicio: 6, mesFim: 12 }), [variavel('A', SOMA, ['1'])]);
      expect(r.acumulado).toBeNull();
      expect(r.atendimento.toString()).toBe('0');
      expect(r.situacao).toBe(Situacao.SEM_DADOS);
    });

    it('fórmula sobre acumulados: uma variável sem valor no período deixa vazio', () => {
      const r = calcularMeta(meta({ formula: 'A + B' }), [
        variavel('A', SOMA, ['1']),
        variavel('B', SOMA, [null]),
      ]);
      expect(r.acumulado).toBeNull();
      expect(r.situacao).toBe(Situacao.SEM_DADOS);
    });

    it('fórmula sobre acumulados com divisão por zero → vazio com aviso', () => {
      const r = calcularMeta(meta({ formula: 'A / B' }), [
        variavel('A', SOMA, ['1']),
        variavel('B', SOMA, ['0']),
      ]);
      expect(r.acumulado).toBeNull();
      expect(r.situacao).toBe(Situacao.SEM_DADOS);
      expect(r.avisos).toEqual(['DIVISAO_POR_ZERO']);
      expect(r.memoria.avisos).toEqual(['DIVISAO_POR_ZERO']);
    });
  });

  describe('objetivo (RN-15)', () => {
    it('objetivo mensal do último mês tem prioridade sobre o único', () => {
      const r = calcularMeta(meta({ mesFim: 6, objetivos: { 0: '100', 6: '2' } }), [
        variavel('A', SOMA, ['1', '1']),
      ]);
      expect(r.objetivo?.toString()).toBe('2');
      expect(r.mesObjetivo).toBe(6);
      expect(r.mensal[0]?.objetivo?.toString()).toBe('100');
    });

    it('sem objetivo mensal no último mês, usa o único', () => {
      const r = calcularMeta(meta({ objetivos: { 0: '2', 3: '9' } }), [variavel('A', SOMA, ['2'])]);
      expect(r.objetivo?.toString()).toBe('2');
      expect(r.mesObjetivo).toBe(0);
      expect(r.mensal[2]?.objetivo?.toString()).toBe('9');
    });

    it('sem objetivo: atendimento 0, aviso SEM_OBJETIVO', () => {
      const r = calcularMeta(meta({ objetivos: {} }), [variavel('A', SOMA, ['2'])]);
      expect(r.objetivo).toBeNull();
      expect(r.mesObjetivo).toBeNull();
      expect(r.atendimento.toString()).toBe('0');
      expect(r.situacao).toBe(Situacao.ABAIXO);
      expect(r.avisos).toEqual(['SEM_OBJETIVO']);
    });

    it('sem objetivo numa meta de faixa → Fora da faixa', () => {
      const r = calcularMeta(meta({ objetivos: {}, operador: Operador.FAIXA }), [
        variavel('A', SOMA, ['2']),
      ]);
      expect(r.situacao).toBe(Situacao.FORA_DA_FAIXA);
    });
  });

  describe('variáveis', () => {
    it('chave da fórmula sem variável mapeada é tratada como vazia', () => {
      const r = calcularMeta({ ...meta({ formula: 'A' }), variaveis: {} }, [
        variavel('A', SOMA, ['1']),
      ]);
      expect(r.acumulado).toBeNull();
      expect(r.memoria.variaveis).toEqual([
        {
          chave: 'A',
          variavelId: null,
          acumulacao: null,
          valores: expect.any(Array) as unknown,
          acumulado: null,
        },
      ]);
    });

    it('variável mapeada que não veio na lista é tratada como vazia', () => {
      const r = calcularMeta(meta({ formula: 'A' }), []);
      expect(r.acumulado).toBeNull();
      expect(r.memoria.variaveis[0]).toMatchObject({
        variavelId: 'A',
        acumulacao: null,
        acumulado: null,
      });
    });

    it('mapeia SETOR.VAR para a variável certa', () => {
      const m = { ...meta({ formula: 'A + RH.A' }), variaveis: { A: 'id-a', 'RH.A': 'id-rh-a' } };
      const r = calcularMeta(m, [variavel('id-a', SOMA, ['1']), variavel('id-rh-a', SOMA, ['10'])]);
      expect(r.acumulado?.toString()).toBe('11');
    });

    it('aceita as variáveis em lista ou em Map', () => {
      const v: VariavelEntrada = variavel('A', SOMA, ['3']);
      const porLista = calcularMeta(meta(), [v]);
      const porMapa = calcularMeta(meta(), new Map([['A', v]]));
      expect(porMapa.acumulado?.toString()).toBe(porLista.acumulado?.toString());
    });

    it('aceita Decimal nos lançamentos e nos objetivos', () => {
      const r = calcularMeta(
        meta({ objetivos: { 0: new Decimal(4) }, tolerancia: new Decimal('0.1') }),
        [{ id: 'A', acumulacao: SOMA, valores: { 1: new Decimal(2) } }],
      );
      expect(r.atendimento.toString()).toBe('0.5');
      expect(r.memoria.tolerancia).toBe('0.1');
    });
  });

  describe('memória de cálculo (RF-38)', () => {
    it('fórmula sobre acumulados: variáveis, acumulados, resultado, objetivo e atendimento', () => {
      const r = calcularMeta(meta({ formula: 'A / B', mesFim: 2, objetivos: { 0: '0.5' } }), [
        variavel('A', SOMA, ['1', '2']),
        variavel('B', ULTIMO, ['4', '6']),
      ]);
      expect(r.memoria).toEqual({
        formula: 'A / B',
        modoApuracao: ModoApuracao.FORMULA_SOBRE_ACUMULADOS,
        periodo: { mesInicio: 1, mesFim: 2 },
        variaveis: [
          {
            chave: 'A',
            variavelId: 'A',
            acumulacao: SOMA,
            valores: [
              { mes: 1, valor: '1' },
              { mes: 2, valor: '2' },
            ],
            acumulado: '3',
          },
          {
            chave: 'B',
            variavelId: 'B',
            acumulacao: ULTIMO,
            valores: [
              { mes: 1, valor: '4' },
              { mes: 2, valor: '6' },
            ],
            acumulado: '6',
          },
        ],
        resultadosMensais: [],
        resultado: '0.5',
        objetivo: '0.5',
        mesObjetivo: 0,
        operador: Operador.GE,
        tolerancia: null,
        atendimento: '1',
        situacao: Situacao.BATIDA,
        regraPontuacao: RegraPontuacao.TUDO_OU_NADA,
        componentes: null,
        avisos: [],
      });
      expect(JSON.parse(JSON.stringify(r.memoria))).toEqual(r.memoria);
    });

    it('modos que agregam resultados mostram os resultados mensais e não acumulam variáveis', () => {
      const r = calcularMeta(meta({ modoApuracao: ModoApuracao.SOMA_RESULTADOS, mesFim: 2 }), [
        variavel('A', SOMA, ['1', '2']),
      ]);
      expect(r.memoria.resultadosMensais).toEqual([
        { mes: 1, resultado: '1' },
        { mes: 2, resultado: '2' },
      ]);
      expect(r.memoria.variaveis[0]?.acumulado).toBeNull();
    });

    it('sem texto da fórmula, a memória fica com fórmula nula', () => {
      const semTexto = { ...meta() };
      delete semTexto.formulaTexto;
      expect(calcularMeta(semTexto, []).memoria.formula).toBeNull();
    });
  });

  describe('submetas (RN-26 a RN-30)', () => {
    const filha = (id: string, peso: string | null) =>
      meta({ id, formula: id, objetivos: { 0: '1' }, pesoInterno: peso });
    const variaveis = [
      variavel('F1', ULTIMO, ['1']),
      variavel('F2', ULTIMO, ['0.5']),
      variavel('F3', ULTIMO, ['1']),
      variavel('PROPRIA', ULTIMO, ['0.8']),
    ];

    it('mãe sem fórmula: atendimento ponderado, sem resultado próprio', () => {
      const r = calcularMeta(
        meta({ id: 'MAE', formula: null, submetas: [filha('F1', '0.5'), filha('F2', '0.5')] }),
        variaveis,
      );
      expect(r.atendimento.toString()).toBe('0.75');
      expect(r.situacao).toBe(Situacao.ABAIXO);
      expect(r.mensal).toEqual([]);
      expect(r.acumulado).toBeNull();
      expect(r.memoria.componentes).toEqual([
        { metaId: 'F1', proprio: false, pesoInterno: '0.5', atendimento: '1' },
        { metaId: 'F2', proprio: false, pesoInterno: '0.5', atendimento: '0.5' },
      ]);
    });

    it('mãe com fórmula própria entra como componente com peso interno (RN-30)', () => {
      const r = calcularMeta(
        meta({
          id: 'MAE',
          formula: 'PROPRIA',
          pesoInterno: '0.5',
          submetas: [filha('F1', '0.5')],
        }),
        variaveis,
      );
      expect(r.atendimento.toString()).toBe('0.9');
      expect(r.acumulado?.toString()).toBe('0.8');
      expect(r.mensal).toHaveLength(12);
      expect(r.memoria.componentes).toEqual([
        { metaId: 'F1', proprio: false, pesoInterno: '0.5', atendimento: '1' },
        { metaId: 'MAE', proprio: true, pesoInterno: '0.5', atendimento: '0.8' },
      ]);
    });

    it('todas as filhas batidas → mãe Batida; pesos 33,33% × 3 também chegam a 100%', () => {
      const r = calcularMeta(
        meta({
          formula: null,
          submetas: [filha('F1', '0.3333'), filha('F3', '0.3333'), filha('F1', '0.3333')],
        }),
        variaveis,
      );
      expect(r.atendimento.toString()).toBe('1');
      expect(r.situacao).toBe(Situacao.BATIDA);
    });

    it('todas as filhas sem dados → mãe Sem dados', () => {
      const r = calcularMeta(meta({ formula: null, submetas: [filha('X', '1')] }), []);
      expect(r.situacao).toBe(Situacao.SEM_DADOS);
      expect(r.atendimento.toString()).toBe('0');
    });

    it('a submeta usa as próprias regras, mas a regra da mãe vale para a pontuação', () => {
      const r = calcularMeta(
        meta({
          formula: null,
          regraPontuacao: RegraPontuacao.PROPORCIONAL,
          operador: Operador.FAIXA,
          submetas: [
            meta({
              id: 'F',
              formula: 'F2',
              operador: Operador.FAIXA,
              tolerancia: '0',
              objetivos: { 0: '1' },
              pesoInterno: '1',
            }),
          ],
        }),
        variaveis,
      );
      expect(r.submetas[0]?.situacao).toBe(Situacao.FORA_DA_FAIXA);
      expect(r.regraPontuacao).toBe(RegraPontuacao.PROPORCIONAL);
    });

    it('sem pesos internos → atendimento 0', () => {
      const r = calcularMeta(meta({ formula: null, submetas: [filha('F1', null)] }), variaveis);
      expect(r.atendimento.toString()).toBe('0');
      expect(r.memoria.componentes?.[0]?.pesoInterno).toBe('0');
    });
  });

  it('meta sem fórmula e sem submetas: Sem dados', () => {
    const r = calcularMeta(meta({ formula: null }), []);
    expect(r).toMatchObject({
      situacao: Situacao.SEM_DADOS,
      acumulado: null,
      mensal: [],
      avisos: [],
    });
    expect(r.atendimento.toString()).toBe('0');
    expect(r.memoria.formula).toBeNull();
  });
});
