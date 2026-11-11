import 'reflect-metadata';

import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';

import { AppModule } from '../src/app.module.js';
import { CHAVES_ENTRA, emissorEntra } from '../src/auth/validador-token.js';
import type { Config } from '../src/config/config.js';
import { configurarApp } from '../src/configurar-app.js';
import { urlBancoTesteComoApp } from './ambiente.js';

export const ORIGEM_WEB = 'http://localhost:5173';

/** Tenant e audiências fictícios dos testes. */
export const TENANT_TESTE = '0f0e0d0c-0b0a-4908-8706-050403020100';
export const OUTRO_TENANT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
export const AUDIENCIA_URI = 'api://metas';
export const AUDIENCIA_GUID = '12345678-90ab-4cde-8f01-234567890abc';

/** Par de chaves que faz o papel do Entra ID nos testes, e outro que não é confiável. */
const CHAVE_ENTRA = await generateKeyPair('RS256');
const CHAVE_ESTRANHA = await generateKeyPair('RS256');
const KID = 'chave-teste';
const JWKS_TESTE = createLocalJWKSet({
  keys: [{ ...(await exportJWK(CHAVE_ENTRA.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }],
});

export interface OpcoesToken {
  /** Assina com uma chave que não está no JWKS. */
  chaveEstranha?: boolean;
  /** Validade em segundos a partir de agora (negativo: já expirado; null: sem `exp`). */
  expiraEm?: number | null;
  emissor?: string;
  audiencia?: string;
}

/**
 * Access token v2 como o Entra ID emitiria. `claims` substitui as padrões; `undefined` remove.
 */
export async function emitirToken(
  claims: Record<string, unknown> = {},
  opcoes: OpcoesToken = {},
): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const padrao: Record<string, unknown> = {
    oid: '00000000-0000-4000-8000-000000000001',
    scp: 'acesso',
    name: 'Usuário de Teste',
    preferred_username: 'usuario@api-teste.local',
    tid: TENANT_TESTE,
    ver: '2.0',
  };
  const payload = Object.fromEntries(
    Object.entries({ ...padrao, ...claims }).filter(([, valor]) => valor !== undefined),
  ) as JWTPayload;
  const chave = opcoes.chaveEstranha === true ? CHAVE_ESTRANHA : CHAVE_ENTRA;
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
    .setIssuer(opcoes.emissor ?? emissorEntra(TENANT_TESTE))
    .setAudience(opcoes.audiencia ?? AUDIENCIA_GUID)
    .setIssuedAt(agora - 60)
    .setNotBefore(agora - 60);
  if (opcoes.expiraEm !== null) jwt.setExpirationTime(agora + (opcoes.expiraEm ?? 3600));
  return jwt.sign(chave.privateKey);
}

export function configTeste(alteracoes: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT_API: 0,
    DATABASE_URL: urlBancoTesteComoApp(),
    WEB_ORIGIN: ORIGEM_WEB,
    LOG_LEVEL: 'silent',
    LIMITE_ESCRITA_POR_MINUTO: 120,
    ENTRA_TENANT_ID: TENANT_TESTE,
    ENTRA_API_AUDIENCE: [AUDIENCIA_URI, AUDIENCIA_GUID],
    AUTH_DEV: false,
    AUTH_DEV_EMAIL: undefined,
    ...alteracoes,
  };
}

/**
 * Sobe a aplicação completa (mesma configuração do main.ts), com controllers extras de teste.
 * As chaves do Entra ID são trocadas pelo JWKS local dos testes (sem rede).
 */
export async function criarApp(
  config: Config = configTeste(),
  controllers: Type[] = [],
): Promise<NestExpressApplication> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule.registrar(config)],
    controllers,
  })
    .overrideProvider(CHAVES_ENTRA)
    .useValue(JWKS_TESTE)
    .compile();
  const app = modulo.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configurarApp(app, config);
  await app.init();
  return app;
}
