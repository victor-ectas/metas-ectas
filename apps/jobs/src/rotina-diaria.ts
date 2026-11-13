import { dataFechamento, noFusoDasRegras, ZONA_REGRAS } from '@metas/motor';
import type { Prisma } from '@metas/prisma';
import { DateTime } from 'luxon';
import type { Logger } from 'pino';

import type {
  MesFechado,
  Notificador,
  PendenciaGestor,
  ReaberturaVencida,
} from './notificacoes.js';

/**
 * Rotina diária do fechamento (P22, especificação 9.3, ADR-028).
 *
 * A trava dos meses não depende dela: a API calcula o status na hora, em toda leitura e gravação
 * (RN-35), e a reabertura deixa de valer sozinha na data-limite (RN-36). A rotina roda às 00h05 e
 * deixa registrado na auditoria, como ação do sistema (usuário vazio), o que aconteceu no dia
 * anterior:
 *
 * - cada mês que fechou, com as pendências de cada gestor naquele momento;
 * - cada reabertura que venceu sem ter sido cancelada antes;
 * - a própria execução do dia.
 *
 * Se o serviço ficou parado, ela recupera os dias perdidos desde a última execução registrada.
 * Cada dia roda numa transação; repetir um dia já registrado não faz nada.
 */

export const ENTIDADE_ROTINA = 'rotina_diaria';
export const ENTIDADE_FECHAMENTO = 'fechamento_mes';
export const ENTIDADE_REABERTURA = 'reabertura';
export const ACAO_EXECUTADA = 'EXECUTADA';
export const ACAO_MES_FECHADO = 'MES_FECHADO';
export const ACAO_REABERTURA_VENCIDA = 'VENCIDA';

/** Até quantos dias para trás a recuperação vai (dois meses cobrem qualquer fechamento). */
export const MAXIMO_DIAS_RECUPERADOS = 62;

type Transacao = Prisma.TransactionClient;

/** Acesso ao banco: cada dia numa transação (nos testes, dentro de uma transação desfeita). */
export interface BancoRotina {
  transacao<T>(fn: (tx: Transacao) => Promise<T>): Promise<T>;
}

export interface ResumoDia {
  /** Data de referência (America/Sao_Paulo), aaaa-mm-dd. */
  readonly dia: string;
  readonly mesesFechados: readonly MesFechado[];
  readonly reaberturasVencidas: readonly ReaberturaVencida[];
}

export interface ResultadoRotina {
  /** Dias processados agora, do mais antigo ao mais recente. */
  readonly dias: readonly ResumoDia[];
  /** Dias que ficaram de fora por passarem do limite de recuperação. */
  readonly diasNaoRecuperados: number;
}

export interface DependenciasRotina {
  readonly banco: BancoRotina;
  readonly agora: Date;
  readonly logger: Logger;
  readonly notificador: Notificador;
}

/** Processa os dias que faltam até ontem (America/Sao_Paulo). */
export async function executarRotinaDiaria(deps: DependenciasRotina): Promise<ResultadoRotina> {
  const ontem = noFusoDasRegras(deps.agora).startOf('day').minus({ days: 1 });
  const ultimo = await deps.banco.transacao((tx) => ultimoDiaRegistrado(tx, ontem.toISODate()));
  const { dias, foraDoLimite } = diasAProcessar(ultimo, ontem);
  if (foraDoLimite > 0) {
    deps.logger.warn(
      { diasNaoRecuperados: foraDoLimite, desde: ultimo },
      `Serviço parado por muito tempo: só os últimos ${String(MAXIMO_DIAS_RECUPERADOS)} dias foram recuperados`,
    );
  }

  const resumos: ResumoDia[] = [];
  for (const dia of dias) {
    const resumo = await deps.banco.transacao((tx) => processarDia(tx, dia, deps.agora));
    if (resumo === null) continue;
    resumos.push(resumo);
    deps.logger.info(
      {
        dia,
        mesesFechados: resumo.mesesFechados.map((m) => `${String(m.mes)}/${String(m.ano)}`),
        reaberturasVencidas: resumo.reaberturasVencidas.length,
      },
      'Rotina diária registrada',
    );
    // Avisos só depois do dia gravado: uma falha no aviso não desfaz o registro.
    for (const fechamento of resumo.mesesFechados) await deps.notificador.mesFechado(fechamento);
    for (const reabertura of resumo.reaberturasVencidas) {
      await deps.notificador.reaberturaVencida(reabertura);
    }
  }
  return { dias: resumos, diasNaoRecuperados: foraDoLimite };
}

