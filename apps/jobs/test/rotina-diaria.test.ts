import { criarPrismaClient, type Prisma, type PrismaClient } from '@metas/prisma';
import { DateTime } from 'luxon';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { MesFechado, Notificador, ReaberturaVencida } from '../src/notificacoes.js';
import {
  ACAO_EXECUTADA,
  ACAO_MES_FECHADO,
  ACAO_REABERTURA_VENCIDA,
  diasAProcessar,
  ENTIDADE_FECHAMENTO,
  ENTIDADE_REABERTURA,
  ENTIDADE_ROTINA,
  executarRotinaDiaria,
  MAXIMO_DIAS_RECUPERADOS,
} from '../src/rotina-diaria.js';
import { urlBancoTesteComoApp } from './ambiente.js';

type Transacao = Prisma.TransactionClient;

/** Conecta como metas_app, o usuário do serviço em produção. */
let prisma: PrismaClient;
beforeAll(() => {
  prisma = criarPrismaClient(urlBancoTesteComoApp());
});
afterAll(async () => {
  await prisma.$disconnect();
});

class Desfazer extends Error {}

/** Roda o teste numa transação desfeita no fim: nada fica no banco de testes. */
async function noBancoDesfeito(teste: (tx: Transacao) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await teste(tx);
        throw new Desfazer();
      },
      { timeout: 30_000 },
    );
  } catch (erro) {
    if (!(erro instanceof Desfazer)) throw erro;
  }
}

/** Relógio simulado: instante em America/Sao_Paulo. */
const em = (iso: string) => DateTime.fromISO(iso, { zone: 'America/Sao_Paulo' }).toJSDate();

class NotificadorDeTeste implements Notificador {
  readonly meses: MesFechado[] = [];
  readonly reaberturas: ReaberturaVencida[] = [];
  mesFechado(f: MesFechado): Promise<void> {
    this.meses.push(f);
    return Promise.resolve();
  }
  reaberturaVencida(r: ReaberturaVencida): Promise<void> {
    this.reaberturas.push(r);
    return Promise.resolve();
  }
}

function rodar(tx: Transacao, agora: Date, notificador = new NotificadorDeTeste()) {
  return executarRotinaDiaria({
    banco: { transacao: (fn) => fn(tx) },
    agora,
    logger: pino({ level: 'silent' }),
    notificador,
  });
}

async function registros(tx: Transacao, entidade: string) {
  return tx.auditoria.findMany({
    where: { entidade },
    orderBy: [{ entidadeId: 'asc' }],
    select: { entidadeId: true, acao: true, depois: true, usuarioId: true },
  });
}

interface Cenario {
  readonly cicloId: string;
  readonly ana: string;
  readonly bruno: string;
}

/**
 * Ciclo 2026 ativo com os feriados do CT-18 (02/11 e 20/11) e 01/01/2027:
 * - Ana responde pelo setor Fiscal (2 variáveis; em outubro só uma lançada);
 * - Bruno responde por uma variável do Corporativo (vazia em outubro);
 * - um setor sem responsável no ciclo, com 1 variável vazia;
 * - uma variável inativa da Ana, que não conta.
 */
