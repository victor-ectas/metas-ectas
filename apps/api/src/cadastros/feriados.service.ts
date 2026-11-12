import { Injectable } from '@nestjs/common';
import { dataFechamento } from '@metas/motor';
import { CodigoErro, type Feriado, type FeriadoEntradaSchema } from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaService } from '../auditoria/auditoria.service.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DadosFeriado = z.output<typeof FeriadoEntradaSchema>;

const ENTIDADE = 'feriado';
const SELECAO = { id: true, data: true, descricao: true, tipo: true } as const;

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

/** `@db.Date` chega como meia-noite UTC: a data é a parte "aaaa-mm-dd". */
const paraTexto = (data: Date): string => data.toISOString().slice(0, 10);
const paraDate = (data: string): Date => new Date(`${data}T00:00:00Z`);

function paraFeriado(f: {
  id: string;
  data: Date;
  descricao: string;
  tipo: Feriado['tipo'];
}): Feriado {
  return { ...f, data: paraTexto(f.data) };
}

/** Primeiro e último dia de um mês, como `Date` UTC (para consultar `@db.Date`). */
function limitesDoMes(ano: number, mes: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) };
}

/**
 * Calendário de feriados (RF-06, RN-33), mantido pelo Administrador.
 *
 * Trava (decisão do desenvolvedor, 12/11/2026): um feriado no mês X conta dias úteis do prazo de
 * fechamento do mês X−1 (RN-34). Incluir, alterar ou excluir um feriado que mude o prazo de um
 * mês já fechado é recusado: reabriria ou fecharia o mês sem querer. Para corrigir o passado
 * existe a reabertura (P23).
 */
@Injectable()
export class FeriadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Instante atual; separado para os testes. */
  protected agora(): Date {
    return new Date();
  }

  async listar(ano: number): Promise<Feriado[]> {
    const feriados = await this.prisma.feriado.findMany({
      where: {
        data: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) },
      },
      select: SELECAO,
      orderBy: { data: 'asc' },
    });
    return feriados.map(paraFeriado);
  }

  async criar(dados: DadosFeriado, autor: Autor): Promise<Feriado> {
    await this.validarPrazos(null, dados.data);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.feriado.create({
          data: {
            ...dados,
            data: paraDate(dados.data),
            criadoPor: autor.usuarioId,
            atualizadoPor: autor.usuarioId,
          },
          select: SELECAO,
        });
        const feriado = paraFeriado(criado);
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: feriado.id,
          acao: 'CRIAR',
          depois: { data: feriado.data, descricao: feriado.descricao, tipo: feriado.tipo },
        });
        return feriado;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, 'Feriado em uso.');
    }
  }

  async alterar(id: string, dados: DadosFeriado, autor: Autor): Promise<Feriado> {
    const antes = await this.obter(id);
    if (antes.data !== dados.data) await this.validarPrazos(antes.data, dados.data);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const depois = paraFeriado(
          await tx.feriado.update({
            where: { id },
            data: { ...dados, data: paraDate(dados.data), atualizadoPor: autor.usuarioId },
            select: SELECAO,
          }),
        );
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: id,
          acao: 'ALTERAR',
          antes: { data: antes.data, descricao: antes.descricao, tipo: antes.tipo },
          depois: { data: depois.data, descricao: depois.descricao, tipo: depois.tipo },
        });
        return depois;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, 'Feriado em uso.');
    }
  }

  async excluir(id: string, autor: Autor): Promise<void> {
    const antes = await this.obter(id);
    await this.validarPrazos(antes.data, null);
    await this.prisma.$transaction(async (tx) => {
      await tx.feriado.delete({ where: { id } });
      await this.auditoria.registrar(tx, autor, {
        entidade: ENTIDADE,
        entidadeId: id,
        acao: 'EXCLUIR',
        antes: { data: antes.data, descricao: antes.descricao, tipo: antes.tipo },
      });
    });
  }

  private async obter(id: string): Promise<Feriado> {
    const feriado = await this.prisma.feriado.findUnique({ where: { id }, select: SELECAO });
    if (feriado === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Feriado não encontrado.');
    return paraFeriado(feriado);
  }

  /**
   * Recusa a troca do feriado `sai` pelo `entra` (qualquer um pode ser nulo) se ela mudar o prazo
   * de fechamento de um mês cujo prazo, antes ou depois, já passou.
   */
  private async validarPrazos(sai: string | null, entra: string | null): Promise<void> {
    const meses = new Set(
      [sai, entra].flatMap((data) => (data === null ? [] : [data.slice(0, 7)])),
    );
    const agora = this.agora().getTime();
    for (const anoMes of meses) {
      const [ano, mes] = anoMes.split('-').map(Number) as [number, number];
      const atuais = (
        await this.prisma.feriado.findMany({
          where: { data: limitesDoMes(ano, mes) },
          select: { data: true },
        })
      ).map((f) => paraTexto(f.data));
      const novos = new Set(atuais);
      if (sai !== null) novos.delete(sai);
      if (entra?.startsWith(anoMes) === true) novos.add(entra);

      // O feriado no mês X mexe no prazo do mês anterior (o 15º dia útil cai em X).
      const anoAnterior = mes === 1 ? ano - 1 : ano;
      const mesAnterior = mes === 1 ? 12 : mes - 1;
      const prazoAntes = dataFechamento(anoAnterior, mesAnterior, atuais);
      const prazoDepois = dataFechamento(anoAnterior, mesAnterior, novos);
      if (prazoAntes.equals(prazoDepois)) continue;

      const primeiro = Math.min(prazoAntes.toMillis(), prazoDepois.toMillis());
      if (primeiro < agora) {
        const nome = `${MESES[mesAnterior - 1] ?? ''}/${String(anoAnterior)}`;
        throw new ErroApi(
          CodigoErro.MES_FECHADO,
          `Esta alteração mudaria o prazo de fechamento de ${nome}, que fechou em ${prazoAntes.toFormat('dd/MM/yyyy')}. Para corrigir um mês já fechado, use a reabertura.`,
          { mes: mesAnterior, ano: anoAnterior },
        );
      }
    }
  }
}
