import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FiltroVariaveisSchema,
  Perfil,
  UuidSchema,
  type Variavel,
  VariavelEntradaSchema,
} from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaModule } from '../auditoria/auditoria.service.js';
import { ResultadosModule } from '../resultados/resultados.module.js';
import { Perfis } from '../auth/decoradores.js';
import { AutorDaRequisicao } from '../comum/autor.js';
import { ValidacaoZod } from '../comum/validacao-zod.pipe.js';
import { VariaveisService } from './variaveis.service.js';

const idValido = new ValidacaoZod(UuidSchema);
type Entrada = z.output<typeof VariavelEntradaSchema>;

/** Variáveis do ciclo (CLAUDE.md P12, especificação 10.1): só o Administrador (tabela 7.5). */
@ApiTags('variaveis')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('ciclos/:cicloId/variaveis')
export class VariaveisController {
  constructor(private readonly variaveis: VariaveisService) {}

  @Get()
  @ApiOperation({ summary: 'Variáveis do ciclo (?setor=), com as metas que usam cada uma' })
  listar(
    @Param('cicloId', idValido) cicloId: string,
    @Query(new ValidacaoZod(FiltroVariaveisSchema)) filtro: z.output<typeof FiltroVariaveisSchema>,
  ): Promise<Variavel[]> {
    return this.variaveis.listar(cicloId, filtro.setor);
  }

  @Get(':id')
  obter(
    @Param('cicloId', idValido) cicloId: string,
    @Param('id', idValido) id: string,
  ): Promise<Variavel> {
    return this.variaveis.obter(cicloId, id);
  }

  @Post()
  criar(
    @Param('cicloId', idValido) cicloId: string,
    @Body(new ValidacaoZod(VariavelEntradaSchema)) dados: Entrada,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Variavel> {
    return this.variaveis.criar(cicloId, dados, autor);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Altera a variável; trocar o código atualiza as fórmulas (RF-21)' })
  alterar(
    @Param('cicloId', idValido) cicloId: string,
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(VariavelEntradaSchema)) dados: Entrada,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Variavel> {
    return this.variaveis.alterar(cicloId, id, dados, autor);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui uma variável sem lançamentos nem metas (senão, inative)' })
  excluir(
    @Param('cicloId', idValido) cicloId: string,
    @Param('id', idValido) id: string,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<void> {
    return this.variaveis.excluir(cicloId, id, autor);
  }
}

@Module({
  imports: [AuditoriaModule, ResultadosModule],
  controllers: [VariaveisController],
  providers: [VariaveisService],
})
export class VariaveisModule {}
