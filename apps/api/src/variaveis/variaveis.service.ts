import { Injectable } from '@nestjs/common';
import type { Prisma } from '@metas/prisma';
import { parse, renomearVariavel } from '@metas/motor';
import {
  CodigoErro,
  Perfil,
  StatusCiclo,
  type Variavel,
  type VariavelEntradaSchema,
} from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaService, type Transacao } from '../auditoria/auditoria.service.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResultadosService } from '../resultados/resultados.service.js';

type DadosVariavel = z.output<typeof VariavelEntradaSchema>;

const ENTIDADE = 'variavel';
const MENSAGEM_EM_USO =
  'Esta variável tem lançamentos ou é usada por metas e não pode ser excluída. Inative-a.';

const SELECAO = {
  id: true,
  cicloId: true,
  setorId: true,
  codigo: true,
  nome: true,
  tipo: true,
  acumulacao: true,
  origem: true,
  responsavelId: true,
  casasDecimais: true,
  ativo: true,
  setor: { select: { codigo: true, nome: true } },
  responsavel: { select: { nome: true } },
  metas: {
    select: { meta: { select: { id: true, codigo: true, indicador: true, ativo: true } } },
    orderBy: { meta: { codigo: 'asc' } },
  },
  _count: { select: { lancamentos: true } },
} as const satisfies Prisma.VariavelSelect;

type VariavelBanco = Prisma.VariavelGetPayload<{ select: typeof SELECAO }>;

function paraVariavel(v: VariavelBanco): Variavel {
  const { setor, responsavel, metas, _count, ...campos } = v;
  return {
    ...campos,
    setorCodigo: setor.codigo,
    setorNome: setor.nome,
    responsavelNome: responsavel?.nome ?? null,
    temLancamentos: _count.lancamentos > 0,
    usadaPor: metas.map((uso) => uso.meta),
  };
}

/** O que vai para a auditoria (sem os dados derivados). */
function retrato(v: Variavel | DadosVariavel) {
  return {
    setorId: v.setorId,
    codigo: v.codigo,
    nome: v.nome,
    tipo: v.tipo,
    acumulacao: v.acumulacao,
    origem: v.origem,
    responsavelId: v.responsavelId,
    casasDecimais: v.casasDecimais,
    ativo: v.ativo,
  };
}

const invalido = (campo: string, mensagem: string) =>
  new ErroApi(CodigoErro.VALIDACAO, mensagem, { campos: [{ campo, mensagem }] });

/**
 * Variáveis de cada ciclo e setor (RF-19 a RF-21, RN-07 a RN-12). Regras do desenvolvedor
 * (12/11/2026, ADR-017):
 *
 * - com lançamentos ou usada em meta, tipo, acumulação e setor ficam fixos;
 * - não inativa enquanto alguma meta ativa a usa;
 * - responsável próprio só no Corporativo, opcional (o P15 avisa) e só Gestor ativo;
 * - exclusão só sem registros associados (como no ADR-016).
 *
 * Trocar o código reescreve as fórmulas das metas que a usam, na mesma transação (RF-21).
 * Ciclo encerrado não aceita alterações (RN-39).
 */
