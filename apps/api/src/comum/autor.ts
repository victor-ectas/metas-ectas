import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { Autor } from '../auditoria/auditoria.service.js';
import type { RequisicaoAutenticada } from '../auth/usuario-atual.js';

/**
 * Autor de uma alteração (usuário logado + IP), para a auditoria:
 * `@AutorDaRequisicao() autor: Autor`. O IP é o do cliente, já resolvido pelo `trust proxy`.
 */
export const AutorDaRequisicao = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): Autor => {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (requisicao.usuario === undefined) {
      throw new Error('AutorDaRequisicao usado em rota sem autenticação.');
    }
    return { usuarioId: requisicao.usuario.id, ip: requisicao.ip ?? null };
  },
);