async function montarCenario(tx: Transacao): Promise<Cenario> {
  const ana = await tx.usuario.create({
    data: { email: 'ana@jobs.teste', nome: 'Ana Fiscal', perfil: 'GESTOR', ativo: true },
  });
  const bruno = await tx.usuario.create({
    data: { email: 'bruno@jobs.teste', nome: 'Bruno Corporativo', perfil: 'GESTOR', ativo: true },
  });
  const corporativo =
    (await tx.setor.findFirst({ where: { corporativo: true } })) ??
    (await tx.setor.create({
      data: { codigo: 'JOBS_CORP', nome: 'Corporativo (jobs)', corporativo: true },
    }));
  const fiscal = await tx.setor.create({ data: { codigo: 'JOBS_FISCAL', nome: 'Fiscal (jobs)' } });
  const vago = await tx.setor.create({ data: { codigo: 'JOBS_VAGO', nome: 'Sem responsável' } });
  await tx.feriado.createMany({
    data: ['2026-11-02', '2026-11-20', '2027-01-01'].map((d) => ({
      data: new Date(d),
      descricao: 'Feriado de teste',
      tipo: 'NACIONAL' as const,
    })),
  });
  const ciclo = await tx.ciclo.create({ data: { ano: 2026, status: 'ATIVO' } });
  await tx.setorResponsavel.create({
    data: { cicloId: ciclo.id, setorId: fiscal.id, usuarioId: ana.id },
  });

  const variavel = (setorId: string, codigo: string, extra: object = {}) =>
    tx.variavel.create({
      data: {
        cicloId: ciclo.id,
        setorId,
        codigo,
        nome: codigo,
        tipo: 'NUMERO',
        acumulacao: 'SOMA',
        ...extra,
      },
    });
  const lancada = await variavel(fiscal.id, 'REQ_ATENDIDOS');
  await variavel(fiscal.id, 'TOTAL_REQ');
  await variavel(fiscal.id, 'ANTIGA', { ativo: false });
  await variavel(corporativo.id, 'JOBS_EBITDA', { responsavelId: bruno.id });
  await variavel(vago.id, 'SEM_DONO');
  await tx.lancamento.create({
    data: { variavelId: lancada.id, mes: 10, valor: '16', origem: 'DIGITACAO' },
  });
  return { cicloId: ciclo.id, ana: ana.id, bruno: bruno.id };
}

