import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Ciclo,
  CicloEntradaSchema,
  type Feriado,
  FeriadoEntradaSchema,
  FiltroFeriadosSchema,
  FiltroUsuariosSchema,
  type ListaUsuarios,
  Perfil,
  ResponsaveisEntradaSchema,
  type ResponsavelSetor,
  type Setor,
  SetorEntradaSchema,
  SetoresLeitorEntradaSchema,
  type Usuario,
  UsuarioEntradaSchema,
  UuidSchema,
} from '@metas/tipos';
import type { z } from 'zod';

import type { Autor } from '../auditoria/auditoria.service.js';
import { Perfis } from '../auth/decoradores.js';
import { AutorDaRequisicao } from '../comum/autor.js';
import { ValidacaoZod } from '../comum/validacao-zod.pipe.js';
import { CiclosService } from './ciclos.service.js';
import { FeriadosService } from './feriados.service.js';
import { SetoresService } from './setores.service.js';
import { UsuariosService } from './usuarios.service.js';

/**
 * Cadastros básicos (CLAUDE.md P11, especificação 10.1): só o Administrador (tabela 7.5),
 * decidido pelo PoliticasService no AuthGuard (`@Perfis`). Toda alteração vai para a auditoria.
 */
const idValido = new ValidacaoZod(UuidSchema);

@ApiTags('cadastros')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários (busca por nome ou e-mail, perfil, situação)' })
  listar(
    @Query(new ValidacaoZod(FiltroUsuariosSchema)) filtro: z.output<typeof FiltroUsuariosSchema>,
  ): Promise<ListaUsuarios> {
    return this.usuarios.listar(filtro);
  }

  @Get(':id')
  obter(@Param('id', idValido) id: string): Promise<Usuario> {
    return this.usuarios.obter(id);
  }

  @Post()
  @ApiOperation({ summary: 'Pré-cadastra um usuário pelo e-mail (liga ao Entra ID no 1º login)' })
  criar(
    @Body(new ValidacaoZod(UsuarioEntradaSchema)) dados: z.output<typeof UsuarioEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Usuario> {
    return this.usuarios.criar(dados, autor);
  }

  @Put(':id')
  alterar(
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(UsuarioEntradaSchema)) dados: z.output<typeof UsuarioEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Usuario> {
    return this.usuarios.alterar(id, dados, autor);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui um usuário sem registros associados (senão, inative)' })
  excluir(@Param('id', idValido) id: string, @AutorDaRequisicao() autor: Autor): Promise<void> {
    return this.usuarios.excluir(id, autor);
  }

  @Put(':id/setores-leitor')
  @ApiOperation({ summary: 'Define os setores liberados a um Leitor' })
  definirSetoresLeitor(
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(SetoresLeitorEntradaSchema))
    dados: z.output<typeof SetoresLeitorEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Usuario> {
    return this.usuarios.definirSetoresLeitor(id, dados.setorIds, autor);
  }
}

@ApiTags('cadastros')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('setores')
export class SetoresController {
  constructor(private readonly setores: SetoresService) {}

  @Get()
  listar(): Promise<Setor[]> {
    return this.setores.listar();
  }

  @Post()
  criar(
    @Body(new ValidacaoZod(SetorEntradaSchema)) dados: z.output<typeof SetorEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Setor> {
    return this.setores.criar(dados, autor);
  }

  @Put(':id')
  alterar(
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(SetorEntradaSchema)) dados: z.output<typeof SetorEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Setor> {
    return this.setores.alterar(id, dados, autor);
  }

  @Delete(':id')
  @HttpCode(204)
  excluir(@Param('id', idValido) id: string, @AutorDaRequisicao() autor: Autor): Promise<void> {
    return this.setores.excluir(id, autor);
  }
}

@ApiTags('cadastros')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('ciclos')
export class CiclosController {
  constructor(private readonly ciclos: CiclosService) {}

  @Get()
  listar(): Promise<Ciclo[]> {
    return this.ciclos.listar();
  }

  @Post()
  @ApiOperation({ summary: 'Cria o ciclo de um ano, em Rascunho' })
  criar(
    @Body(new ValidacaoZod(CicloEntradaSchema)) dados: z.output<typeof CicloEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Ciclo> {
    return this.ciclos.criar(dados.ano, autor);
  }

  @Get(':id/responsaveis')
  @ApiOperation({ summary: 'Responsável de cada setor no ciclo' })
  listarResponsaveis(@Param('id', idValido) id: string): Promise<ResponsavelSetor[]> {
    return this.ciclos.listarResponsaveis(id);
  }

  @Put(':id/responsaveis')
  @ApiOperation({ summary: 'Define o responsável dos setores enviados (null tira)' })
  definirResponsaveis(
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(ResponsaveisEntradaSchema))
    dados: z.output<typeof ResponsaveisEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<ResponsavelSetor[]> {
    return this.ciclos.definirResponsaveis(id, dados, autor);
  }
}

@ApiTags('cadastros')
@ApiBearerAuth()
@Perfis(Perfil.ADMIN)
@Controller('feriados')
export class FeriadosController {
  constructor(private readonly feriados: FeriadosService) {}

  @Get()
  @ApiOperation({ summary: 'Feriados de um ano (?ano=2027)' })
  listar(
    @Query(new ValidacaoZod(FiltroFeriadosSchema)) filtro: z.output<typeof FiltroFeriadosSchema>,
  ): Promise<Feriado[]> {
    return this.feriados.listar(filtro.ano);
  }

  @Post()
  criar(
    @Body(new ValidacaoZod(FeriadoEntradaSchema)) dados: z.output<typeof FeriadoEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Feriado> {
    return this.feriados.criar(dados, autor);
  }

  @Put(':id')
  alterar(
    @Param('id', idValido) id: string,
    @Body(new ValidacaoZod(FeriadoEntradaSchema)) dados: z.output<typeof FeriadoEntradaSchema>,
    @AutorDaRequisicao() autor: Autor,
  ): Promise<Feriado> {
    return this.feriados.alterar(id, dados, autor);
  }

  @Delete(':id')
  @HttpCode(204)
  excluir(@Param('id', idValido) id: string, @AutorDaRequisicao() autor: Autor): Promise<void> {
    return this.feriados.excluir(id, autor);
  }
}
