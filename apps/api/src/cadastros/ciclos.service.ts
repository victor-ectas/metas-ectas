import { Injectable } from '@nestjs/common';
import {
  type Ciclo,
  CodigoErro,
  Perfil,
  type ResponsaveisEntradaSchema,
  type ResponsavelSetor,
  StatusCiclo,
} from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaService } from '../auditoria/auditoria.service.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DadosResponsaveis = z.output<typeof ResponsaveisEntradaSchema>;

const SELECAO = { id: true, ano: true, status: true, encerradoEm: true } as const;
const SETOR = { id: true, codigo: true, nome: true, corporativo: true, ativo: true } as const;

function paraCiclo(c: {
  id: string;
  ano: number;
  status: Ciclo['status'];
  encerradoEm: Date | null;
}): Ciclo {
  return { ...c, encerradoEm: c.encerradoEm?.toISOString() ?? null };
}

/**
 * Ciclos (RF-07) e responsáveis por setor em cada ciclo (RF-05). Ativar e encerrar ficam no
 * ConsistenciaService (P15). Responsável só Gestor ativo (decisão do desenvolvedor, 12/11/2026).
 */
@Injectable()
export class CiclosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<Ciclo[]> {
    const ciclos = await this.prisma.ciclo.findMany({ select: SELECAO, orderBy: { ano: 'desc' } });
    return ciclos.map(paraCiclo);
  }

  /** Novo ciclo sempre nasce em Rascunho. */
  async criar(ano: number, autor: Autor): Promise<Ciclo> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.ciclo.create({
          data: { ano, criadoPor: autor.usuarioId, atualizadoPor: autor.usuarioId },
          select: SELECAO,
        });
        await this.auditoria.registrar(tx, autor, {
          entidade: 'ciclo',
          entidadeId: criado.id,
          acao: 'CRIAR',
          depois: { ano: criado.ano, status: criado.status },
        });
        return paraCiclo(criado);
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, 'Ciclo em uso.');
    }
  }

  /** Setores ativos (e inativos que ainda têm responsável) com o responsável no ciclo. */
  async listarResponsaveis(cicloId: string): Promise<ResponsavelSetor[]> {
    await this.obterCiclo(cicloId);
    const setores = await this.prisma.setor.findMany({
      where: { OR: [{ ativo: true }, { responsaveis: { some: { cicloId } } }] },
      select: {
        ...SETOR,
        responsaveis: {
          where: { cicloId },
          select: { usuarioId: true, usuario: { select: { nome: true } } },
        },
      },
      orderBy: [{ corporativo: 'desc' }, { nome: 'asc' }],
    });
    return setores.map(({ responsaveis, ...setor }) => ({
      setor,
      usuarioId: responsaveis[0]?.usuarioId ?? null,
      usuarioNome: responsaveis[0]?.usuario.nome ?? null,
    }));
  }

  /** Define os responsáveis dos setores enviados; `null` tira o responsável. */
  async definirResponsaveis(
    cicloId: string,
    dados: DadosResponsaveis,
    autor: Autor,
  ): Promise<ResponsavelSetor[]> {
    const ciclo = await this.obterCiclo(cicloId);
    if (ciclo.status === StatusCiclo.ENCERRADO) {
      throw new ErroApi(
        CodigoErro.CICLO_ENCERRADO,
        `O ciclo ${String(ciclo.ano)} está encerrado e não aceita alterações.`,
      );
    }

    const setorIds = dados.responsaveis.map((item) => item.setorId);
    const usuarioIds = [
      ...new Set(
        dados.responsaveis.flatMap((item) => (item.usuarioId === null ? [] : [item.usuarioId])),
      ),
    ];
    const [setores, gestores, atuais] = await Promise.all([
      this.prisma.setor.findMany({ where: { id: { in: setorIds } }, select: SETOR }),
      this.prisma.usuario.findMany({
        where: { id: { in: usuarioIds }, perfil: Perfil.GESTOR, ativo: true },
        select: { id: true },
      }),
      this.prisma.setorResponsavel.findMany({
        where: { cicloId, setorId: { in: setorIds } },
        select: { setorId: true, usuarioId: true },
      }),
    ]);

    if (setores.length !== setorIds.length) {
      throw new ErroApi(CodigoErro.VALIDACAO, 'Um ou mais setores não existem.');
    }
    const validos = new Set(gestores.map((g) => g.id));
    const invalidos = usuarioIds.filter((id) => !validos.has(id));
    if (invalidos.length > 0) {
      throw new ErroApi(
        CodigoErro.VALIDACAO,
        'Só usuários com o perfil Gestor e ativos podem ser responsáveis por um setor.',
        { usuarios: invalidos },
      );
    }
    const porId = new Map(setores.map((s) => [s.id, s]));
    for (const item of dados.responsaveis) {
      if (item.usuarioId !== null && porId.get(item.setorId)?.ativo === false) {
        throw new ErroApi(
          CodigoErro.VALIDACAO,
          `O setor ${porId.get(item.setorId)?.nome ?? ''} está inativo e não pode receber responsável.`,
        );
      }
    }

    const atualPorSetor = new Map(atuais.map((a) => [a.setorId, a.usuarioId]));
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { setorId, usuarioId } of dados.responsaveis) {
          const antes = atualPorSetor.get(setorId) ?? null;
          if (antes === usuarioId) continue;
          if (usuarioId === null) {
            await tx.setorResponsavel.delete({ where: { cicloId_setorId: { cicloId, setorId } } });
          } else {
            await tx.setorResponsavel.upsert({
              where: { cicloId_setorId: { cicloId, setorId } },
              create: {
                cicloId,
                setorId,
                usuarioId,
                criadoPor: autor.usuarioId,
                atualizadoPor: autor.usuarioId,
              },
              update: { usuarioId, atualizadoPor: autor.usuarioId },
            });
          }
          await this.auditoria.registrar(tx, autor, {
            entidade: 'setor_responsavel',
            entidadeId: `${cicloId}:${setorId}`,
            acao: 'DEFINIR_RESPONSAVEL',
            antes: { usuarioId: antes },
            depois: { usuarioId },
          });
        }
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, 'Responsável em uso.');
    }
    return this.listarResponsaveis(cicloId);
  }

  private async obterCiclo(id: string) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id }, select: SELECAO });
    if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
    return ciclo;
  }
}
