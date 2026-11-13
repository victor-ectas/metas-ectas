import { describe, expect, it } from 'vitest';

import {
  explicacaoPontos,
  formatarPeso,
  origemDoObjetivo,
  resumoNota,
  textoObjetivo,
  textoPeriodo,
  textoPontos,
} from '../src/paginas/minhas-metas/exibicao';

describe('textoObjetivo: operador e objetivo na unidade da meta', () => {
  it('CT-01 ≥ 80%, CT-03 ≤ 2 dias, CT-09 ≤ −10%', () => {
    expect(textoObjetivo('GE', '0.8', null, 'PERCENTUAL')).toBe('≥ 80,00%');
    expect(textoObjetivo('LE', '2', null, 'DIAS')).toBe('≤ 2,00\u00A0dias'); // espaço sem quebra entre número e unidade
    expect(textoObjetivo('LE', '-0.1', null, 'PERCENTUAL')).toBe('≤ -10,00%');
  });

  it('CT-04 faixa 0 ± 5%; CT-05 igual a Sim; sem objetivo, traço', () => {
    expect(textoObjetivo('FAIXA', '0', '0.05', 'PERCENTUAL')).toBe('0,00% ± 5,00%');
    expect(textoObjetivo('EQ', '1', null, 'SIM_NAO')).toBe('= Sim');
    expect(textoObjetivo('GE', null, null, 'PERCENTUAL')).toBe('—');
  });
});

describe('pontos e nota (RN-22 a RN-31)', () => {
  it('peso sem casas quando inteiro; pontos com 2 casas', () => {
    expect(formatarPeso('10.000000')).toBe('10');
    expect(formatarPeso('12.5')).toBe('12,50');
    expect(textoPontos('7.990741', '10')).toBe('7,99 de 10');
    expect(textoPontos(null, '10')).toBe('— de 10');
  });

  it('nota da Julia (API do P17): Corporativo 12 de 15, Departamental 17,99 de 20', () => {
    const resumo = resumoNota({
      corporativo: { peso: '15', pontos: '12' },
      departamental: { peso: '20', pontos: '17.990741' },
      total: '29.990741',
      calculadoEm: '2097-02-10T12:00:00.000Z',
    });
    expect(resumo).toEqual({
      total: '29,99',
      peso: '35',
      blocos: [
        { nome: 'Corporativo', pontos: '12,00', peso: '15', largura: '80.00' },
        { nome: 'Departamental', pontos: '17,99', peso: '20', largura: '89.95' },
      ],
    });
  });

  it('sem corporativas, só o bloco Departamental', () => {
    const resumo = resumoNota({
      corporativo: null,
      departamental: { peso: '100', pontos: '62.345' },
      total: '62.345',
      calculadoEm: null,
    });
    expect(resumo.total).toBe('62,35');
    expect(resumo.blocos.map((b) => b.nome)).toEqual(['Departamental']);
  });

  it('CT-12 proporcional: 10 × 79,91% = 7,99; CT-03 tudo ou nada: 0 pontos', () => {
    expect(explicacaoPontos('PROPORCIONAL', 'GE', '10', '0.799074', '7.99074')).toBe(
      'Proporcional: 10 × 79,91% = 7,99 pontos.',
    );
    expect(explicacaoPontos('TUDO_OU_NADA', 'LE', '10', '0.757935', '0')).toBe(
      'Tudo ou nada: atendimento abaixo de 100%, 0,00 pontos.',
    );
    expect(explicacaoPontos('TUDO_OU_NADA', 'GE', '10', '1', '10')).toBe(
      'Tudo ou nada: atendimento de 100%, vale os 10 pontos.',
    );
  });

  it('FAIXA é sempre tudo ou nada (CT-04), mesmo cadastrada como proporcional', () => {
    expect(explicacaoPontos('PROPORCIONAL', 'FAIXA', '10', '0', '0')).toMatch(/^Tudo ou nada/);
  });
});

describe('memória: período e origem do objetivo (RN-13, RN-15)', () => {
  it('objetivo único ou do último mês do período (CT-16: dezembro)', () => {
    expect(origemDoObjetivo(0)).toBe('objetivo único');
    expect(origemDoObjetivo(12)).toBe('objetivo de dezembro');
    expect(origemDoObjetivo(null)).toBe('sem objetivo cadastrado');
  });

  it('período da meta', () => {
    expect(textoPeriodo({ mesInicio: 1, mesFim: 12 })).toBe('Janeiro a dezembro');
    expect(textoPeriodo({ mesInicio: 7, mesFim: 12 })).toBe('Julho a dezembro');
    expect(textoPeriodo({ mesInicio: 5, mesFim: 5 })).toBe('Só em maio');
  });
});
