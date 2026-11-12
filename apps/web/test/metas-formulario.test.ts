import type { Meta } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import {
  calculoVazio,
  formularioDe,
  formularioVazio,
  lerNumero,
  paraApi,
  paraDigitado,
  paraEntrada,
  somaPesosInternos,
} from '../src/paginas/metas/formulario';
import { FRASE_SO_AGREGA, fraseBateQuando, fraseVale } from '../src/paginas/metas/frase-resumo';

const SETOR = '22222222-2222-4222-8222-222222222222';
const JULIA = '11111111-1111-4111-8111-111111111111';

/** Objetivos mensais digitados (mês → texto) na lista de 12 posições do formulário. */
const mensais = (porMes: Record<number, string>) =>
  Array.from({ length: 12 }, (_x, i) => porMes[i + 1] ?? '');

describe('números digitados', () => {
  it.each([
    ['0,5', '0.5'],
    ['0.5', '0.5'],
    ['1.234,56', '1234.56'],
    [' -10 ', '-10'],
  ])('lerNumero("%s")', (texto, esperado) => {
    expect(lerNumero(texto)?.toFixed()).toBe(esperado);
  });

  it('vazio é null; inválido é undefined', () => {
    expect(lerNumero('  ')).toBeNull();
    expect(lerNumero('abc')).toBeUndefined();
    expect(lerNumero('1,2,3')).toBeUndefined();
  });

  it('percentual digitado de 0 a 100 vira fração e volta (RN-11)', () => {
    expect(paraApi('80', 'PERCENTUAL')).toBe('0.8');
    expect(paraApi('79,912', 'PERCENTUAL')).toBe('0.79912');
    expect(paraApi('-10', 'PERCENTUAL')).toBe('-0.1');
    expect(paraDigitado('0.8', 'PERCENTUAL')).toBe('80');
    expect(paraDigitado('2.63875', 'DIAS')).toBe('2,63875');
    expect(paraDigitado(null, 'NUMERO')).toBe('');
  });

  it('pesos internos 0,1 + 0,2 somam 0,3 exato; inválido conta zero', () => {
    expect(
      somaPesosInternos([
        { pesoInterno: '0,1' },
        { pesoInterno: '0,2' },
        { pesoInterno: 'x' },
      ]).toFixed(),
    ).toBe('0.3');
  });
});

