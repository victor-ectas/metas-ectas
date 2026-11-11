import { StatusMes } from '@metas/tipos';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  dataFechamento,
  diasUteis,
  ehDiaUtil,
  noFusoDasRegras,
  type ReaberturaCalendario,
  statusMes,
  ZONA_REGRAS,
} from '../../src/index.js';

/** Instante no fuso das regras: `sp('2026-11-24T23:59')`. */
const sp = (iso: string): DateTime => DateTime.fromISO(iso, { zone: ZONA_REGRAS });

/** Fechamento como `dd/MM/yyyy HH:mm:ss.SSS` no fuso das regras. */
const fechamento = (ano: number, mes: number, feriados: string[] = []): string =>
  dataFechamento(ano, mes, feriados).toFormat('dd/MM/yyyy HH:mm:ss.SSS');

const FERIADOS_NOV_2026 = ['2026-11-02', '2026-11-20'];

describe('dias úteis (RN-33)', () => {
  it('segunda a sexta são úteis; sábado e domingo não', () => {
    expect(ehDiaUtil('2026-11-23', [])).toBe(true); // segunda
    expect(ehDiaUtil('2026-11-27', [])).toBe(true); // sexta
    expect(ehDiaUtil('2026-11-28', [])).toBe(false); // sábado
    expect(ehDiaUtil('2026-11-29', [])).toBe(false); // domingo
  });

  it('feriado cadastrado não é dia útil', () => {
    expect(ehDiaUtil('2026-11-02', FERIADOS_NOV_2026)).toBe(false);
    expect(ehDiaUtil('2026-11-03', FERIADOS_NOV_2026)).toBe(true);
  });

  it('lista os dias úteis do mês', () => {
    const novembro = diasUteis(2026, 11, FERIADOS_NOV_2026);
    expect(novembro).toHaveLength(19);
    expect(novembro.slice(0, 3)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(novembro).not.toContain('2026-11-20');
    expect(novembro.at(-1)).toBe('2026-11-30');
  });

  it('aceita qualquer iterável de feriados', () => {
    expect(diasUteis(2026, 11, new Set(FERIADOS_NOV_2026))).toHaveLength(19);
  });
});

describe('data de fechamento (RN-34)', () => {
  it('CT-18: outubro/2026 com feriados 02/11 e 20/11 → 24/11/2026 23:59:59', () => {
    expect(fechamento(2026, 10, FERIADOS_NOV_2026)).toBe('24/11/2026 23:59:59.999');
    expect(dataFechamento(2026, 10, FERIADOS_NOV_2026).zoneName).toBe(ZONA_REGRAS);
  });

  it('outubro/2026 sem feriados → 20/11/2026', () => {
    expect(fechamento(2026, 10)).toBe('20/11/2026 23:59:59.999');
  });

  it('virada de ano: dezembro/2026 com feriado 01/01/2027 → 22/01/2027', () => {
    expect(fechamento(2026, 12, ['2027-01-01'])).toBe('22/01/2027 23:59:59.999');
  });

  it('feriado no 1º dia útil do mês seguinte: abril/2026 com 01/05 (sexta) → 22/05/2026', () => {
    expect(fechamento(2026, 4, ['2026-05-01'])).toBe('22/05/2026 23:59:59.999');
  });

  it('janeiro/2027 → 19/02; com Carnaval (08 e 09/02) → 23/02', () => {
    expect(fechamento(2027, 1)).toBe('19/02/2027 23:59:59.999');
    expect(fechamento(2027, 1, ['2027-02-08', '2027-02-09'])).toBe('23/02/2027 23:59:59.999');
  });

  it('feriados de outros meses não interferem', () => {
    expect(fechamento(2026, 11, FERIADOS_NOV_2026)).toBe('21/12/2026 23:59:59.999');
  });

  it('em UTC, o fechamento de 24/11 é 25/11 02:59:59.999', () => {
    expect(dataFechamento(2026, 10, FERIADOS_NOV_2026).toUTC().toISO()).toBe(
      '2026-11-25T02:59:59.999Z',
    );
  });

  it('mês seguinte sem 15 dias úteis é erro de cadastro', () => {
    const quaseTodoNovembro = diasUteis(2026, 11, []).slice(5);
    expect(() => dataFechamento(2026, 10, quaseTodoNovembro)).toThrow(
      '11/2026 tem só 5 dias úteis; o fechamento precisa do 15º',
    );
  });
});

describe('status do mês (RN-34 a RN-36)', () => {
  const status = (agora: string, reaberturas: ReaberturaCalendario[] = []) =>
    statusMes(2026, 10, sp(agora), FERIADOS_NOV_2026, reaberturas);

  describe('CT-18: outubro/2026', () => {
    it('ABERTO em 24/11 23:59', () => {
      expect(status('2026-11-24T23:59')).toBe(StatusMes.ABERTO);
      expect(status('2026-11-24T23:59:59.999')).toBe(StatusMes.ABERTO);
    });

    it('FECHADO em 25/11 00:00', () => {
      expect(status('2026-11-25T00:00')).toBe(StatusMes.FECHADO);
    });

    it('com reabertura até 27/11 → REABERTO; depois do prazo, FECHADO de novo', () => {
      const ate27 = [{ ano: 2026, mes: 10, validoAte: sp('2026-11-27').endOf('day') }];
      expect(status('2026-11-25T00:00', ate27)).toBe(StatusMes.REABERTO);
      expect(status('2026-11-27T23:59:59.999', ate27)).toBe(StatusMes.REABERTO);
      expect(status('2026-11-28T00:00', ate27)).toBe(StatusMes.FECHADO);
    });
  });

  it('ABERTO desde o dia 1 do próprio mês', () => {
    expect(status('2026-10-01T00:00')).toBe(StatusMes.ABERTO);
  });

  it('FUTURO depois do mês corrente, inclusive na virada de ano', () => {
    expect(status('2026-09-30T23:59:59.999')).toBe(StatusMes.FUTURO);
    expect(statusMes(2027, 1, sp('2026-12-31T23:59'), [])).toBe(StatusMes.FUTURO);
    expect(statusMes(2027, 1, sp('2027-01-01T00:00'), [])).toBe(StatusMes.ABERTO);
  });

  it('dezembro/2026 continua aberto em janeiro até 22/01/2027', () => {
    const feriados = ['2027-01-01'];
    expect(statusMes(2026, 12, sp('2027-01-22T23:59'), feriados)).toBe(StatusMes.ABERTO);
    expect(statusMes(2026, 12, sp('2027-01-23T00:00'), feriados)).toBe(StatusMes.FECHADO);
  });

  it('meses antigos ficam fechados', () => {
    expect(statusMes(2025, 3, sp('2026-11-11T12:00'), [])).toBe(StatusMes.FECHADO);
  });

  describe('reaberturas', () => {
    const depois = '2026-11-26T10:00';

    it('reabertura de outro mês ou ano não vale', () => {
      expect(status(depois, [{ ano: 2026, mes: 9, validoAte: sp('2026-12-31') }])).toBe(
        StatusMes.FECHADO,
      );
      expect(status(depois, [{ ano: 2025, mes: 10, validoAte: sp('2026-12-31') }])).toBe(
        StatusMes.FECHADO,
      );
    });

    it('reabertura cancelada deixa de valer a partir do cancelamento', () => {
      const cancelada = [
        {
          ano: 2026,
          mes: 10,
          validoAte: sp('2026-11-30'),
          canceladaEm: sp('2026-11-26T09:00'),
        },
      ];
      expect(status('2026-11-26T08:59', cancelada)).toBe(StatusMes.REABERTO);
      expect(status('2026-11-26T09:00', cancelada)).toBe(StatusMes.FECHADO);
    });

    it('canceladaEm nulo é reabertura ativa', () => {
      expect(
        status(depois, [{ ano: 2026, mes: 10, validoAte: sp('2026-11-30'), canceladaEm: null }]),
      ).toBe(StatusMes.REABERTO);
    });

    it('basta uma reabertura vigente', () => {
      expect(
        status(depois, [
          { ano: 2026, mes: 10, validoAte: sp('2026-11-25') },
          { ano: 2026, mes: 10, validoAte: sp('2026-11-30') },
        ]),
      ).toBe(StatusMes.REABERTO);
    });

    it('reabertura não muda um mês ainda aberto nem um mês futuro', () => {
      const r = [{ ano: 2026, mes: 10, validoAte: sp('2026-12-31') }];
      expect(status('2026-11-10T10:00', r)).toBe(StatusMes.ABERTO);
      expect(status('2026-09-10T10:00', r)).toBe(StatusMes.FUTURO);
    });
  });

  describe('instantes em formatos diferentes', () => {
    it('aceita Date, texto ISO com fuso e DateTime em outro fuso', () => {
      // 25/11/2026 00:00 em São Paulo = 03:00 UTC
      expect(statusMes(2026, 10, new Date('2026-11-25T02:59:59.999Z'), FERIADOS_NOV_2026)).toBe(
        StatusMes.ABERTO,
      );
      expect(statusMes(2026, 10, new Date('2026-11-25T03:00:00Z'), FERIADOS_NOV_2026)).toBe(
        StatusMes.FECHADO,
      );
      expect(statusMes(2026, 10, '2026-11-25T00:00:00-03:00', FERIADOS_NOV_2026)).toBe(
        StatusMes.FECHADO,
      );
      expect(
        statusMes(
          2026,
          10,
          DateTime.fromISO('2026-11-25T02:00', { zone: 'UTC' }),
          FERIADOS_NOV_2026,
        ),
      ).toBe(StatusMes.ABERTO);
    });

    it('o mês corrente é o de São Paulo, não o de UTC', () => {
      // 01/11/2026 01:00 UTC ainda é 31/10/2026 em São Paulo: novembro é futuro.
      expect(statusMes(2026, 11, new Date('2026-11-01T01:00:00Z'), [])).toBe(StatusMes.FUTURO);
    });

    it('validoAte e canceladaEm também aceitam texto e Date', () => {
      expect(
        status('2026-11-26T10:00', [
          {
            ano: 2026,
            mes: 10,
            validoAte: '2026-11-27T23:59:59-03:00',
            canceladaEm: new Date('2026-12-01T00:00:00Z'),
          },
        ]),
      ).toBe(StatusMes.REABERTO);
    });

    it('noFusoDasRegras converte para America/Sao_Paulo', () => {
      expect(noFusoDasRegras(new Date('2026-11-25T03:00:00Z')).toISO()).toBe(
        '2026-11-25T00:00:00.000-03:00',
      );
    });
  });
});

describe('entradas inválidas', () => {
  it.each([
    [() => diasUteis(2026, 13, []), 'Mês inválido: 13 (use 1 a 12)'],
    [() => diasUteis(2026, 0, []), 'Mês inválido: 0 (use 1 a 12)'],
    [() => diasUteis(2026, 1.5, []), 'Mês inválido: 1.5 (use 1 a 12)'],
    [() => dataFechamento(1899, 1, []), 'Ano inválido: 1899'],
    [() => dataFechamento(10000, 1, []), 'Ano inválido: 10000'],
    [() => statusMes(2026.5, 1, new Date(), []), 'Ano inválido: 2026.5'],
    [
      () => diasUteis(2026, 11, ['02/11/2026']),
      'Data de feriado inválida: "02/11/2026" (use AAAA-MM-DD)',
    ],
    [
      () => diasUteis(2026, 11, ['2026-02-30']),
      'Data de feriado inválida: "2026-02-30" (use AAAA-MM-DD)',
    ],
    [() => ehDiaUtil('2026-11-31', []), 'Data inválida: "2026-11-31" (use AAAA-MM-DD)'],
    [() => ehDiaUtil('2026-11-3', []), 'Data inválida: "2026-11-3" (use AAAA-MM-DD)'],
    [() => noFusoDasRegras('ontem'), 'Instante inválido: ontem'],
    [() => noFusoDasRegras(new Date('x')), 'Instante inválido: Invalid Date'],
    [() => noFusoDasRegras(DateTime.invalid('teste')), 'Instante inválido: Invalid DateTime'],
  ])('%#: lança RangeError', (chamar, mensagem) => {
    expect(chamar).toThrow(new RangeError(mensagem));
  });
});