/** Último dia já registrado até `ate` (inclusive), ou `null` na primeira execução. */
async function ultimoDiaRegistrado(tx: Transacao, ate: string | null): Promise<string | null> {
  const registro = await tx.auditoria.findFirst({
    where: {
      entidade: ENTIDADE_ROTINA,
      acao: ACAO_EXECUTADA,
      ...(ate === null ? {} : { entidadeId: { lte: ate } }),
    },
    orderBy: { entidadeId: 'desc' },
    select: { entidadeId: true },
  });
  return registro?.entidadeId ?? null;
}

/**
 * Dias de `ultimo + 1` até `ontem`. Na primeira execução, só ontem: a rotina não reconstrói o
 * passado de antes de existir.
 */
export function diasAProcessar(
  ultimo: string | null,
  ontem: DateTime,
): { dias: string[]; foraDoLimite: number } {
  const fim = ontem.toISODate() ?? '';
  if (ultimo === null) return { dias: [fim], foraDoLimite: 0 };
  const dias: string[] = [];
  let dia = DateTime.fromISO(ultimo, { zone: ZONA_REGRAS }).plus({ days: 1 });
  while (dia <= ontem) {
    dias.push(dia.toISODate() ?? '');
    dia = dia.plus({ days: 1 });
  }
  const foraDoLimite = Math.max(0, dias.length - MAXIMO_DIAS_RECUPERADOS);
  return { dias: dias.slice(foraDoLimite), foraDoLimite };
}