describe('rotina diária do fechamento', () => {
  it('CT-18: outubro/2026 fecha em 24/11 e a rotina de 25/11 00h05 registra as pendências', async () => {
    await noBancoDesfeito(async (tx) => {
      const c = await montarCenario(tx);
      const notificador = new NotificadorDeTeste();

      const resultado = await rodar(tx, em('2026-11-25T00:05'), notificador);

      expect(resultado.dias.map((d) => d.dia)).toEqual(['2026-11-24']);
      const fechamentos = await registros(tx, ENTIDADE_FECHAMENTO);
      expect(fechamentos).toHaveLength(1);
      expect(fechamentos[0]).toMatchObject({
        entidadeId: `${c.cicloId}:10`,
        acao: ACAO_MES_FECHADO,
        usuarioId: null,
        depois: {
          ano: 2026,
          mes: 10,
          fechouEm: '2026-11-25T02:59:59.999Z',
          pendencias: [
            { usuarioId: c.ana, nome: 'Ana Fiscal', pendentes: 1, total: 2 },
            { usuarioId: c.bruno, nome: 'Bruno Corporativo', pendentes: 1, total: 1 },
          ],
          semResponsavel: 1,
        },
      });
      expect(await registros(tx, ENTIDADE_ROTINA)).toMatchObject([
        { entidadeId: '2026-11-24', acao: ACAO_EXECUTADA, usuarioId: null },
      ]);
      expect(notificador.meses.map((m) => m.mes)).toEqual([10]);
    });
  });

  it('na véspera do fechamento (24/11 às 23h59) ainda não há mês fechado', async () => {
    await noBancoDesfeito(async (tx) => {
      await montarCenario(tx);
      const resultado = await rodar(tx, em('2026-11-24T23:59'));
      expect(resultado.dias).toEqual([
        { dia: '2026-11-23', mesesFechados: [], reaberturasVencidas: [] },
      ]);
      expect(await registros(tx, ENTIDADE_FECHAMENTO)).toEqual([]);
    });
  });

  it('dezembro/2026 fecha em 22/01/2027 (com o feriado de 01/01)', async () => {
    await noBancoDesfeito(async (tx) => {
      const c = await montarCenario(tx);
      await rodar(tx, em('2027-01-23T00:05'));
      expect((await registros(tx, ENTIDADE_FECHAMENTO)).map((r) => r.entidadeId)).toEqual([
        `${c.cicloId}:12`,
      ]);
    });
  });

  it('recupera os dias em que o serviço ficou parado, sem repetir os já registrados', async () => {
    await noBancoDesfeito(async (tx) => {
      const c = await montarCenario(tx);
      await tx.auditoria.create({
        data: { entidade: ENTIDADE_ROTINA, entidadeId: '2026-11-21', acao: ACAO_EXECUTADA },
      });

      const resultado = await rodar(tx, em('2026-11-26T09:00'));

      expect(resultado.dias.map((d) => d.dia)).toEqual([
        '2026-11-22',
        '2026-11-23',
        '2026-11-24',
        '2026-11-25',
      ]);
      expect((await registros(tx, ENTIDADE_FECHAMENTO)).map((r) => r.entidadeId)).toEqual([
        `${c.cicloId}:10`,
      ]);
      expect(await registros(tx, ENTIDADE_ROTINA)).toHaveLength(5);
    });
  });

  it('rodar de novo no mesmo dia não duplica nada', async () => {
    await noBancoDesfeito(async (tx) => {
      await montarCenario(tx);
      await rodar(tx, em('2026-11-25T00:05'));
      const segunda = await rodar(tx, em('2026-11-25T08:00'));
      expect(segunda.dias).toEqual([]);
      expect(await registros(tx, ENTIDADE_FECHAMENTO)).toHaveLength(1);
      expect(await registros(tx, ENTIDADE_ROTINA)).toHaveLength(1);
    });
  });

  it('registra a reabertura que venceu e ignora a cancelada antes do prazo', async () => {
    await noBancoDesfeito(async (tx) => {
      const c = await montarCenario(tx);
      const comum = {
        cicloId: c.cicloId,
        mes: 10,
        escopo: 'TODOS' as const,
        motivo: 'Teste',
        autorizadoPor: 'Gerente Geral',
        validoAte: em('2026-11-27T23:59:59.999'),
      };
      const vencida = await tx.reabertura.create({ data: comum });
      await tx.reabertura.create({ data: { ...comum, canceladaEm: em('2026-11-26T10:00') } });
      await tx.reabertura.create({
        data: { ...comum, validoAte: em('2026-11-30T23:59:59.999') },
      });
      await tx.auditoria.create({
        data: { entidade: ENTIDADE_ROTINA, entidadeId: '2026-11-26', acao: ACAO_EXECUTADA },
      });
      const notificador = new NotificadorDeTeste();

      await rodar(tx, em('2026-11-28T00:05'), notificador);

      expect(await registros(tx, ENTIDADE_REABERTURA)).toMatchObject([
        {
          entidadeId: vencida.id,
          acao: ACAO_REABERTURA_VENCIDA,
          usuarioId: null,
          depois: { ano: 2026, mes: 10, escopo: 'TODOS', escopoId: null },
        },
      ]);
      expect(notificador.reaberturas.map((r) => r.reaberturaId)).toEqual([vencida.id]);
    });
  });

  it('ciclo em rascunho não tem fechamento registrado', async () => {
    await noBancoDesfeito(async (tx) => {
      const c = await montarCenario(tx);
      await tx.ciclo.update({ where: { id: c.cicloId }, data: { status: 'RASCUNHO' } });
      await rodar(tx, em('2026-11-25T00:05'));
      expect(await registros(tx, ENTIDADE_FECHAMENTO)).toEqual([]);
      expect(await registros(tx, ENTIDADE_ROTINA)).toHaveLength(1);
    });
  });
});

describe('dias a processar', () => {
  const ontem = DateTime.fromISO('2026-11-24', { zone: 'America/Sao_Paulo' });

  it('na primeira execução, só ontem', () => {
    expect(diasAProcessar(null, ontem)).toEqual({ dias: ['2026-11-24'], foraDoLimite: 0 });
  });

  it('nada a fazer quando ontem já foi registrado', () => {
    expect(diasAProcessar('2026-11-24', ontem)).toEqual({ dias: [], foraDoLimite: 0 });
  });

  it('atravessa a virada do ano', () => {
    const virada = DateTime.fromISO('2027-01-02', { zone: 'America/Sao_Paulo' });
    expect(diasAProcessar('2026-12-30', virada).dias).toEqual([
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it(`recupera no máximo ${String(MAXIMO_DIAS_RECUPERADOS)} dias`, () => {
    const { dias, foraDoLimite } = diasAProcessar('2026-01-01', ontem);
    expect(dias).toHaveLength(MAXIMO_DIAS_RECUPERADOS);
    expect(dias.at(-1)).toBe('2026-11-24');
    expect(foraDoLimite).toBe(327 - MAXIMO_DIAS_RECUPERADOS);
  });
});
