import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Sessao, StatusCiclo } from '@metas/tipos';

import { PoliticasService } from '../politicas/politicas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermiteInativo } from './decoradores.js';
import { type UsuarioAtual, UsuarioLogado } from './usuario-atual.js';

const SETOR = { id: true, codigo: true, nome: true, corporativo: true } as const;

/**
 * Sessão do usuário logado (especificação 10.1). Acessível também ao usuário inativo, para a web
 * mostrar que o acesso aguarda liberação. Pendências do mês entram com os lançamentos (P18/P20).
 */
@ApiTags('sessão')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly politicas: PoliticasService,
  ) {}

  @Get()
  @PermiteInativo()
  @ApiOperation({ summary: 'Usuário logado, perfil e setores que ele vê' })
  async sessao(@UsuarioLogado() usuario: UsuarioAtual): Promise<Sessao> {
    const todosOsSetores = this.politicas.veTudo(usuario);
    return {
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        ativo: usuario.ativo,
        gerenteGeral: usuario.gerenteGeral,
      },
      todosOsSetores,
      setores: todosOsSetores ? [] : await this.setores(usuario),
    };
  }

  private async setores(usuario: UsuarioAtual): Promise<Sessao['setores']> {
    if (this.politicas.temPerfil(usuario, ['GESTOR'])) {
      const responsaveis = await this.prisma.setorResponsavel.findMany({
        where: { usuarioId: usuario.id, ciclo: { status: StatusCiclo.ATIVO } },
        select: { setor: { select: SETOR } },
        orderBy: { setor: { nome: 'asc' } },
      });
      return responsaveis.map((r) => r.setor);
    }
    if (this.politicas.temPerfil(usuario, ['LEITOR'])) {
      return this.prisma.setor.findMany({
        where: { id: { in: [...usuario.setoresLeitor] } },
        select: SETOR,
        orderBy: { nome: 'asc' },
      });
    }
    return [];
  }
}
