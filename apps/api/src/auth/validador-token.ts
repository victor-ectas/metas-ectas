import { Inject, Injectable } from '@nestjs/common';
import { errors, type JWTVerifyGetKey, jwtVerify } from 'jose';

import { ErroApi } from '../comum/erro-api.js';
import { CONFIG, type Config } from '../config/config.js';

/** Token de injeção das chaves públicas do Entra ID (JWKS). Nos testes, um JWKS local. */
export const CHAVES_ENTRA = Symbol('CHAVES_ENTRA');
export type ChavesEntra = JWTVerifyGetKey;

/** Folga para diferença de relógio entre o servidor e o Entra ID. */
const TOLERANCIA_RELOGIO_S = 60;

/** Quem o token identifica. */
export interface IdentidadeEntra {
  /** `oid`: identificador do usuário no tenant. */
  readonly oid: string;
  /** E-mail (`email` ou `preferred_username`), em minúsculas. Nulo se o token não trouxer. */
  readonly email: string | null;
  readonly nome: string | null;
}

export const emissorEntra = (tenant: string) => `https://login.microsoftonline.com/${tenant}/v2.0`;

/**
 * Valida o access token do Entra ID (CLAUDE.md 6): assinatura RS256 pelo JWKS do tenant, emissor
 * v2 do tenant, audiência da API e expiração. Exige `oid` (usuário) e `scp` (token delegado, emitido
 * para um usuário; tokens só de aplicação e ID tokens não têm `scp`).
 */
@Injectable()
export class ValidadorToken {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(CHAVES_ENTRA) private readonly chaves: ChavesEntra,
  ) {}

  async validar(token: string): Promise<IdentidadeEntra> {
    const tenant = this.config.ENTRA_TENANT_ID;
    if (tenant === undefined) throw new Error('ENTRA_TENANT_ID ausente fora do modo DEV.');
    try {
      const { payload } = await jwtVerify(token, this.chaves, {
        issuer: emissorEntra(tenant),
        audience: this.config.ENTRA_API_AUDIENCE,
        algorithms: ['RS256'],
        clockTolerance: TOLERANCIA_RELOGIO_S,
        requiredClaims: ['exp', 'oid', 'scp'],
      });
      const { oid, scp } = payload;
      if (typeof oid !== 'string' || oid === '' || typeof scp !== 'string' || scp === '') {
        throw new ErroApi('NAO_AUTENTICADO', MENSAGEM_TOKEN_INVALIDO);
      }
      return { oid, email: emailDoToken(payload), nome: textoOuNulo(payload.name) };
    } catch (erro) {
      if (erro instanceof errors.JWTExpired) {
        throw new ErroApi('NAO_AUTENTICADO', 'Sua sessão expirou. Entre de novo.', {
          motivo: 'TOKEN_EXPIRADO',
        });
      }
      // Falha ao buscar as chaves do Entra ID não é culpa do token: vira erro interno (logado).
      if (erro instanceof errors.JWKSTimeout || !(erro instanceof errors.JOSEError)) throw erro;
      throw new ErroApi('NAO_AUTENTICADO', MENSAGEM_TOKEN_INVALIDO);
    }
  }
}

const MENSAGEM_TOKEN_INVALIDO = 'Login inválido. Entre de novo com sua conta Microsoft.';

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function emailDoToken(payload: Record<string, unknown>): string | null {
  for (const claim of ['email', 'preferred_username']) {
    const valor = textoOuNulo(payload[claim]);
    if (valor?.includes('@')) return valor.toLowerCase();
  }
  return null;
}
