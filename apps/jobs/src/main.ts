import { existsSync } from 'node:fs';
import path from 'node:path';

import { criarPrismaClient } from '@metas/prisma';
import { pino } from 'pino';

import { carregarConfig, ErroConfiguracao } from './config.js';
import { iniciarFila } from './fila.js';
import { NotificadorSemEmail } from './notificacoes.js';
import { executarRotinaDiaria } from './rotina-diaria.js';

// Desenvolvimento: lê o .env da raiz (sem sobrescrever o ambiente). Em produção o serviço do
// Windows passa o arquivo de configuração com `node --env-file` (docs/deploy-windows.md).
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

  const logger = pino({ level: config.LOG_LEVEL, base: { servico: 'metas-jobs' } });
  const prisma = criarPrismaClient(config.DATABASE_URL);
  const notificador = new NotificadorSemEmail(logger);
  const boss = await iniciarFila({
    databaseUrl: config.DATABASE_URL,
    logger,
    executar: () =>
      executarRotinaDiaria({
        banco: { transacao: (fn) => prisma.$transaction(fn, { timeout: 60_000 }) },
        agora: new Date(),
        logger,
        notificador,
      }),
  });
  logger.info('Serviço de jobs no ar: rotina diária às 00h05 (America/Sao_Paulo)');

  // O NSSM para o serviço com Ctrl+C (SIGINT); espera a rotina em andamento terminar.
  let parando = false;
  const parar = (sinal: string) => {
    if (parando) return;
    parando = true;
    logger.info({ sinal }, 'Parando o serviço de jobs');
    void boss
      .stop({ graceful: true, timeout: 30_000 })
      .then(() => prisma.$disconnect())
      .then(() => process.exit(0))
      .catch((erro: unknown) => {
        logger.error({ err: erro }, 'Erro ao parar o serviço de jobs');
        process.exit(1);
      });
  };
  process.on('SIGINT', () => {
    parar('SIGINT');
  });
  process.on('SIGTERM', () => {
    parar('SIGTERM');
  });
}

await iniciar();
