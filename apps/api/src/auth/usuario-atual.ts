import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Perfil } from '@metas/tipos';
import type { Request } from 'express';

/** Usuário da requisição, carregado do banco pelo AuthGuard. */
export interface UsuarioAtual {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: Perfil;
  readonly ativo: boolean;
  readonly gerenteGeral: boolean;
  /** Setores liberados (perfil Leitor; vazio nos outros perfis). */
  readonly setoresLeitor: readonly string[];
}

/** Requisição já autenticada. */
export interface RequisicaoAutenticada extends Request {
  usuario?: UsuarioAtual;
}

/** Injeta o usuário logado no parâmetro do controller: `@UsuarioLogado() usuario: UsuarioAtual`. */
export const UsuarioLogado = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): UsuarioAtual => {
    const usuario = contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
    // O AuthGuard global roda antes; só falta usuário em rota @Publica(), onde isto não é usado.
    if (usuario === undefined) throw new Error('UsuarioLogado usado em rota sem autenticação.');
    return usuario;
  },
);
