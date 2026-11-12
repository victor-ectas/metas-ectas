import { Injectable } from '@nestjs/common';
import type { Prisma } from '@metas/prisma';
import {
  CodigoErro,
  type FiltroUsuarios,
  type ListaUsuarios,
  Perfil,
  StatusCiclo,
  type Usuario,
  type UsuarioEntradaSchema,
} from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaService } from '../auditoria/auditoria.service.js';
import { ErroApi } from '../comum/erro-api.js';
import { traduzirErroBanco } from '../comum/erros-banco.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DadosUsuario = z.output<typeof UsuarioEntradaSchema>;

const ENTIDADE = 'usuario';

const SELECAO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  gerenteGeral: true,
  superiorId: true,
  entraOid: true,
  superior: { select: { nome: true } },
  setoresLeitor: { select: { setorId: true }, orderBy: { setorId: 'asc' } },
} satisfies Prisma.UsuarioSelect;

type UsuarioDoBanco = Prisma.UsuarioGetPayload<{ select: typeof SELECAO }>;

function paraUsuario(u: UsuarioDoBanco): Usuario {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    ativo: u.ativo,
    gerenteGeral: u.gerenteGeral,
    superiorId: u.superiorId,
    superiorNome: u.superior?.nome ?? null,
    entrouAlgumaVez: u.entraOid !== null,
    setoresLeitor: u.setoresLeitor.map((s) => s.setorId),
  };
}

/** Retrato do usuário na auditoria: só os campos editáveis. */
function retrato(u: UsuarioDoBanco | Usuario) {
  return {
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    ativo: u.ativo,
    gerenteGeral: u.gerenteGeral,
    superiorId: u.superiorId,
  };
}

const MENSAGEM_EM_USO =
  'Este usuário tem registros associados (responsabilidades, metas, lançamentos ou histórico) e não pode ser excluído. Inative-o.';

