import 'reflect-metadata';

import path from 'node:path';

import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { config as carregarEnv } from 'dotenv';

import { AppModule } from '../src/app.module.js';
import type { Config } from '../src/config/config.js';
import { configurarApp } from '../src/configurar-app.js';

carregarEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

/**
 * URL do banco de testes com o usuário da aplicação (metas_app): mesma credencial de
 * DATABASE_URL, apontando para o banco de DATABASE_URL_TESTE (que precisa terminar em _teste).
 */
export function urlBancoTesteComoApp(): string {
  const app = process.env.DATABASE_URL;
  const teste = process.env.DATABASE_URL_TESTE;
  if (app === undefined || app === '' || teste === undefined || teste === '') {
    throw new Error('Defina DATABASE_URL e DATABASE_URL_TESTE no .env para os testes da API.');
  }
  const url = new URL(app);
  url.pathname = new URL(teste).pathname;
  if (!url.pathname.endsWith('_teste')) {
    throw new Error('O banco de testes deve terminar em _teste.');
  }
  return url.toString();
}

export const ORIGEM_WEB = 'http://localhost:5173';

export function configTeste(alteracoes: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT_API: 0,
    DATABASE_URL: urlBancoTesteComoApp(),
    WEB_ORIGIN: ORIGEM_WEB,
    LOG_LEVEL: 'silent',
    LIMITE_ESCRITA_POR_MINUTO: 120,
    ...alteracoes,
  };
}

/** Sobe a aplicação completa (mesma configuração do main.ts), com controllers extras de teste. */
export async function criarApp(
  config: Config = configTeste(),
  controllers: Type[] = [],
): Promise<NestExpressApplication> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule.registrar(config)],
    controllers,
  }).compile();
  const app = modulo.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configurarApp(app, config);
  await app.init();
  return app;
}
