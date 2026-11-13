import { Body, Controller, Get, Module, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FiltroLancamentosSchema,
  LancamentosEntradaSchema,
  type LancamentosMes,
  type LancamentosSalvos,
  type Pendencias,
  Perfil,
} from '@metas/tipos';
import type { z } from 'zod';

import { Perfis } from '../auth/decoradores.js';
import { type UsuarioAtual, UsuarioLogado } from '../auth/usuario-atual.js';
import { Relogio } from '../comum/relogio.js';
import { ValidacaoZod } from '../comum/validacao-zod.pipe.js';
import { ResultadosModule } from '../resultados/resultados.module.js';
import { LancamentosService, PERFIS_LANCAMENTO } from './lancamentos.service.js';

/**
 * Lançamentos (CLAUDE.md P18, especificação 10.1): Gestor nas suas variáveis e meses abertos;
 * Administrador como carga histórica (7.5). As regras finas ficam no serviço e no
 * `PoliticasService`.
 */
@ApiTags('lancamentos')
@ApiBearerAuth()
@Perfis(...PERFIS_LANCAMENTO)
@Controller('lancamentos')
export class LancamentosController {
  constructor(private readonly lancamentos: LancamentosService) {}

  @Get()
  @ApiOperation({
    summary: 'Variáveis do usuário no mês, com valores, versões e metas (?ciclo&mes)',
  })
  consultar(
    @Query(new ValidacaoZod(FiltroLancamentosSchema))
    filtro: z.output<typeof FiltroLancamentosSchema>,
    @UsuarioLogado() usuario: UsuarioAtual,
  ): Promise<LancamentosMes> {
    return this.lancamentos.consultar(usuario, filtro.ciclo, filtro.mes);
  }

  @Get('pendencias')
  @Perfis(Perfil.GESTOR)
  @ApiOperation({
    summary: 'Meses terminados ainda abertos para o Gestor, com prazo e variáveis vazias (Início)',
  })
  pendencias(@UsuarioLogado() usuario: UsuarioAtual): Promise<Pendencias> {
    return this.lancamentos.pendencias(usuario);
  }

  @Put()
  @ApiOperation({ summary: 'Grava um lote de valores (tudo ou nada), com versão por item' })
  salvar(
    @Body(new ValidacaoZod(LancamentosEntradaSchema))
    dados: z.output<typeof LancamentosEntradaSchema>,
    @UsuarioLogado() usuario: UsuarioAtual,
  ): Promise<LancamentosSalvos> {
    return this.lancamentos.salvar(usuario, dados);
  }
}

@Module({
  imports: [ResultadosModule],
  controllers: [LancamentosController],
  providers: [LancamentosService, Relogio],
})
export class LancamentosModule {}