describe('paraEntrada', () => {
  it('CT-01: monta o corpo da API com objetivo único em fração', () => {
    const form = formularioVazio(SETOR, JULIA);
    form.raiz = calculoVazio({
      codigo: 'fiscal_prazo',
      indicador: 'Requisições no prazo',
      metrica: 'Atendidas / total',
      formula: 'REQ_ATENDIDOS / TOTAL_REQ',
      objetivoUnico: '80',
    });
    form.atribuicoes = [{ usuarioId: JULIA, peso: '10' }];
    form.regraPontuacao = 'PROPORCIONAL';
    const { entrada, problemas } = paraEntrada(form);
    expect(problemas).toEqual([]);
    expect(entrada).toMatchObject({
      setorId: SETOR,
      codigo: 'fiscal_prazo',
      formula: 'REQ_ATENDIDOS / TOTAL_REQ',
      objetivos: [{ mes: 0, valor: '0.8' }],
      tolerancia: null,
      pesoInterno: null,
      regraPontuacao: 'PROPORCIONAL',
      atribuicoes: [{ usuarioId: JULIA, peso: '10' }],
      submetas: [],
    });
  });

  it('objetivo mensal: só os meses do período', () => {
    const form = formularioVazio(SETOR, JULIA);
    form.raiz = calculoVazio({
      mesInicio: 7,
      mesFim: 12,
      tipoObjetivo: 'MENSAL',
      objetivosMensais: mensais({ 3: '10', 7: '50', 12: '100' }),
    });
    expect(paraEntrada(form).entrada.objetivos).toEqual([
      { mes: 7, valor: '0.5' },
      { mes: 12, valor: '1' },
    ]);
  });

  it('mãe que só agrega: sem fórmula, objetivos nem peso próprio; submetas em fração', () => {
    const form = formularioVazio(SETOR, JULIA);
    form.soAgrega = true;
    form.raiz = calculoVazio({
      codigo: 'ENGAJ',
      formula: 'X',
      objetivoUnico: '1',
      pesoInterno: '30',
    });
    form.submetas = [1, 2, 3, 4, 5].map((i) =>
      calculoVazio({
        codigo: `ENGAJ_${String(i)}`,
        formula: 'PRESENCAS',
        objetivoUnico: '90',
        pesoInterno: '20',
      }),
    );
    const { entrada } = paraEntrada(form);
    expect(entrada).toMatchObject({ formula: null, objetivos: [], pesoInterno: null });
    expect(entrada.submetas?.map((s) => s.pesoInterno)).toEqual([
      '0.2',
      '0.2',
      '0.2',
      '0.2',
      '0.2',
    ]);
  });

  it('mãe com fórmula própria e submetas leva o peso próprio (RN-30)', () => {
    const form = formularioVazio(SETOR, JULIA);
    form.raiz = calculoVazio({ formula: 'X', objetivoUnico: '1', pesoInterno: '50' });
    form.submetas = [calculoVazio({ formula: 'Y', objetivoUnico: '1', pesoInterno: '50' })];
    expect(paraEntrada(form).entrada.pesoInterno).toBe('0.5');
  });

  it('FAIXA leva a tolerância; outros operadores não', () => {
    const form = formularioVazio(SETOR, JULIA);
    form.raiz = calculoVazio({ operador: 'FAIXA', objetivoUnico: '0', tolerancia: '5' });
    expect(paraEntrada(form).entrada.tolerancia).toBe('0.05');
    form.raiz.operador = 'GE';
    expect(paraEntrada(form).entrada.tolerancia).toBeNull();
  });

  it('número inválido vira problema, dizendo onde está', () => {
    const form = formularioVazio(SETOR, JULIA);
    form.raiz = calculoVazio({
      codigo: 'abc',
      objetivoUnico: '8O',
      operador: 'FAIXA',
      tolerancia: '?',
    });
    form.atribuicoes = [{ usuarioId: JULIA, peso: '' }];
    expect(paraEntrada(form).problemas).toEqual([
      { onde: 'Pontuação', mensagem: 'Informe o peso de cada gestor atribuído.' },
      { onde: 'ABC', mensagem: 'Tolerância inválida: "?".' },
      { onde: 'ABC', mensagem: 'Objetivo inválido: "8O". Use, por exemplo, 80 ou 0,5.' },
    ]);
  });
});

describe('formularioDe', () => {
  it('converte a meta da API para o que se digita', () => {
    const meta = {
      id: '33333333-3333-4333-8333-333333333333',
      cicloId: SETOR,
      setorId: SETOR,
      setorCodigo: 'FISCAL',
      setorNome: 'Fiscal',
      bloco: 'DEPARTAMENTAL',
      codigo: 'FISCAL_PRAZO',
      indicador: 'Prazo',
      metrica: 'M',
      unidade: 'PERCENTUAL',
      formula: null,
      modoApuracao: 'FORMULA_SOBRE_ACUMULADOS',
      operador: 'GE',
      tolerancia: null,
      mesInicio: 1,
      mesFim: 12,
      objetivos: [],
      regraPontuacao: 'PROPORCIONAL',
      pesoInterno: null,
      responsavelId: JULIA,
      responsavelNome: 'Julia',
      ordem: 0,
      ativo: true,
      versao: 3,
      variaveis: [],
      atribuicoes: [{ id: SETOR, usuarioId: JULIA, usuarioNome: 'Julia', peso: '12.5' }],
      submetas: [
        {
          id: JULIA,
          codigo: 'SUB',
          indicador: 'Sub',
          metrica: 'M',
          unidade: 'DIAS',
          formula: 'X',
          modoApuracao: 'MEDIA_RESULTADOS',
          operador: 'LE',
          tolerancia: null,
          mesInicio: 1,
          mesFim: 8,
          objetivos: [{ mes: 8, valor: '2' }],
          pesoInterno: '0.2',
          ordem: 0,
          ativo: true,
          versao: 1,
          variaveis: [],
        },
      ],
      temLancamentos: false,
    } satisfies Meta;
    const form = formularioDe(meta);
    expect(form).toMatchObject({
      soAgrega: true,
      atribuicoes: [{ usuarioId: JULIA, peso: '12,5' }],
      raiz: { formula: '', tipoObjetivo: 'UNICO', objetivoUnico: '' },
      submetas: [
        {
          id: JULIA,
          tipoObjetivo: 'MENSAL',
          objetivosMensais: mensais({ 8: '2' }),
          pesoInterno: '20',
        },
      ],
    });
    expect(form.raiz.id).toBeUndefined();
  });
});

