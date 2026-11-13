import { StatusMes } from '@metas/tipos';
import { DateTime } from 'luxon';

/** Fuso das regras de fechamento (CLAUDE.md 5.4). */
export const ZONA_REGRAS = 'America/Sao_Paulo';

/** O mês M fecha no 15º dia útil de M+1 (RN-34). */
export const DIA_UTIL_DO_FECHAMENTO = 15;

/** Instante aceito pelo calendário: `Date`, `DateTime` do Luxon ou texto ISO 8601 com fuso. */
export type Instante = Date | DateTime | string;

/** Reabertura já filtrada pelo escopo (todos, setor ou gestor) do lançamento em questão. */
export interface ReaberturaCalendario {
  ano: number;
  mes: number;
  /** Data-limite: a reabertura vale até este instante, inclusive (RN-36). */
  validoAte: Instante;
  /** Cancelada pelo Administrador antes do prazo: deixa de valer a partir deste instante. */
  canceladaEm?: Instante | null;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Datas de feriados (`AAAA-MM-DD`), como vêm da tabela `feriado`. Lança `RangeError` para data
 * inválida, para um feriado mal cadastrado não passar despercebido.
 */
function conjuntoDeFeriados(feriados: Iterable<string>): ReadonlySet<string> {
  const conjunto = new Set<string>();
  for (const feriado of feriados) {
    if (!DATA_ISO.test(feriado) || !DateTime.fromISO(feriado, { zone: ZONA_REGRAS }).isValid) {
      throw new RangeError(`Data de feriado inválida: "${feriado}" (use AAAA-MM-DD)`);
    }
    conjunto.add(feriado);
  }
  return conjunto;
}

function validarMes(ano: number, mes: number): void {
  if (!Number.isInteger(ano) || ano < 1900 || ano > 9999) {
    throw new RangeError(`Ano inválido: ${String(ano)}`);
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new RangeError(`Mês inválido: ${String(mes)} (use 1 a 12)`);
  }
}

/** Converte o instante para o fuso das regras. Lança `RangeError` se for inválido. */
export function noFusoDasRegras(instante: Instante): DateTime {
  const data =
    typeof instante === 'string'
      ? DateTime.fromISO(instante, { setZone: true })
      : instante instanceof Date
        ? DateTime.fromJSDate(instante)
        : instante;
  if (!data.isValid) throw new RangeError(`Instante inválido: ${String(instante)}`);
  return data.setZone(ZONA_REGRAS);
}

/** Dia útil = segunda a sexta, exceto feriados do calendário da empresa (RN-33). */
export function ehDiaUtil(data: string, feriados: Iterable<string>): boolean {
  const dia = DateTime.fromISO(data, { zone: ZONA_REGRAS });
  if (!DATA_ISO.test(data) || !dia.isValid) {
    throw new RangeError(`Data inválida: "${data}" (use AAAA-MM-DD)`);
  }
  return dia.weekday <= 5 && !conjuntoDeFeriados(feriados).has(data);
}

/** Dias úteis do mês, em ordem, como `AAAA-MM-DD` (RN-33). */
export function diasUteis(ano: number, mes: number, feriados: Iterable<string>): string[] {
  validarMes(ano, mes);
  const conjunto = conjuntoDeFeriados(feriados);
  const dias: string[] = [];
  let dia = DateTime.fromObject({ year: ano, month: mes, day: 1 }, { zone: ZONA_REGRAS });
  while (dia.month === mes) {
    const iso = dia.toISODate() as string;
    if (dia.weekday <= 5 && !conjunto.has(iso)) dias.push(iso);
    dia = dia.plus({ days: 1 });
  }
  return dias;
}

/**
 * Dias úteis de hoje (no fuso das regras) até o dia do prazo, contando os dois, para o aviso
 * "fecha em 24/11, faltam 9 dias úteis" (especificação 9.2). Prazo já passado → 0.
 * Ex.: em 11/11/2026, com o prazo em 24/11/2026 e feriado em 20/11 → 9.
 */
export function diasUteisRestantes(
  agora: Instante,
  prazo: Instante,
  feriados: Iterable<string>,
): number {
  const conjunto = conjuntoDeFeriados(feriados);
  const fim = noFusoDasRegras(prazo).startOf('day');
  let dia = noFusoDasRegras(agora).startOf('day');
  let total = 0;
  while (dia <= fim) {
    if (dia.weekday <= 5 && !conjunto.has(dia.toISODate() as string)) total++;
    dia = dia.plus({ days: 1 });
  }
  return total;
}

/**
 * Fim da janela de lançamento do mês M: 23:59:59.999 (America/Sao_Paulo) do 15º dia útil de
 * M+1, contando a partir do 1º dia útil de M+1, inclusive (RN-34). Ex.: outubro/2026, com
 * feriados em 02/11 e 20/11 → 24/11/2026 23:59:59.999.
 */
export function dataFechamento(ano: number, mes: number, feriados: Iterable<string>): DateTime {
  validarMes(ano, mes);
  const seguinte = DateTime.fromObject(
    { year: ano, month: mes, day: 1 },
    { zone: ZONA_REGRAS },
  ).plus({
    months: 1,
  });
  const uteis = diasUteis(seguinte.year, seguinte.month, feriados);
  const dia = uteis[DIA_UTIL_DO_FECHAMENTO - 1];
  if (dia === undefined) {
    throw new RangeError(
      `${seguinte.toFormat('MM/yyyy')} tem só ${String(uteis.length)} dias úteis; o fechamento precisa do 15º`,
    );
  }
  return DateTime.fromISO(dia, { zone: ZONA_REGRAS }).endOf('day');
}

/**
 * Status do mês para lançamento (RN-34 a RN-36):
 *
 * - `FUTURO`: mês depois do mês corrente; não aceita lançamento.
 * - `ABERTO`: do dia 1 do mês até o fim do 15º dia útil do mês seguinte.
 * - `REABERTO`: depois do fechamento, com reabertura vigente (não cancelada e dentro do prazo).
 * - `FECHADO`: nos demais casos.
 *
 * `reaberturas` devem vir já filtradas pelo escopo do lançamento; as de outros meses são
 * ignoradas.
 */
export function statusMes(
  ano: number,
  mes: number,
  agora: Instante,
  feriados: Iterable<string>,
  reaberturas: readonly ReaberturaCalendario[] = [],
): StatusMes {
  validarMes(ano, mes);
  const instante = noFusoDasRegras(agora);
  if (ano * 12 + mes > instante.year * 12 + instante.month) return StatusMes.FUTURO;
  const agoraMs = instante.toMillis();
  if (agoraMs <= dataFechamento(ano, mes, feriados).toMillis()) return StatusMes.ABERTO;

  const reaberto = reaberturas.some(
    (r) =>
      r.ano === ano &&
      r.mes === mes &&
      agoraMs <= noFusoDasRegras(r.validoAte).toMillis() &&
      (r.canceladaEm === undefined ||
        r.canceladaEm === null ||
        agoraMs < noFusoDasRegras(r.canceladaEm).toMillis()),
  );
  return reaberto ? StatusMes.REABERTO : StatusMes.FECHADO;
}