async function processarDia(tx: Transacao, dia: string, agora: Date): Promise<ResumoDia | null> {
  // Uma execução por vez, mesmo com dois serviços no ar por engano; libera no fim da transação.
  await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('metas:rotina-diaria'))`;
  const jaFeito = await tx.auditoria.findFirst({
    where: { entidade: ENTIDADE_ROTINA, acao: ACAO_EXECUTADA, entidadeId: dia },
    select: { id: true },
  });
  if (jaFeito !== null) return null;

  const mesesFechados = await registrarMesesFechados(tx, dia);
  const reaberturasVencidas = await registrarReaberturasVencidas(tx, dia);
  await tx.auditoria.create({
    data: {
      entidade: ENTIDADE_ROTINA,
      entidadeId: dia,
      acao: ACAO_EXECUTADA,
      depois: {
        executadaEm: agora.toISOString(),
        mesesFechados: mesesFechados.map((m) => ({ cicloId: m.cicloId, ano: m.ano, mes: m.mes })),
        reaberturasVencidas: reaberturasVencidas.map((r) => r.reaberturaId),
      },
    },
  });
  return { dia, mesesFechados, reaberturasVencidas };
}

/** Meses cujo prazo (RN-34) terminou no dia, nos ciclos ativos ou encerrados. */
async function registrarMesesFechados(tx: Transacao, dia: string): Promise<MesFechado[]> {
  const ano = Number(dia.slice(0, 4));
  // Dezembro de um ano fecha em janeiro do seguinte.
  const ciclos = await tx.ciclo.findMany({
    where: { ano: { in: [ano - 1, ano] }, status: { in: ['ATIVO', 'ENCERRADO'] } },
    select: { id: true, ano: true },
    orderBy: { ano: 'asc' },
  });
  if (ciclos.length === 0) return [];
  const feriados = (await tx.feriado.findMany({ select: { data: true } })).map((f) =>
    f.data.toISOString().slice(0, 10),
  );

  const registrados: MesFechado[] = [];
  for (const ciclo of ciclos) {
    for (let mes = 1; mes <= 12; mes++) {
      const prazo = dataFechamento(ciclo.ano, mes, feriados);
      if (prazo.toISODate() !== dia) continue;
      const fechamento = {
        cicloId: ciclo.id,
        ano: ciclo.ano,
        mes,
        fechouEm: prazo.toUTC().toISO() ?? '',
        ...(await pendenciasDoMes(tx, ciclo.id, mes)),
      };
      await tx.auditoria.create({
        data: {
          entidade: ENTIDADE_FECHAMENTO,
          entidadeId: `${ciclo.id}:${String(mes)}`,
          acao: ACAO_MES_FECHADO,
          // Cópias em objetos simples: o tipo JSON do Prisma não aceita interfaces.
          depois: { ...fechamento, pendencias: fechamento.pendencias.map((p) => ({ ...p })) },
        },
      });
      registrados.push(fechamento);
    }
  }
  return registrados;
}

/**
 * Variáveis ativas do ciclo vazias no mês, por quem responde pelo lançamento (RN-07): no
 * Corporativo, o responsável da variável; nos outros setores, o responsável do setor no ciclo.
 * Mesma regra das pendências do Início (P20).
 */
async function pendenciasDoMes(
  tx: Transacao,
  cicloId: string,
  mes: number,
): Promise<{ pendencias: PendenciaGestor[]; semResponsavel: number }> {
  const [variaveis, responsaveis, lancados] = await Promise.all([
    tx.variavel.findMany({
      where: { cicloId, ativo: true },
      select: {
        id: true,
        setorId: true,
        responsavelId: true,
        setor: { select: { corporativo: true } },
      },
    }),
    tx.setorResponsavel.findMany({
      where: { cicloId },
      select: { setorId: true, usuarioId: true },
    }),
    tx.lancamento.findMany({
      where: { mes, valor: { not: null }, variavel: { cicloId, ativo: true } },
      select: { variavelId: true },
    }),
  ]);
  const doSetor = new Map(responsaveis.map((r) => [r.setorId, r.usuarioId]));
  const comValor = new Set(lancados.map((l) => l.variavelId));

  const contagem = new Map<string, { pendentes: number; total: number }>();
  let semResponsavel = 0;
  for (const v of variaveis) {
    const responsavel = v.setor.corporativo ? v.responsavelId : (doSetor.get(v.setorId) ?? null);
    const vazia = !comValor.has(v.id);
    if (responsavel === null) {
      if (vazia) semResponsavel++;
      continue;
    }
    const atual = contagem.get(responsavel) ?? { pendentes: 0, total: 0 };
    contagem.set(responsavel, {
      pendentes: atual.pendentes + (vazia ? 1 : 0),
      total: atual.total + 1,
    });
  }

  const usuarios = await tx.usuario.findMany({
    where: { id: { in: [...contagem.keys()] } },
    select: { id: true, nome: true },
  });
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  const pendencias = [...contagem.entries()]
    .map(([usuarioId, c]) => ({ usuarioId, nome: nomes.get(usuarioId) ?? '', ...c }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { pendencias, semResponsavel };
}

/**
 * Reabertas cuja data-limite caiu no dia. Uma cancelada antes da data-limite não "vence" (o
 * Administrador encerrou antes, P23); uma cancelada depois já tinha vencido.
 */
async function registrarReaberturasVencidas(
  tx: Transacao,
  dia: string,
): Promise<ReaberturaVencida[]> {
  const inicio = DateTime.fromISO(dia, { zone: ZONA_REGRAS }).startOf('day');
  const candidatas = await tx.reabertura.findMany({
    where: { validoAte: { gte: inicio.toJSDate(), lt: inicio.plus({ days: 1 }).toJSDate() } },
    select: {
      id: true,
      cicloId: true,
      mes: true,
      escopo: true,
      escopoId: true,
      validoAte: true,
      canceladaEm: true,
      ciclo: { select: { ano: true } },
    },
    orderBy: { validoAte: 'asc' },
  });

  const vencidas: ReaberturaVencida[] = [];
  for (const r of candidatas) {
    if (r.canceladaEm !== null && r.canceladaEm < r.validoAte) continue;
    const vencida: ReaberturaVencida = {
      reaberturaId: r.id,
      cicloId: r.cicloId,
      ano: r.ciclo.ano,
      mes: r.mes,
      escopo: r.escopo,
      escopoId: r.escopoId,
      validoAte: r.validoAte.toISOString(),
    };
    await tx.auditoria.create({
      data: {
        entidade: ENTIDADE_REABERTURA,
        entidadeId: r.id,
        acao: ACAO_REABERTURA_VENCIDA,
        depois: { ...vencida },
      },
    });
    vencidas.push(vencida);
  }
  return vencidas;
}
