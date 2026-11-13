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
  FiltroMetasSchema,
  type Meta,
  MetaAlteracaoSchema,
  MetaEntradaSchema,
  Perfil,
  UuidSchema,
  ValidarFormulaEntradaSchema,
  type ValidarFormulaSaida,
} from '@metas/tipos';
import type { z } from 'zod';

import { type Autor, AuditoriaModule } from '../auditoria/auditoria.service.js';
import { ResultadosModule } from '../resultados/resultados.module.js';
import { Perfis } from '../auth/decoradores.js';
import { type UsuarioAtual, UsuarioLogado } from '../auth/usuario-atual.js';
import { AutorDaRequisicao } from '../comum/autor.js';
import { ValidacaoZod } from '../comum/validacao-zod.pipe.js';
import { MetasService } from './metas.service.js';

const idValido = new ValidacaoZod(UuidSchema);

/**
 * Metas (CLAUDE.md P13, especificação 10.1). Escrita só do Administrador (7.5); leitura conforme
 * o perfil, decidida pelo `PoliticasService.podeVerMeta`.
 */
@ApiTags('metas')
@ApiBearerAuth()
@Controller('ciclos/:cicloId/metas')
export class MetasDoCicloController {
  constructor(private readonly metas: MetasService) {}

  @Get()
  @ApiOperation({ summary: 'Metas do ciclo que o usuário pode ver (?setor=&gestor=)' })
  listar(
    @Param('cicloId', idValido) cicloId: string,
    @Query(new ValidacaoZod(FiltroMetasSchema)) filtro: z.output<typeof FiltroMetasSchema>,
    @UsuarioLogado() usuario: UsuarioAtual,
  ): Promise<Meta[]> {
    return this.metas.listar(cicloId, filtro, usuario);
  }

  @Post()
  @Perfis(Perfil.ADMIN)
  @ApiOperation({ summary: 'Cria a meta com submetas, objetivos e atribuições' })
  criar(
    @Param('cicloId', idValido) cicloId: string,
    @Body(new ValidacaoZod(MetaEntradaSchema)) dados: z.output<typeof MetaEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Meta> {
    return this.metas.criar(cicloId, dados, autor);
  }
}

@ApiTags('metas')
@ApiBearerAuth()
@Controller('metas')
export class MetasController {
  constructor(private readonly metas: MetasService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Meta com submetas, objetivos e atribuições' })
  obter(@Param('id', idValido) id: string, @UsuarioLogado() usuario: UsuarioAtual): Promise<Meta> {
    return this.metas.obter(id, usuario);
  }

  @Put(':id')
  @Perfis(Perfil.ADMIN)
  @ApiOperation({ summary: 'Altera a meta inteira (com a versão lida; 409 se mudou)' })
  alterar(
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(MetaAlteracaoSchema)) dados: z.output<typeof MetaAlteracaoSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Meta> {
    return this.metas.alterar(id, dados.versao, dados.meta, autor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Perfis(Perfil.ADMIN)
  @ApiOperation({ summary: 'Exclui a meta sem lançamentos (senão, inative)' })
  excluir(@Param('id', idValido) id: string, @AutorDaRequisicao() autor: Autor): Promise<void> {
    return this.metas.excluir(id, autor);
  }
}

@ApiTags('metas')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('formulas')
export class FormulasController {
  constructor(private readonly metas: MetasService) {}

  @Post('validar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valida a fórmula e, com valores de teste, calcula o resultado' })
  validar(
    @Body(new ValidacaoZod(ValidarFormulaEntradaSchema))
    dados: z.output<typeof ValidarFormulaEntradaSchema>,
  ): Promise<ValidarFormulaSaida> {
    return this.metas.validarFormula(dados);
  }
}

@Module({
  imports: [AuditoriaModule, ResultadosModule],
  controllers: [MetasDoCicloController, MetasController, FormulasController],
  providers: [MetasService],
})
export class MetasModule {}
