import type { LancamentosMes, MetaLancamento, VariavelLancamento } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import {
  agrupar,
  lerCampo,
  mesmoValor,
  previa,
  valorParaCampo,
} from '../src/paginas/lancamentos/lancamento';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ano = (valores: Record<number, string>) =>
  Array.from({ length: 12 }, (_, i) => valores[i + 1] ?? null);

function variavel(n: number, alteracoes: Partial<VariavelLancamento> = {}): VariavelLancamento {
  return {
    id: id(n),
    setorId: id(100),
    setorCodigo: 'FISCAL',
    setorNome: 'Fiscal',
    codigo: `V${String(n)}`,
    nome: `Variável ${String(n)}`,
    tipo: 'NUMERO',
    acumulacao: 'SOMA',
    casasDecimais: 0,
    editavel: true,
    status: 'ABERTO',
    valor: null,
    versao: 0,
    origem: null,
    atualizadoEm: null,
    valoresAno: ano({}),
    ...alteracoes,
  };
}

/** CT-01: REQ_ATENDIDOS / TOTAL_REQ, ambas SOMA, GE 0,80; jan 16/20 já gravado. */
const atendidos = variavel(1, {
  codigo: 'REQ_ATENDIDOS',
  nome: 'Requisições atendidas',
  valoresAno: ano({ 1: '16' }),
});
const total = variavel(2, {
  codigo: 'TOTAL_REQ',
  nome: 'Total de requisições',
  valoresAno: ano({ 1: '20' }),
});
const ct01: MetaLancamento = {
  id: id(10),
  codigo: 'FISCAL_PRAZO',
  indicador: 'Requisições no prazo',
  unidade: 'PERCENTUAL',
  formula: 'REQ_ATENDIDOS / TOTAL_REQ',
  modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
  operador: 'GE',
  tolerancia: null,
  mesInicio: 1,
  mesFim: 12,
  objetivos: [{ mes: 0, valor: '0.8' }],
  pesoInterno: null,
  variaveis: { REQ_ATENDIDOS: id(1), TOTAL_REQ: id(2) },
  setorNome: 'Fiscal',
  regraPontuacao: 'PROPORCIONAL',
  submetas: [],
};

describe('lerCampo: o que o gestor digita (ADR-024)', () => {
  it('vírgula decimal e percentual de 0 a 100 viram o valor da API', () => {
    const pct = variavel(3, { tipo: 'PERCENTUAL', casasDecimais: 2 });
    expect(lerCampo(pct, '12,34')).toEqual({ ok: true, valor: '0.1234' });
    expect(lerCampo(pct, '-19,79')).toEqual({ ok: true, valor: '-0.1979' });
    expect(lerCampo(variavel(4, { casasDecimais: 2 }), '1.234,5')).toEqual({
      ok: true,
      valor: '1234.5',
    });
  });

  it('vazio é null, nunca zero (RN-08)', () => {
    expect(lerCampo(total, '')).toEqual({ ok: true, valor: null });
    expect(lerCampo(total, '0')).toEqual({ ok: true, valor: '0' });
  });

  it('recusa casas a mais e texto que não é número', () => {
    expect(lerCampo(total, '1,5')).toEqual({ ok: false, mensagem: 'Use só números inteiros.' });
    expect(lerCampo(variavel(5, { tipo: 'PERCENTUAL', casasDecimais: 2 }), '12,345')).toMatchObject(
      {
        ok: false,
        mensagem: 'Use no máximo 2 casas decimais.',
      },
    );
    expect(lerCampo(total, 'doze')).toMatchObject({ ok: false });
  });

  it('SIM/NÃO: 1, 0 ou vazio', () => {
    const simNao = variavel(6, { tipo: 'SIM_NAO' });
    expect(lerCampo(simNao, '1')).toEqual({ ok: true, valor: '1' });
    expect(lerCampo(simNao, '')).toEqual({ ok: true, valor: null });
    expect(lerCampo(simNao, '2')).toMatchObject({ ok: false });
  });

  it('valor gravado volta para o campo como o gestor digitaria', () => {
    expect(valorParaCampo(variavel(7, { tipo: 'PERCENTUAL' }), '0.1234')).toBe('12,34');
    expect(valorParaCampo(total, null)).toBe('');
    expect(mesmoValor('20', '20.0')).toBe(true);
    expect(mesmoValor(null, '0')).toBe(false);
  });
});

describe('agrupar: variável compartilhada aparece uma vez', () => {
  it('a segunda meta que usa TOTAL_REQ não repete o campo', () => {
    const outra: MetaLancamento = {
      ...ct01,
      id: id(11),
      codigo: 'FISCAL_OUTRA',
      formula: 'TOTAL_REQ',
      variaveis: { TOTAL_REQ: id(2), 'RH.COLAB': id(8) },
    };
    const deOutroSetor = variavel(8, { editavel: false, setorNome: 'RH', valor: '80' });
    const solta = variavel(9);
    const dados = {
      variaveis: [atendidos, total, deOutroSetor, solta],
      metas: [ct01, outra],
    } as unknown as LancamentosMes;
    const grupos = agrupar(dados);
    expect(grupos.map((g) => [g.meta?.codigo ?? null, g.variaveis.map((v) => v.codigo)])).toEqual([
      ['FISCAL_PRAZO', ['REQ_ATENDIDOS', 'TOTAL_REQ']],
      ['FISCAL_OUTRA', []],
      [null, ['V9']],
    ]);
    expect(grupos[1]?.jaMostradas.map((v) => v.codigo)).toEqual(['TOTAL_REQ']);
    expect(grupos[1]?.deOutros.map((v) => v.codigo)).toEqual(['V8']);
  });
});

describe('prévia com o motor (aceite do P19)', () => {
  it('CT-01: fevereiro digitado 20/25 → mês 80%, acumulado 36/45 = 80%, BATIDA', () => {
    const digitados = new Map<string, string | null>([
      [id(1), '20'],
      [id(2), '25'],
    ]);
    const r = previa(ct01, [atendidos, total], 2, digitados);
    expect(r?.mensal[1]?.resultado?.toString()).toBe('0.8');
    expect(r?.acumulado?.toString()).toBe('0.8');
    expect(r?.situacao).toBe('BATIDA');
  });

  it('muda enquanto digita: 10/25 em fevereiro → acumulado 26/45, ABAIXO', () => {
    const digitados = new Map<string, string | null>([
      [id(1), '10'],
      [id(2), '25'],
    ]);
    const r = previa(ct01, [atendidos, total], 2, digitados);
    expect(r?.acumulado?.toDecimalPlaces(6).toString()).toBe('0.577778');
    expect(r?.situacao).toBe('ABAIXO');
  });

  it('apagar um valor (vazio) deixa o mês sem resultado', () => {
    const digitados = new Map<string, string | null>([[id(1), null]]);
    const comFev = [
      { ...atendidos, valoresAno: ano({ 1: '16', 2: '20' }) },
      { ...total, valoresAno: ano({ 1: '20', 2: '25' }) },
    ];
    const r = previa(ct01, comFev, 2, digitados);
    expect(r?.mensal[1]?.resultado).toBeNull();
    // Cada variável acumula sozinha (RN-17): REQ_ATENDIDOS só janeiro (16), TOTAL_REQ 45.
    expect(r?.acumulado?.toDecimalPlaces(6).toString()).toBe('0.355556');
  });
});