@Injectable()
export class VariaveisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly resultados: ResultadosService,
  ) {}

  async listar(cicloId: string, setorId?: string): Promise<Variavel[]> {
    await this.obterCiclo(cicloId);
    const variaveis = await this.prisma.variavel.findMany({
      where: { cicloId, ...(setorId === undefined ? {} : { setorId }) },
      select: SELECAO,
      orderBy: [{ setor: { corporativo: 'desc' } }, { setor: { nome: 'asc' } }, { codigo: 'asc' }],
    });
    return variaveis.map(paraVariavel);
  }

  async obter(cicloId: string, id: string): Promise<Variavel> {
    const variavel = await this.prisma.variavel.findFirst({
      where: { id, cicloId },
      select: SELECAO,
    });
    if (variavel === null) {
      throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Variável não encontrada.');
    }
    return paraVariavel(variavel);
  }

  async criar(cicloId: string, dados: DadosVariavel, autor: Autor): Promise<Variavel> {
    await this.cicloAberto(cicloId);
    await this.validarSetorEResponsavel(dados, true);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { id } = await tx.variavel.create({
          data: { ...dados, cicloId, criadoPor: autor.usuarioId, atualizadoPor: autor.usuarioId },
          select: { id: true },
        });
        const criada = paraVariavel(
          await tx.variavel.findUniqueOrThrow({ where: { id }, select: SELECAO }),
        );
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: id,
          acao: 'CRIAR',
          depois: retrato(criada),
        });
        return criada;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  async alterar(
    cicloId: string,
    id: string,
    dados: DadosVariavel,
    autor: Autor,
  ): Promise<Variavel> {
    await this.cicloAberto(cicloId);
    const antes = await this.obter(cicloId, id);
    const mudaSetor = dados.setorId !== antes.setorId;
    await this.validarSetorEResponsavel(dados, mudaSetor);

    if (antes.temLancamentos || antes.usadaPor.length > 0) {
      const motivo = antes.temLancamentos ? 'já tem lançamentos' : 'já é usada por metas';
      if (mudaSetor) throw invalido('setorId', `O setor não pode mudar: a variável ${motivo}.`);
      if (dados.tipo !== antes.tipo) {
        throw invalido('tipo', `O tipo não pode mudar: a variável ${motivo}.`);
      }
      if (dados.acumulacao !== antes.acumulacao) {
        throw invalido('acumulacao', `A acumulação não pode mudar: a variável ${motivo}.`);
      }
    }

    if (antes.ativo && !dados.ativo) {
      const metasAtivas = antes.usadaPor.filter((meta) => meta.ativo);
      if (metasAtivas.length > 0) {
        throw new ErroApi(
          CodigoErro.EM_USO,
          `A variável é usada por metas ativas (${metasAtivas.map((m) => m.codigo).join(', ')}). ` +
            'Tire-a das fórmulas ou inative as metas antes.',
          { metas: metasAtivas.map((m) => m.id) },
        );
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.variavel.update({
          where: { id },
          data: { ...dados, atualizadoPor: autor.usuarioId },
        });
        if (dados.codigo !== antes.codigo) {
          await this.reescreverFormulas(tx, antes, dados.codigo, autor);
        }
        // Acumulação ou situação da variável mudam o cálculo das metas que a usam (6.5).
        await this.resultados.recalcularPorVariaveis(tx, [id]);
        const depois = paraVariavel(
          await tx.variavel.findUniqueOrThrow({ where: { id }, select: SELECAO }),
        );
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: id,
          acao: 'ALTERAR',
          antes: retrato(antes),
          depois: retrato(depois),
        });
        return depois;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  async excluir(cicloId: string, id: string, autor: Autor): Promise<void> {
    await this.cicloAberto(cicloId);
    const antes = await this.obter(cicloId, id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.variavel.delete({ where: { id } });
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: id,
          acao: 'EXCLUIR',
          antes: retrato(antes),
        });
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  /**
   * RF-21: troca o código nas fórmulas das metas que usam a variável (`meta_variavel`), regrava a
   * AST, sobe a versão da meta e audita cada uma. O vínculo `meta_variavel` é por id e não muda.
   */
  private async reescreverFormulas(
    tx: Transacao,
    variavel: Variavel,
    novo: string,
    autor: Autor,
  ): Promise<void> {
    const metas = await tx.meta.findMany({
      where: { variaveis: { some: { variavelId: variavel.id } }, formulaTexto: { not: null } },
      select: { id: true, formulaTexto: true, versao: true, setor: { select: { codigo: true } } },
    });
    for (const meta of metas) {
      const antes = meta.formulaTexto ?? '';
      const depois = renomearVariavel(antes, {
        setorDaMeta: meta.setor.codigo,
        setorDaVariavel: variavel.setorCodigo,
        antigo: variavel.codigo,
        novo,
      });
      if (depois === antes) continue;
      await tx.meta.update({
        where: { id: meta.id },
        data: {
          formulaTexto: depois,
          formulaAst: parse(depois) as unknown as Prisma.InputJsonValue,
          versao: { increment: 1 },
          atualizadoPor: autor.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, autor, {
        entidade: 'meta',
        entidadeId: meta.id,
        acao: 'RENOMEAR_VARIAVEL',
        antes: { formulaTexto: antes, versao: meta.versao },
        depois: { formulaTexto: depois, versao: meta.versao + 1, variavelId: variavel.id },
      });
    }
  }

  /**
   * Setor existe (e está ativo, quando a variável entra nele); responsável só no Corporativo e
   * só Gestor ativo.
   */
  private async validarSetorEResponsavel(dados: DadosVariavel, entraNoSetor: boolean) {
    const setor = await this.prisma.setor.findUnique({
      where: { id: dados.setorId },
      select: { ativo: true, corporativo: true },
    });
    if (setor === null) throw invalido('setorId', 'Setor não encontrado.');
    if (entraNoSetor && !setor.ativo) {
      throw invalido('setorId', 'O setor está inativo e não pode receber variáveis.');
    }
    if (dados.responsavelId === null) return;
    if (!setor.corporativo) {
      throw invalido(
        'responsavelId',
        'Só variáveis do Corporativo têm responsável próprio. Nos outros setores, lança o responsável pelo setor no ciclo.',
      );
    }
    const gestor = await this.prisma.usuario.count({
      where: { id: dados.responsavelId, perfil: Perfil.GESTOR, ativo: true },
    });
    if (gestor === 0) {
      throw invalido('responsavelId', 'O responsável precisa ser um usuário Gestor e ativo.');
    }
  }

  private async obterCiclo(id: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id },
      select: { ano: true, status: true },
    });
    if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
    return ciclo;
  }

  /** RN-39: ciclo encerrado não aceita alterações. Ciclo ativo aceita (o recálculo vem no P17). */
  private async cicloAberto(id: string) {
    const ciclo = await this.obterCiclo(id);
    if (ciclo.status === StatusCiclo.ENCERRADO) {
      throw new ErroApi(
        CodigoErro.CICLO_ENCERRADO,
        `O ciclo ${String(ciclo.ano)} está encerrado e não aceita alterações.`,
      );
    }
  }
}
