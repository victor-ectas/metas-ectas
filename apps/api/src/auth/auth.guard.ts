import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Perfil } from '@metas/tipos';

import { ErroApi } from '../comum/erro-api.js';
import { CONFIG, type Config } from '../config/config.js';
import { PoliticasService } from '../politicas/politicas.service.js';
import { AcessoService } from './acesso.service.js';
import { CHAVE_PERFIS, CHAVE_PERMITE_INATIVO, CHAVE_PUBLICA } from './decoradores.js';
import type { RequisicaoAutenticada } from './usuario-atual.js';
import { ValidadorToken } from './validador-token.js';

/** Cabeçalho do modo DEV para escolher o usuário simulado (só com AUTH_DEV=true). */
export const CABECALHO_USUARIO_DEV = 'x-usuario-dev';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Guard global (CLAUDE.md 6): toda rota exige login, exceto as marcadas com `@Publica()`.
 * 1. Identifica o usuário (token do Entra ID, ou usuário simulado no modo DEV).
 * 2. Usuário inativo só acessa rotas `@PermiteInativo()` (o `GET /me`).
 * 3. `@Perfis(...)` é decidido pelo PoliticasService.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CONFIG) private readonly config: Config,
    private readonly validador: ValidadorToken,
    private readonly acesso: AcessoService,
    private readonly politicas: PoliticasService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const alvos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(CHAVE_PUBLICA, alvos) === true) {
      return true;
    }

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const usuario = await this.identificar(requisicao);
    requisicao.usuario = usuario;

    const permiteInativo =
      this.reflector.getAllAndOverride<boolean | undefined>(CHAVE_PERMITE_INATIVO, alvos) === true;
    if (!usuario.ativo && !permiteInativo) {
      throw new ErroApi(
        'SEM_PERMISSAO',
        'Seu acesso ainda não foi liberado. Peça ao Administrador do sistema para ativar seu usuário.',
        { motivo: 'USUARIO_INATIVO' },
      );
    }

    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(CHAVE_PERFIS, alvos);
    if (perfis !== undefined && !this.politicas.temPerfil(usuario, perfis)) {
      throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    }
    return true;
  }

  private async identificar(requisicao: RequisicaoAutenticada) {
    if (this.config.AUTH_DEV) {
      const escolhido = requisicao.headers[CABECALHO_USUARIO_DEV];
      const email =
        typeof escolhido === 'string' && escolhido.trim() !== ''
          ? escolhido.trim().toLowerCase()
          : this.config.AUTH_DEV_EMAIL;
      // A configuração garante AUTH_DEV_EMAIL com AUTH_DEV=true.
      if (email === undefined) throw new Error('AUTH_DEV_EMAIL ausente no modo DEV.');
      return this.acesso.usuarioDev(email);
    }

    const token = BEARER.exec(requisicao.headers.authorization ?? '')?.[1];
    if (token === undefined) {
      throw new ErroApi('NAO_AUTENTICADO', 'Faça login para continuar.');
    }
    const identidade = await this.validador.validar(token);
    return this.acesso.usuarioDoLogin(identidade, requisicao.ip ?? null);
  }
}
