import { Injectable } from '@nestjs/common';
import { Prisma } from '@metas/prisma';
import { Perfil } from '@metas/tipos';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ErroApi } from '../comum/erro-api.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioAtual } from './usuario-atual.js';
import type { IdentidadeEntra } from './validador-token.js';

/** Campos lidos do banco para montar o `UsuarioAtual`. */
const SELECAO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  gerenteGeral: true,
  setoresLeitor: { select: { setorId: true } },
} as const satisfies Prisma.UsuarioSelect;

type UsuarioLido = Prisma.UsuarioGetPayload<{ select: typeof SELECAO }>;

const ENTIDADE = 'usuario';

/**
 * Liga o login ao usuário do sistema (especificação 8.3): procura pelo `oid` do Entra ID; senão,
 * pelo e-mail de um usuário pré-cadastrado que ainda não entrou (e grava o `oid`); senão, cria como
 * Leitor inativo (RF-02). Vínculo e criação ficam na auditoria.
 */
@Injectable()
export class AcessoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(AcessoService.name) private readonly logger: PinoLogger,
  ) {}

  async usuarioDoLogin(identidade: IdentidadeEntra, ip: string | null): Promise<UsuarioAtual> {
    const existente = await this.porOid(identidade.oid);
    if (existente !== null) return existente;

    const email = identidade.email;
    if (email === null) {
      throw new ErroApi(
        'SEM_PERMISSAO',
        'Sua conta Microsoft não informou o e-mail. Procure o Administrador do sistema.',
      );
    }

    const preCadastrado = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, entraOid: true },
    });
    if (preCadastrado !== null) {
      // Primeiro acesso em várias abas: outra requisição criou (ou ligou) este usuário com o mesmo
      // oid entre a busca pelo oid e esta. É a própria pessoa, não outra conta.
      if (preCadastrado.entraOid === identidade.oid) {
        const mesmo = await this.porOid(identidade.oid);
        if (mesmo !== null) return mesmo;
      }
      if (preCadastrado.entraOid !== null) {
        // Mesmo e-mail, outra conta Microsoft (ex.: conta recriada). Só o Administrador resolve.
        this.logger.warn(
          { usuarioId: preCadastrado.id },
          'Login com e-mail já ligado a outra conta do Entra ID',
        );
        throw new ErroApi(
          'SEM_PERMISSAO',
          'Seu e-mail já está ligado a outra conta Microsoft no sistema. Procure o Administrador.',
        );
      }
      return this.vincular(preCadastrado.id, identidade.oid, ip);
    }

    return this.criar({ ...identidade, email }, ip);
  }

  /** Modo DEV: o usuário simulado precisa existir (seed ou cadastro). */
  async usuarioDev(email: string): Promise<UsuarioAtual> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email }, select: SELECAO });
    if (usuario === null) {
      throw new ErroApi(
        'NAO_AUTENTICADO',
        `Modo DEV: usuário ${email} não cadastrado. Rode pnpm db:seed ou use outro e-mail.`,
      );
    }
    return paraUsuarioAtual(usuario);
  }

  private async porOid(oid: string): Promise<UsuarioAtual | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { entraOid: oid },
      select: SELECAO,
    });
    return usuario === null ? null : paraUsuarioAtual(usuario);
  }

  private async vincular(id: string, oid: string, ip: string | null): Promise<UsuarioAtual> {
    const usuario = await this.prisma.$transaction(async (tx) => {
      // Só vincula se ainda estiver sem oid (dois logins simultâneos não sobrescrevem).
      const { count } = await tx.usuario.updateMany({
        where: { id, entraOid: null },
        data: { entraOid: oid, atualizadoPor: id },
      });
      if (count === 1) {
        await tx.auditoria.create({
          data: {
            entidade: ENTIDADE,
            entidadeId: id,
            acao: 'VINCULAR_ENTRA_ID',
            antes: { entraOid: null },
            depois: { entraOid: oid },
            usuarioId: id,
            ip,
          },
        });
      }
      return tx.usuario.findUniqueOrThrow({
        where: { id },
        select: { ...SELECAO, entraOid: true },
      });
    });
    if (usuario.entraOid !== oid) {
      throw new ErroApi(
        'SEM_PERMISSAO',
        'Seu e-mail já está ligado a outra conta Microsoft no sistema. Procure o Administrador.',
      );
    }
    this.logger.info({ usuarioId: id }, 'Usuário pré-cadastrado entrou pela primeira vez');
    return paraUsuarioAtual(usuario);
  }

  private async criar(
    identidade: IdentidadeEntra & { email: string },
    ip: string | null,
  ): Promise<UsuarioAtual> {
    try {
      const usuario = await this.prisma.$transaction(async (tx) => {
        const novo = await tx.usuario.create({
          data: {
            entraOid: identidade.oid,
            email: identidade.email,
            nome: identidade.nome ?? identidade.email,
            perfil: Perfil.LEITOR,
            ativo: false,
          },
          select: SELECAO,
        });
        await tx.auditoria.create({
          data: {
            entidade: ENTIDADE,
            entidadeId: novo.id,
            acao: 'CRIAR_NO_PRIMEIRO_ACESSO',
            depois: {
              email: novo.email,
              nome: novo.nome,
              perfil: novo.perfil,
              ativo: novo.ativo,
              entraOid: identidade.oid,
            },
            usuarioId: novo.id,
            ip,
          },
        });
        return novo;
      });
      this.logger.info(
        { usuarioId: usuario.id },
        'Usuário criado no primeiro acesso (Leitor inativo)',
      );
      return paraUsuarioAtual(usuario);
    } catch (erro) {
      // Primeiro acesso simultâneo (duas abas): a outra requisição criou o usuário.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const criado = await this.porOid(identidade.oid);
        if (criado !== null) return criado;
        throw new ErroApi(
          'SEM_PERMISSAO',
          'Seu e-mail já está ligado a outra conta Microsoft no sistema. Procure o Administrador.',
        );
      }
      throw erro;
    }
  }
}

function paraUsuarioAtual(usuario: UsuarioLido): UsuarioAtual {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    gerenteGeral: usuario.gerenteGeral,
    setoresLeitor: usuario.setoresLeitor.map((s) => s.setorId),
  };
}
