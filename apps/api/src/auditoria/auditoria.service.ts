import { Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@metas/prisma';

/** Cliente dentro de uma transação: a auditoria grava junto com a alteração, ou nada grava. */
export type Transacao = Prisma.TransactionClient;

/** Quem fez a alteração e de onde. */
export interface Autor {
  readonly usuarioId: string;
  readonly ip: string | null;
}

export interface RegistroAuditoria {
  /** Tabela alterada (ex.: `usuario`, `setor_responsavel`). */
  readonly entidade: string;
  /** Chave do registro; composta vira texto (`cicloId:setorId`). */
  readonly entidadeId: string;
  /** `CRIAR`, `ALTERAR`, `EXCLUIR` ou uma ação específica (`DEFINIR_RESPONSAVEL`). */
  readonly acao: string;
  readonly antes?: object | null;
  readonly depois?: object | null;
}

/** Converte para JSON puro (datas viram texto ISO), como fica guardado no `jsonb`. */
function paraJson(valor: object | null | undefined): Prisma.InputJsonValue | undefined {
  if (valor === null || valor === undefined) return undefined;
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

/**
 * Auditoria somente inclusão (CLAUDE.md 6, RN-40): toda alteração de cadastro, meta, peso,
 * fórmula, permissão, ciclo, reabertura e lançamento grava antes e depois, na mesma transação.
 */
@Injectable()
export class AuditoriaService {
  async registrar(tx: Transacao, autor: Autor, registro: RegistroAuditoria): Promise<void> {
    await tx.auditoria.create({
      data: {
        entidade: registro.entidade,
        entidadeId: registro.entidadeId,
        acao: registro.acao,
        antes: paraJson(registro.antes),
        depois: paraJson(registro.depois),
        usuarioId: autor.usuarioId,
        ip: autor.ip,
      },
    });
  }
}

@Module({ providers: [AuditoriaService], exports: [AuditoriaService] })
export class AuditoriaModule {}
