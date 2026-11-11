import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const METODOS_DE_LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Limite de taxa só nas rotas de escrita (CLAUDE.md 6): POST, PUT, PATCH e DELETE.
 * O cliente é identificado pelo IP real (`trust proxy` para o IIS na mesma máquina).
 */
@Injectable()
export class LimiteEscritaGuard extends ThrottlerGuard {
  protected override shouldSkip(contexto: ExecutionContext): Promise<boolean> {
    const metodo = contexto.switchToHttp().getRequest<Request>().method;
    return Promise.resolve(METODOS_DE_LEITURA.has(metodo));
  }
}
