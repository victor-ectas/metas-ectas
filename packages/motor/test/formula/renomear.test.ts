import { describe, expect, it } from 'vitest';

import { FormulaErro, renomearVariavel } from '../../src/index.js';

const doRh = { setorDaMeta: 'RH', setorDaVariavel: 'RH', antigo: 'PRESENCAS', novo: 'PRESENTES' };

describe('renomearVariavel (RF-21)', () => {
  it('troca o código simples na meta do mesmo setor', () => {
    expect(renomearVariavel('PRESENCAS / TOTAL', doRh)).toBe('PRESENTES / TOTAL');
  });

  it('troca todas as ocorrências e mantém o resto do texto como foi digitado', () => {
    expect(renomearVariavel('arred(presencas,2) +  PRESENCAS*0,5', doRh)).toBe(
      'arred(PRESENTES,2) +  PRESENTES*0,5',
    );
  });

  it('troca SETOR.CODIGO em meta de outro setor', () => {
    const fiscal = { ...doRh, setorDaMeta: 'FISCAL' };
    expect(renomearVariavel('rh.Presencas + PRESENCAS', fiscal)).toBe('RH.PRESENTES + PRESENCAS');
  });

  it('troca SETOR.CODIGO também na meta do próprio setor', () => {
    expect(renomearVariavel('RH.PRESENCAS - PRESENCAS', doRh)).toBe('RH.PRESENTES - PRESENTES');
  });

  it('não troca a variável de mesmo código de outro setor', () => {
    expect(
      renomearVariavel('FISCAL.PRESENCAS + PRESENCAS', { ...doRh, setorDaMeta: 'FISCAL' }),
    ).toBe('FISCAL.PRESENCAS + PRESENCAS');
  });

  it('não troca nomes parecidos nem chamadas de função', () => {
    const max = { ...doRh, antigo: 'MAX', novo: 'MAXIMO_DIA' };
    expect(renomearVariavel('MAX(PRESENCAS_2; MAX) + PRESENCAS_2', max)).toBe(
      'MAX(PRESENCAS_2; MAXIMO_DIA) + PRESENCAS_2',
    );
  });

  it('devolve o mesmo texto quando a variável não aparece', () => {
    expect(renomearVariavel('1 + TOTAL', doRh)).toBe('1 + TOTAL');
  });

  it('compara setores e códigos sem diferenciar maiúsculas', () => {
    expect(
      renomearVariavel('presencas', {
        setorDaMeta: 'rh',
        setorDaVariavel: 'Rh',
        antigo: 'presencas',
        novo: 'NOVO',
      }),
    ).toBe('NOVO');
  });

  it('fórmula inválida lança FormulaErro', () => {
    expect(() => renomearVariavel('PRESENCAS # 2', doRh)).toThrow(FormulaErro);
  });
});
