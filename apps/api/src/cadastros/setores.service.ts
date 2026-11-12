import { Injectable } from '@nestjs/common';
import { CodigoErro, type Setor, type SetorEntradaSchema } from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaService } from '../auditoria/auditoria.service.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DadosSetor = z.output<typeof SetorEntradaSchema>;

const ENTIDADE = 'setor';
const SELECAO = { id: true, codigo: true, nome: true, corporativo: true, ativo: true } as const;

const MENSAGEM_EM_USO =
  'Este setor tem registros associados (responsáveis, variáveis, metas ou leitores) e não pode ser excluído. Inative-o.';

function retrato(s: Setor) {
  return { codigo: s.codigo, nome: s.nome, corporativo: s.corporativo, ativo: s.ativo };
}

/**
 * Cadastro de setores (RF-04), com o setor especial Corporativo: único (índice parcial no banco),
 * nunca inativado nem excluído. Exclusão só sem registros associados (decisão do desenvolvedor,
 * 12/11/2026).
 */
@Injectable()
export class SetoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  listar(): Promise<Setor[]> {
    return this.prisma.setor.findMany({
      select: SELECAO,
      orderBy: [{ corporativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async obter(id: string): Promise<Setor> {
    const setor = await this.prisma.setor.findUnique({ where: { id }, select: SELECAO });
    if (setor === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Setor não encontrado.');
    return setor;
  }

  async criar(dados: DadosSetor, autor: Autor): Promise<Setor> {
    if (dados.corporativo && !dados.ativo) throw this.corporativoInativo();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.setor.create({
          data: { ...dados, criadoPor: autor.usuarioId, atualizadoPor: autor.usuarioId },
          select: SELECAO,
        });
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: criado.id,
          acao: 'CRIAR',
          depois: retrato(criado),
        });
        return criado;
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  async alterar(id: string, dados: DadosSetor, autor: Autor): Promise<Setor> {
    const antes = await this.obter(id);
    if (dados.corporativo && !dados.ativo) throw this.corporativoInativo();

    // O código aparece nas fórmulas (`RH.TOTAL_COLAB`) e o Corporativo define o bloco das metas
    // (RN-02): depois que o setor tem variáveis ou metas, nenhum dos dois pode mudar.
    const mudaCodigo = dados.codigo !== antes.codigo;
    const mudaCorporativo = dados.corporativo !== antes.corporativo;
    if (mudaCodigo || mudaCorporativo) {
      const [variaveis, metas] = await Promise.all([
        this.prisma.variavel.count({ where: { setorId: id } }),
        this.prisma.meta.count({ where: { setorId: id } }),
      ]);
      if (variaveis + metas > 0) {
        throw new ErroApi(
          CodigoErro.VALIDACAO,
          mudaCodigo
            ? 'O código não pode mudar: o setor já tem variáveis ou metas, e o código é usado nas fórmulas.'
            : 'O setor já tem variáveis ou metas: não é possível mudar se ele é o Corporativo.',
        );
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const depois = await tx.setor.update({
          where: { id },
          data: { ...dados, atualizadoPor: autor.usuarioId },
          select: SELECAO,
        });
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

  async excluir(id: string, autor: Autor): Promise<void> {
    const antes = await this.obter(id);
    if (antes.corporativo) {
      throw new ErroApi(CodigoErro.VALIDACAO, 'O setor Corporativo não pode ser excluído.');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.setor.delete({ where: { id } });
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

  private corporativoInativo(): ErroApi {
    return new ErroApi(CodigoErro.VALIDACAO, 'O setor Corporativo não pode ser inativado.', {
      campos: [{ campo: 'ativo', mensagem: 'O setor Corporativo não pode ser inativado.' }],
    });
  }
}
