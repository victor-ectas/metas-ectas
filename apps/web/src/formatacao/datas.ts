import { VAZIO } from './numeros';

/**
 * Datas em pt-BR, no fuso das regras de fechamento (CLAUDE.md 5.4 e RNF-12): o prazo
 * "24/11/2026 23:59" é o mesmo para quem abre o sistema em qualquer fuso.
 */
const FUSO = 'America/Sao_Paulo';

const DATA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Data sem hora ("2026-11-02", como os feriados): não passa por fuso, senão viraria 01/11. */
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DataExibivel = Date | string | null | undefined;

function paraDate(valor: Date | string): Date | null {
  const data = typeof valor === 'string' ? new Date(valor) : valor;
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "dd/mm/aaaa". Aceita `Date`, ISO com hora (convertido para São Paulo) ou "aaaa-mm-dd". */
export function formatarData(valor: DataExibivel): string {
  if (valor === null || valor === undefined) return VAZIO;
  if (typeof valor === 'string') {
    const soData = SO_DATA.exec(valor);
    if (soData !== null) return `${soData[3] ?? ''}/${soData[2] ?? ''}/${soData[1] ?? ''}`;
  }
  const data = paraDate(valor);
  return data === null ? VAZIO : DATA.format(data);
}

/** "dd/mm/aaaa hh:mm" no horário de São Paulo. */
export function formatarDataHora(valor: DataExibivel): string {
  if (valor === null || valor === undefined) return VAZIO;
  const data = paraDate(valor);
  return data === null ? VAZIO : DATA_HORA.format(data).replace(',', '');
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** Nome do mês de 1 a 12 com o ano, como nas mensagens da API: "Outubro/2026". */
export function nomeMes(mes: number, ano?: number): string {
  const nome = MESES[mes - 1];
  if (nome === undefined) throw new RangeError(`Mês inválido: ${String(mes)}.`);
  return ano === undefined ? nome : `${nome}/${String(ano)}`;
}