/**
 * Cadastro de usuários (RF-03). O usuário é pré-cadastrado pelo e-mail e ligado à conta
 * Microsoft no primeiro login (ADR-013). Regras do desenvolvedor (12/11/2026): Gerente Geral só
 * na Diretoria; responsável por setor só Gestor ativo; exclusão só sem registros associados.
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroUsuarios): Promise<ListaUsuarios> {
    const busca = filtro.busca === undefined || filtro.busca === '' ? undefined : filtro.busca;
    const where: Prisma.UsuarioWhereInput = {
      perfil: filtro.perfil,
      ativo: filtro.ativo,
      OR:
        busca === undefined
          ? undefined
          : [
              { nome: { contains: busca, mode: 'insensitive' } },
              { email: { contains: busca.toLowerCase() } },
            ],
    };
    const [total, usuarios] = await this.prisma.$transaction([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: SELECAO,
        orderBy: [{ nome: 'asc' }, { email: 'asc' }],
        skip: (filtro.pagina - 1) * filtro.tamanho,
        take: filtro.tamanho,
      }),
    ]);
    return {
      itens: usuarios.map(paraUsuario),
      total,
      pagina: filtro.pagina,
      tamanho: filtro.tamanho,
    };
  }

  async obter(id: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SELECAO });
    if (usuario === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado.');
    return paraUsuario(usuario);
  }

  async criar(dados: DadosUsuario, autor: Autor): Promise<Usuario> {
    if (dados.superiorId !== null) await this.validarSuperior(null, dados.superiorId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const criado = await tx.usuario.create({
          data: { ...dados, criadoPor: autor.usuarioId, atualizadoPor: autor.usuarioId },
          select: SELECAO,
        });
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: criado.id,
          acao: 'CRIAR',
          depois: retrato(criado),
        });
        return paraUsuario(criado);
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  async alterar(id: string, dados: DadosUsuario, autor: Autor): Promise<Usuario> {
    const antes = await this.obter(id);

    // O Administrador não pode tirar o próprio acesso: o sistema ficaria sem quem o administre.
    if (id === autor.usuarioId && (!dados.ativo || dados.perfil !== Perfil.ADMIN)) {
      throw new ErroApi(
        CodigoErro.VALIDACAO,
        'Você não pode se inativar nem tirar seu próprio perfil de Administrador. Peça a outro Administrador.',
      );
    }
    if (dados.superiorId !== null) await this.validarSuperior(id, dados.superiorId);
    if (!dados.ativo || dados.perfil !== Perfil.GESTOR) await this.validarNaoResponsavel(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const depois = await tx.usuario.update({
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
        return paraUsuario(depois);
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  /** Exclui só quem não tem nenhum registro associado (decisão do desenvolvedor, 12/11/2026). */
  async excluir(id: string, autor: Autor): Promise<void> {
    if (id === autor.usuarioId) {
      throw new ErroApi(CodigoErro.VALIDACAO, 'Você não pode excluir o próprio usuário.');
    }
    const antes = await this.obter(id);
    try {
      await this.prisma.$transaction(async (tx) => {
        // Setores liberados ao Leitor são configuração do próprio usuário: saem junto.
        await tx.leitorSetor.deleteMany({ where: { usuarioId: id } });
        await tx.usuario.delete({ where: { id } });
        await this.auditoria.registrar(tx, autor, {
          entidade: ENTIDADE,
          entidadeId: id,
          acao: 'EXCLUIR',
          antes: { ...retrato(antes), setoresLeitor: antes.setoresLeitor },
        });
      });
    } catch (erro) {
      throw traduzirErroBanco(erro, MENSAGEM_EM_USO);
    }
  }

  /** Setores liberados a um Leitor (substitui a lista inteira). */
  async definirSetoresLeitor(
    id: string,
    setorIds: readonly string[],
    autor: Autor,
  ): Promise<Usuario> {
    const antes = await this.obter(id);
    if (antes.perfil !== Perfil.LEITOR) {
      throw new ErroApi(
        CodigoErro.VALIDACAO,
        'Só usuários com o perfil Leitor têm setores liberados. Os outros perfis veem conforme as próprias regras.',
      );
    }
    const existentes = await this.prisma.setor.count({ where: { id: { in: [...setorIds] } } });
    if (existentes !== setorIds.length) {
      throw new ErroApi(CodigoErro.VALIDACAO, 'Um ou mais setores não existem.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.leitorSetor.deleteMany({ where: { usuarioId: id } });
      await tx.leitorSetor.createMany({
        data: setorIds.map((setorId) => ({
          usuarioId: id,
          setorId,
          criadoPor: autor.usuarioId,
          atualizadoPor: autor.usuarioId,
        })),
      });
      const depois = await tx.usuario.findUniqueOrThrow({ where: { id }, select: SELECAO });
      await this.auditoria.registrar(tx, autor, {
        entidade: ENTIDADE,
        entidadeId: id,
        acao: 'DEFINIR_SETORES_LEITOR',
        antes: { setoresLeitor: antes.setoresLeitor },
        depois: { setoresLeitor: depois.setoresLeitor.map((s) => s.setorId) },
      });
      return paraUsuario(depois);
    });
  }

  /** O superior existe, não é o próprio usuário e não cria um ciclo (A → B → A). */
  private async validarSuperior(id: string | null, superiorId: string): Promise<void> {
    if (superiorId === id) {
      throw new ErroApi(CodigoErro.VALIDACAO, 'O usuário não pode ser superior de si mesmo.', {
        campos: [{ campo: 'superiorId', mensagem: 'O usuário não pode ser superior de si mesmo.' }],
      });
    }
    let atual: string | null = superiorId;
    const visitados = new Set<string>();
    while (atual !== null && !visitados.has(atual)) {
      visitados.add(atual);
      const superior: { superiorId: string | null } | null = await this.prisma.usuario.findUnique({
        where: { id: atual },
        select: { superiorId: true },
      });
      if (superior === null) {
        throw new ErroApi(CodigoErro.VALIDACAO, 'Superior imediato não encontrado.', {
          campos: [{ campo: 'superiorId', mensagem: 'Superior imediato não encontrado.' }],
        });
      }
      if (id !== null && superior.superiorId === id) {
        const mensagem =
          'Essa escolha cria um ciclo: o superior escolhido está abaixo deste usuário.';
        throw new ErroApi(CodigoErro.VALIDACAO, mensagem, {
          campos: [{ campo: 'superiorId', mensagem: mensagem }],
        });
      }
      atual = superior.superiorId;
    }
  }

  /**
   * Responsável por setor ou por variável do Corporativo em ciclo não encerrado precisa ser
   * Gestor ativo: quem não é não consegue lançar (decisão do desenvolvedor, 12/11/2026).
   */
  private async validarNaoResponsavel(id: string): Promise<void> {
    const abertos = { status: { not: StatusCiclo.ENCERRADO } };
    const [setores, variaveis] = await Promise.all([
      this.prisma.setorResponsavel.findMany({
        where: { usuarioId: id, ciclo: abertos },
        select: { setor: { select: { nome: true } }, ciclo: { select: { ano: true } } },
        orderBy: [{ ciclo: { ano: 'asc' } }],
      }),
      this.prisma.variavel.count({ where: { responsavelId: id, ciclo: abertos } }),
    ]);
    if (setores.length === 0 && variaveis === 0) return;
    const lista = setores.map((s) => `${s.setor.nome} (${String(s.ciclo.ano)})`);
    if (variaveis > 0) lista.push(`${String(variaveis)} variável(is) do Corporativo`);
    throw new ErroApi(
      CodigoErro.VALIDACAO,
      `Este usuário é responsável por: ${lista.join(', ')}. Troque o responsável antes de inativá-lo ou mudar o perfil.`,
      { responsabilidades: lista },
    );
  }
}
