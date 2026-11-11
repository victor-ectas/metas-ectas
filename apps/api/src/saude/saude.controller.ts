import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { PrismaService } from '../prisma/prisma.service.js';

/** Tempo máximo para o banco responder à verificação. */
export const PRAZO_VERIFICACAO_MS = 3000;

export interface Verificacao {
  status: 'ok' | 'erro';
  latenciaMs?: number;
}

export interface Saude {
  status: 'ok' | 'indisponivel';
  verificacoes: { banco: Verificacao };
  em: string;
}

/**
 * Rota de saúde (RNF-14): 200 se as dependências respondem, 503 se alguma falha.
 * Pública, para o monitoramento e o IIS. A fila (pg-boss) entra no P22.
 */
@ApiTags('saúde')
@Controller('saude')
export class SaudeController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(SaudeController.name) private readonly logger: PinoLogger,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Situação da API e do banco de dados' })
  @ApiResponse({ status: 200, description: 'Tudo funcionando' })
  @ApiResponse({ status: 503, description: 'Alguma dependência indisponível' })
  async verificar(@Res({ passthrough: true }) resposta: Response): Promise<Saude> {
    const banco = await this.verificarBanco();
    const ok = banco.status === 'ok';
    resposta.status(ok ? 200 : 503);
    return {
      status: ok ? 'ok' : 'indisponivel',
      verificacoes: { banco },
      em: new Date().toISOString(),
    };
  }

  private async verificarBanco(): Promise<Verificacao> {
    const inicio = performance.now();
    let prazo: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, rejeitar) => {
          prazo = setTimeout(() => {
            rejeitar(new Error(`Banco não respondeu em ${String(PRAZO_VERIFICACAO_MS)} ms`));
          }, PRAZO_VERIFICACAO_MS);
        }),
      ]);
      return { status: 'ok', latenciaMs: Math.round(performance.now() - inicio) };
    } catch (erro) {
      this.logger.warn({ err: erro }, 'Banco de dados indisponível na verificação de saúde');
      return { status: 'erro' };
    } finally {
      clearTimeout(prazo);
    }
  }
}