describe('frase-resumo (RF-17)', () => {
  it('CT-01', () => {
    expect(
      fraseBateQuando(calculoVazio({ formula: 'REQ_ATENDIDOS / TOTAL_REQ', objetivoUnico: '80' })),
    ).toBe(
      'Bate quando o resultado de REQ_ATENDIDOS / TOTAL_REQ, de janeiro a dezembro (com a fórmula aplicada ao acumulado de cada variável), for maior ou igual a 80,00%.',
    );
  });

  it('CT-03: dias, média dos resultados, menor ou igual', () => {
    expect(
      fraseBateQuando(
        calculoVazio({
          formula: 'MEDIA_DIAS',
          unidade: 'DIAS',
          modoApuracao: 'MEDIA_RESULTADOS',
          operador: 'LE',
          mesFim: 8,
          objetivoUnico: '2',
        }),
      ),
    ).toBe(
      'Bate quando o resultado de MEDIA_DIAS, de janeiro a agosto (pela média dos resultados mensais), for menor ou igual a 2,00 dias.',
    );
  });

  it('CT-04: faixa 0 ± 5%', () => {
    expect(
      fraseBateQuando(
        calculoVazio({ formula: 'X', operador: 'FAIXA', objetivoUnico: '0', tolerancia: '5' }),
      ),
    ).toMatch(/ficar entre -5,00% e 5,00%\.$/);
  });

  it('CT-16: objetivo mensal compara com o último mês do período', () => {
    expect(
      fraseBateQuando(
        calculoVazio({
          formula: 'X',
          mesInicio: 7,
          tipoObjetivo: 'MENSAL',
          objetivosMensais: mensais({ 7: '50', 12: '100' }),
        }),
      ),
    ).toMatch(/de julho a dezembro .* for maior ou igual a 100,00% \(objetivo de dezembro\)\.$/);
  });

  it('sem fórmula e sem objetivo; período de um mês', () => {
    expect(
      fraseBateQuando(
        calculoVazio({ mesInicio: 5, mesFim: 5, operador: 'EQ', unidade: 'SIM_NAO' }),
      ),
    ).toBe(
      'Bate quando o resultado da fórmula, em maio (com a fórmula aplicada ao acumulado de cada variável), for igual a ….',
    );
  });

  it('quanto vale', () => {
    expect(fraseVale('PROPORCIONAL', 'GE', [{ nome: 'Julia', peso: '10' }])).toBe(
      'Vale 10,00 pontos para Julia, proporcional ao atendimento.',
    );
    expect(
      fraseVale('PROPORCIONAL', 'FAIXA', [
        { nome: 'Julia', peso: '15' },
        { nome: 'Carlos', peso: '1' },
      ]),
    ).toBe('Vale 15,00 pontos para Julia e 1,00 ponto para Carlos, só se bater (tudo ou nada).');
    expect(fraseVale('TUDO_OU_NADA', 'GE', [])).toBe('Ainda não foi atribuída a nenhum gestor.');
    expect(FRASE_SO_AGREGA).toMatch(/^Bate quando/);
  });
});
