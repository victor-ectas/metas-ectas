import { ZONA_REGRAS } from '@metas/motor';
import { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';

/** Schema da fila, criado pela migração `schema_pgboss` (o metas_app não cria schemas). */
export const SCHEMA_FILA = 'pgboss';
export const FILA_ROTINA_DIARIA = 'rotina-diaria';
/** 00h05 em America/Sao_Paulo (especificação 9.3). */
export const CRON_ROTINA_DIARIA = '5 0 * * *';

export interface OpcoesFila {
  readonly databaseUrl: string;
  readonly logger: Logger;
  /** O que a fila executa: a rotina diária, com o relógio do momento. */
  readonly executar: () => Promise<unknown>;
}

/**
 * Sobe o pg-boss, agenda a rotina diária e já pede uma execução, para recuperar dias perdidos
 * enquanto o serviço estava parado. A fila é `singleton`: no máximo uma rotina na fila e uma
 * rodando. Falhou? Tenta de novo três vezes, de 5 em 5 minutos.
 */
export async function iniciarFila(opcoes: OpcoesFila): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: opcoes.databaseUrl,
    schema: SCHEMA_FILA,
    createSchema: false,
    application_name: 'metas-jobs',
  });
  boss.on('error', (erro) => {
    opcoes.logger.error({ err: erro }, 'Erro na fila de jobs');
  });
  await boss.start();
  await boss.createQueue(FILA_ROTINA_DIARIA, {
    policy: 'singleton',
    retryLimit: 3,
    retryDelay: 300,
  });
  await boss.schedule(FILA_ROTINA_DIARIA, CRON_ROTINA_DIARIA, null, { tz: ZONA_REGRAS });
  await boss.work(FILA_ROTINA_DIARIA, async () => {
    const inicio = Date.now();
    try {
      const resultado = await opcoes.executar();
      opcoes.logger.info({ duracaoMs: Date.now() - inicio }, 'Rotina diária concluída');
      return resultado;
    } catch (erro) {
      opcoes.logger.error({ err: erro, duracaoMs: Date.now() - inicio }, 'Rotina diária falhou');
      throw erro;
    }
  });
  await boss.send(FILA_ROTINA_DIARIA, null);
  return boss;
}
