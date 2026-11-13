import 'reflect-metadata';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { carregarConfig, ErroConfiguracao } from './config/config.js';
import { configurarApp } from './configurar-app.js';

// Desenvolvimento: lê o .env da raiz do repositório (sem sobrescrever o que já veio do ambiente).
// Em produção o serviço do Windows passa o arquivo de configuração com `node --env-file` (P16,
// docs/deploy-windows.md) e nenhum .env de fora é procurado.
const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

async function iniciar(): Promise<void> {
  let config;
  try {
    config = carregarConfig(process.env);
  } catch (erro) {
    if (erro instanceof ErroConfiguracao) {
      console.error(erro.message);
      process.exit(1);
    }
    throw erro;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule.registrar(config), {
    bufferLogs: true,
  });
  configurarApp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.PORT_API);
}

await iniciar();
