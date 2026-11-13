import { performance } from 'node:perf_hooks';

import { Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CodigoErro,
  FiltroResultadosGestorSchema,
  Perfil,
  type Recalculo,
  type ResultadoMeta,
  type ResultadosGestor,
  StatusCiclo,
  UuidSchema,
} from '@metas/tipos';
import type { z } from 'zod';

import { Perfis } from '../auth/decoradores.js';
import { type UsuarioAtual, UsuarioLogado } from '../auth/usuario-atual.js';
import { ErroApi } from '../comum/erro-api.js';
import { ValidacaoZod } from '../comum/validacao-zod.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResultadosService } from './resultados.service.js';

const idValido = new ValidacaoZod(UuidSchema);

/** Resultados (CLAUDE.md P17, especificação 10.1): leitura conforme o perfil (7.5). */
@ApiTags('resultados')
@ApiBearerAuth()
@Controller('resultados')
export class ResultadosController {
  constructor(private readonly resultados: ResultadosService) {}

  @Get('gestor/:id')
  @ApiOperation({ summary: 'Metas atribuídas ao gestor no ciclo, com pontos e notas (?ciclo=)' })
  porGestor(
    @Param('id', idValido) id: string,
    @Query(new ValidacaoZod(FiltroResultadosGestorSchema))
    filtro: z.output<typeof FiltroResultadosGestorSchema>,
    @UsuarioLogado() usuario: UsuarioAtual,
  ): Promise<ResultadosGestor> {
    return this.resultados.porGestor(usuario, id, filtro.ciclo);
  }

  @Get('meta/:id')
  @ApiOperation({ summary: 'Resultado da meta mês a mês, acumulado, pontos e memória de cálculo' })
  porMeta(
    @Param('id', idValido) id: string,
    @UsuarioLogado() usuario: UsuarioAtual,
  ): Promise<ResultadoMeta> {
    return this.resultados.porMeta(usuario, id);
  }
}

@ApiTags('resultados')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('ciclos')
export class RecalculoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultados: ResultadosService,
  ) {}

  /**
   * Recalcula o ciclo inteiro. O recálculo normal é automático, por evento; esta rota serve
   * depois de uma correção direta no banco, de uma publicação que mude o cálculo ou de uma
   * carga histórica.
   */
  @Post(':id/recalcular')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recalcula todas as metas e notas do ciclo' })
  async recalcular(@Param('id', idValido) id: string): Promise<Recalculo> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id },
      select: { ano: true, status: true },
    });
    if (ciclo === null) throw new ErroApi(CodigoErro.NAO_ENCONTRADO, 'Ciclo não encontrado.');
    if (ciclo.status === StatusCiclo.ENCERRADO) {
      throw new ErroApi(
        CodigoErro.CICLO_ENCERRADO,
        `O ciclo ${String(ciclo.ano)} está encerrado: as notas estão congeladas.`,
      );
    }
    const inicio = performance.now();
    const metas = await this.prisma.$transaction((tx) => this.resultados.recalcularCiclo(tx, id), {
      timeout: 60_000,
    });
    return { metas, milissegundos: Math.round(performance.now() - inicio) };
  }
}

@Module({
  controllers: [ResultadosController, RecalculoController],
  providers: [ResultadosService],
  exports: [ResultadosService],
})
export class ResultadosModule {}
